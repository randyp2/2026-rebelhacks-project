"""
Detect and track people in a video, with an optional fixed counting line.

This script intentionally contains no door detection. It runs frame-by-frame
person detection (COCO class 0) and tracks identities across frames using
Ultralytics' built-in trackers.

If a counting line is configured, it counts entry/exit using a tracked person's
foot point (bottom-center of the box). Use either:
  --count-mode line: count on line crossing
  --count-mode zone: count on outside-zone <-> inside-zone transitions

Usage:
  python people_counter.py --video input.mp4 --show
  python people_counter.py --video input.mp4 --save out.mp4
  python people_counter.py --video input.mp4 --tracker botsort.yaml --show
  python people_counter.py --video input.mp4 --count-mode zone --zone-depth 220 --show
  python people_counter.py --video input.mp4 --line-x1 100 --line-y1 500 --line-x2 400 --line-y2 500 --show
"""

from __future__ import annotations

import argparse
import math
import os
import subprocess
import sys
import time
from uuid import uuid4

import cv2
import numpy as np
import requests
from ultralytics import YOLO

# ADJUST RED LINE HERE 
# Default counting line (pixels). Edit these when changing camera/door setup.
DEFAULT_LINE_X1 = 950
DEFAULT_LINE_Y1 = 685
DEFAULT_LINE_X2 = 1020
DEFAULT_LINE_Y2 = 750

def clamp_int(val: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, int(val)))


def side_of_gate(
    x: float,
    y: float,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    margin: int,
) -> int:
    """
    Return which side of a gate segment a point is on.

    For non-vertical gates, compare y against the gate y-value at point x.
    For vertical gates, fall back to point x against gate x.

    -1: above/left
     0: in dead-zone or outside span
    +1: below/right
    """
    min_x, max_x = min(x1, x2), max(x1, x2)
    if x < (min_x - margin) or x > (max_x + margin):
        return 0

    dx = x2 - x1
    if dx == 0:
        if x < x1 - margin:
            return -1
        if x > x1 + margin:
            return 1
        return 0

    t = (x - x1) / float(dx)
    y_on_gate = y1 + t * (y2 - y1)
    if y < y_on_gate - margin:
        return -1
    if y > y_on_gate + margin:
        return 1
    return 0


def side_of_line(
    x: float,
    y: float,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    margin: int,
) -> int:
    """
    Return which side of the infinite line a point is on.

    This matches the sign semantics of side_of_gate but does not restrict
    the point to the segment span (useful for building zones from the line).

    -1: above/left
     0: in dead-zone
    +1: below/right
    """
    dx = x2 - x1
    if dx == 0:
        if x < x1 - margin:
            return -1
        if x > x1 + margin:
            return 1
        return 0

    t = (x - x1) / float(dx)
    y_on_line = y1 + t * (y2 - y1)
    if y < y_on_line - margin:
        return -1
    if y > y_on_line + margin:
        return 1
    return 0


def unit_normal_toward_side(
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    desired_side: int,
) -> tuple[float, float]:
    dx = float(x2 - x1)
    dy = float(y2 - y1)
    length = math.hypot(dx, dy)
    if length <= 0:
        raise ValueError("Counting line has zero length")

    # A unit normal (dy, -dx) points to one side; flip if needed.
    nx = dy / length
    ny = -dx / length

    mx = (x1 + x2) / 2.0
    my = (y1 + y2) / 2.0
    test_side = side_of_line(mx + nx, my + ny, x1, y1, x2, y2, 0)
    if test_side == 0:
        test_side = side_of_line(mx + nx * 10.0, my + ny * 10.0, x1, y1, x2, y2, 0)
    if test_side != desired_side:
        nx, ny = -nx, -ny
    return nx, ny


def build_zone_polygon(
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    nx: float,
    ny: float,
    depth_px: int,
    width: int,
    height: int,
) -> np.ndarray:
    ox = nx * float(depth_px)
    oy = ny * float(depth_px)
    pts = [
        (clamp_int(x1, 0, max(0, width - 1)), clamp_int(y1, 0, max(0, height - 1))),
        (clamp_int(x2, 0, max(0, width - 1)), clamp_int(y2, 0, max(0, height - 1))),
        (
            clamp_int(int(round(x2 + ox)), 0, max(0, width - 1)),
            clamp_int(int(round(y2 + oy)), 0, max(0, height - 1)),
        ),
        (
            clamp_int(int(round(x1 + ox)), 0, max(0, width - 1)),
            clamp_int(int(round(y1 + oy)), 0, max(0, height - 1)),
        ),
    ]
    return np.array(pts, dtype=np.int32).reshape((-1, 1, 2))


def extend_line_to_frame(
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    width: int,
    height: int,
) -> tuple[int, int, int, int]:
    """
    Extend a line segment so its endpoints lie on the frame bounds.

    This increases coverage for counting so that crossings aren't ignored just
    because they occur outside the original segment span.
    """
    w_max = max(0, int(width) - 1)
    h_max = max(0, int(height) - 1)

    dx = float(x2 - x1)
    dy = float(y2 - y1)
    if dx == 0.0 and dy == 0.0:
        return (
            clamp_int(x1, 0, w_max),
            clamp_int(y1, 0, h_max),
            clamp_int(x2, 0, w_max),
            clamp_int(y2, 0, h_max),
        )

    points: list[tuple[float, float]] = []

    def add_point(px: float, py: float) -> None:
        if 0.0 <= px <= float(w_max) and 0.0 <= py <= float(h_max):
            points.append((px, py))

    if dx != 0.0:
        t = (0.0 - float(x1)) / dx
        add_point(0.0, float(y1) + t * dy)
        t = (float(w_max) - float(x1)) / dx
        add_point(float(w_max), float(y1) + t * dy)
    if dy != 0.0:
        t = (0.0 - float(y1)) / dy
        add_point(float(x1) + t * dx, 0.0)
        t = (float(h_max) - float(y1)) / dy
        add_point(float(x1) + t * dx, float(h_max))

    if len(points) < 2:
        return (
            clamp_int(x1, 0, w_max),
            clamp_int(y1, 0, h_max),
            clamp_int(x2, 0, w_max),
            clamp_int(y2, 0, h_max),
        )

    best_i, best_j = 0, 1
    best_d2 = -1.0
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            ddx = points[i][0] - points[j][0]
            ddy = points[i][1] - points[j][1]
            d2 = ddx * ddx + ddy * ddy
            if d2 > best_d2:
                best_d2 = d2
                best_i, best_j = i, j

    ax, ay = points[best_i]
    bx, by = points[best_j]
    return (
        clamp_int(int(round(ax)), 0, w_max),
        clamp_int(int(round(ay)), 0, h_max),
        clamp_int(int(round(bx)), 0, w_max),
        clamp_int(int(round(by)), 0, h_max),
    )


def point_in_polygon(poly: np.ndarray, x: float, y: float, margin_px: int = 0) -> bool:
    if margin_px <= 0:
        return cv2.pointPolygonTest(poly, (float(x), float(y)), False) >= 0
    return cv2.pointPolygonTest(poly, (float(x), float(y)), True) >= -float(margin_px)


def crossing_direction(prev_side: int, curr_side: int) -> str | None:
    if prev_side == -1 and curr_side == 1:
        return "down"
    if prev_side == 1 and curr_side == -1:
        return "up"
    return None


def check_room_high_risk(
    session: requests.Session,
    api_base_url: str,
    cv_api_key: str,
    room_id: str,
    timeout_seconds: int,
) -> dict:
    url = f"{api_base_url.rstrip('/')}/api/cv/room-risk"
    response = session.post(
        url,
        headers={"x-cv-api-key": cv_api_key},
        json={"room_id": room_id},
        timeout=timeout_seconds,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("Invalid response payload from /api/cv/room-risk")
    return payload


def current_video_seconds(cap: cv2.VideoCapture, frame_index: int, fps: float) -> float:
    pos_msec = cap.get(cv2.CAP_PROP_POS_MSEC)
    if pos_msec and pos_msec > 0:
        return pos_msec / 1000.0
    if fps > 0:
        return float(frame_index) / float(fps)
    return 0.0


def launch_uploader_clip(
    uploader_python: str,
    uploader_script: str,
    source_video: str,
    room_id: str,
    cv_api_key: str,
    next_api_base_url: str,
    start_offset_seconds: float,
    duration_seconds: float,
) -> subprocess.Popen:
    env = os.environ.copy()
    env["CAMERA_SOURCE"] = source_video
    env["ROOM_ID"] = room_id
    env["CV_API_KEY"] = cv_api_key
    env["NEXT_API_BASE_URL"] = next_api_base_url.rstrip("/")
    env["START_OFFSET_SECONDS"] = f"{max(0.0, start_offset_seconds):.3f}"
    env["MAX_DURATION_SECONDS"] = f"{max(0.1, duration_seconds):.3f}"
    env["VIDEO_ID"] = f"vid_entry_{int(time.time())}_{uuid4().hex[:8]}"

    return subprocess.Popen(
        [uploader_python, uploader_script],
        env=env,
        start_new_session=True,
    )


def reap_finished_uploads(active_uploads: list[dict[str, object]]) -> None:
    remaining: list[dict[str, object]] = []
    for job in active_uploads:
        proc = job.get("proc")
        trigger = job.get("trigger")
        if not isinstance(proc, subprocess.Popen):
            continue
        rc = proc.poll()
        if rc is None:
            remaining.append(job)
            continue
        if rc == 0:
            print(f"[uploader] completed trigger={trigger}")
        else:
            print(f"[uploader] failed trigger={trigger} return_code={rc}")
    active_uploads[:] = remaining


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect and track people in a video.")
    parser.add_argument("--video", required=True, help="Path to input video file")
    parser.add_argument(
        "--model",
        default="yolov8n.pt",
        help="Ultralytics model path/name (default: yolov8n.pt)",
    )
    parser.add_argument(
        "--tracker",
        default="bytetrack.yaml",
        help=(
            "Tracker config used by Ultralytics (default: bytetrack.yaml). "
            "Try botsort.yaml for better ID stability under occlusion."
        ),
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.35,
        help="Detection confidence threshold",
    )
    parser.add_argument(
        "--foot-max-dy",
        type=int,
        default=10,
        help=(
            "Optional per-frame clamp (pixels, before --process-scale) on how much a tracked "
            "person's foot Y can change. Helps reduce jitter/spikes. Set to 0 to disable."
        ),
    )
    parser.add_argument(
        "--foot-ema-alpha",
        type=float,
        default=0.35,
        help=(
            "Optional exponential smoothing factor for tracked foot points in [0,1]. "
            "1.0 disables smoothing; smaller values smooth more."
        ),
    )
    parser.add_argument(
        "--extend-line",
        default=True,
        action=argparse.BooleanOptionalAction,
        help=(
            "Extend the configured counting line to the frame bounds (default: true). "
            "Use --no-extend-line to draw/use exactly the provided endpoints."
        ),
    )
    parser.add_argument(
        "--boundary-shift-x",
        type=int,
        default=-30,
        help=(
            "Shift the boundary left/right in pixels (before --process-scale). "
            "Negative moves left (default: 20)."
        ),
    )
    parser.add_argument(
        "--boundary-shift-y",
        type=int,
        default=20,
        help=(
            "Shift the boundary up/down in pixels (before --process-scale). "
            "Positive moves down (default: 20)."
        ),
    )
    parser.add_argument(
        "--line-x1",
        type=int,
        default=None,
        help="Counting line endpoint 1 X (pixels). If omitted, uses a default line.",
    )
    parser.add_argument(
        "--line-y1",
        type=int,
        default=None,
        help="Counting line endpoint 1 Y (pixels). If omitted, uses a default line.",
    )
    parser.add_argument(
        "--line-x2",
        type=int,
        default=None,
        help="Counting line endpoint 2 X (pixels). If omitted, uses a default line.",
    )
    parser.add_argument(
        "--line-y2",
        type=int,
        default=None,
        help="Counting line endpoint 2 Y (pixels). If omitted, uses a default line.",
    )
    parser.add_argument(
        "--direction",
        choices=("down", "up"),
        default="down",
        help="Entry direction relative to line crossing (default: down)",
    )
    parser.add_argument(
        "--count-mode",
        choices=("line", "zone"),
        default="zone",
        help="Counting logic: line crossing or door zone transition (default: zone).",
    )
    parser.add_argument(
        "--zone-depth",
        type=int,
        default=220,
        help=(
            "Depth (pixels, before --process-scale) of the inside/outside door zones when "
            "using --count-mode zone."
        ),
    )
    parser.add_argument(
        "--zone-margin",
        type=int,
        default=0,
        help=(
            "Extra margin (pixels, before --process-scale) for point-in-zone checks when "
            "using --count-mode zone."
        ),
    )
    parser.add_argument(
        "--line-margin",
        type=int,
        default=10,
        help="Dead-zone around the line to reduce jitter double-counts",
    )
    parser.add_argument(
        "--line-thickness",
        type=int,
        default=4,
        help="Thickness of the drawn counting line",
    )
    parser.add_argument(
        "--process-scale",
        type=float,
        default=1.0,
        help=(
            "Resize frames before running detection/tracking (e.g. 0.5). "
            "This speeds things up but changes pixel coordinates and saved output size."
        ),
    )
    parser.add_argument(
        "--stride",
        type=int,
        default=1.5,
        help=(
            "Process every Nth frame (default: 1). Higher values run faster but can miss crossings."
        ),
    )
    parser.add_argument(
        "--initial-occupancy",
        type=int,
        default=0,
        help="Starting number of people already in the room",
    )
    parser.add_argument(
        "--display-scale",
        type=float,
        default=1.0,
        help=(
            "Scale factor for the on-screen display when using --show (e.g. 0.5). "
            "Does not affect detection or saved video."
        ),
    )
    parser.add_argument(
        "--show",
        action="store_true",
        help="Display annotated video while processing",
    )
    parser.add_argument(
        "--save",
        help="Optional output path for annotated video (e.g. out.mp4)",
    )
    parser.add_argument(
        "--room-id",
        default=os.getenv("ROOM_ID", "").strip(),
        help="Room identifier sent to /api/cv/room-risk on each entry event",
    )
    parser.add_argument(
        "--next-api-base-url",
        default=os.getenv("NEXT_API_BASE_URL", "http://localhost:3000"),
        help="Next.js base URL hosting /api/cv/room-risk",
    )
    parser.add_argument(
        "--cv-api-key",
        default=os.getenv("CV_API_KEY", ""),
        help="API key sent as x-cv-api-key to /api/cv/room-risk",
    )
    parser.add_argument(
        "--risk-timeout-seconds",
        type=int,
        default=10,
        help="Timeout for /api/cv/room-risk requests",
    )
    parser.add_argument(
        "--upload-delay-seconds",
        type=float,
        default=10.0,
        help="Deprecated/ignored: uploader now launches immediately on high-risk entry",
    )
    parser.add_argument(
        "--upload-duration-seconds",
        type=float,
        default=10.0,
        help="Clip duration uploaded by uploader.py starting from entry time",
    )
    parser.add_argument(
        "--max-upload-triggers",
        type=int,
        default=1,
        help="Maximum number of high-risk uploader launches per run",
    )
    parser.add_argument(
        "--uploader-script",
        default="cv/uploader.py",
        help="Path to uploader.py script",
    )
    parser.add_argument(
        "--uploader-python",
        default=sys.executable,
        help="Python executable used to run uploader.py",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.room_id:
        raise ValueError("Missing room id. Pass --room-id or set ROOM_ID.")
    if not args.cv_api_key:
        raise ValueError("Missing CV API key. Pass --cv-api-key or set CV_API_KEY.")
    if int(args.risk_timeout_seconds) <= 0:
        raise ValueError("--risk-timeout-seconds must be > 0")
    if float(args.upload_delay_seconds) < 0:
        raise ValueError("--upload-delay-seconds must be >= 0")
    if float(args.upload_duration_seconds) <= 0:
        raise ValueError("--upload-duration-seconds must be > 0")
    if int(args.max_upload_triggers) < 0:
        raise ValueError("--max-upload-triggers must be >= 0")

    model = YOLO(args.model)
    api_base_url = args.next_api_base_url.rstrip("/")
    session = requests.Session()

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {args.video}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    display_scale = float(args.display_scale)
    if display_scale <= 0:
        raise ValueError("--display-scale must be > 0")

    process_scale = float(args.process_scale)
    if process_scale <= 0:
        raise ValueError("--process-scale must be > 0")

    foot_max_dy_px = max(0, int(int(args.foot_max_dy) * process_scale))
    foot_ema_alpha = float(args.foot_ema_alpha)
    if not (0.0 < foot_ema_alpha <= 1.0):
        raise ValueError("--foot-ema-alpha must be in (0, 1]")

    stride = int(args.stride)
    if stride < 1:
        raise ValueError("--stride must be >= 1")

    proc_width = max(1, int(width * process_scale))
    proc_height = max(1, int(height * process_scale))
    if args.show:
        cv2.namedWindow("People Detector", cv2.WINDOW_NORMAL)

    line_args = (args.line_x1, args.line_y1, args.line_x2, args.line_y2)
    any_line = any(v is not None for v in line_args)
    all_line = all(v is not None for v in line_args)
    if any_line and not all_line:
        raise ValueError("Set all of --line-x1/--line-y1/--line-x2/--line-y2, or none.")

    # Default line: full-width horizontal line at ~75% of frame height.
    if all_line:
        lx1, ly1, lx2, ly2 = (
            int(args.line_x1 * process_scale),
            int(args.line_y1 * process_scale),
            int(args.line_x2 * process_scale),
            int(args.line_y2 * process_scale),
        )
    else:
        lx1, ly1, lx2, ly2 = (
            int(DEFAULT_LINE_X1 * process_scale),
            int(DEFAULT_LINE_Y1 * process_scale),
            int(DEFAULT_LINE_X2 * process_scale),
            int(DEFAULT_LINE_Y2 * process_scale),
        )

    shift_x = int(int(args.boundary_shift_x) * process_scale)
    shift_y = int(int(args.boundary_shift_y) * process_scale)
    lx1 += shift_x
    lx2 += shift_x
    ly1 += shift_y
    ly2 += shift_y

    lx1 = clamp_int(lx1, 0, max(0, proc_width - 1))
    lx2 = clamp_int(lx2, 0, max(0, proc_width - 1))
    ly1 = clamp_int(ly1, 0, max(0, proc_height - 1))
    ly2 = clamp_int(ly2, 0, max(0, proc_height - 1))

    base_lx1, base_ly1, base_lx2, base_ly2 = lx1, ly1, lx2, ly2

    if bool(args.extend_line):
        lx1, ly1, lx2, ly2 = extend_line_to_frame(lx1, ly1, lx2, ly2, proc_width, proc_height)

    inside_zone = None
    outside_zone = None
    zone_margin_px = 0
    if args.count_mode == "zone":
        zone_depth = int(args.zone_depth)
        if zone_depth <= 0:
            raise ValueError("--zone-depth must be > 0 when using --count-mode zone")
        zone_depth_px = max(1, int(zone_depth * process_scale))
        zone_margin_px = max(0, int(int(args.zone_margin) * process_scale))

        inside_side = 1 if args.direction == "down" else -1
        # Build zones from the configured (non-extended) line so the polygons stay
        # localized around the door, even if the drawn counting line is extended
        # to the full frame for better coverage.
        nx, ny = unit_normal_toward_side(base_lx1, base_ly1, base_lx2, base_ly2, inside_side)
        inside_zone = build_zone_polygon(
            base_lx1,
            base_ly1,
            base_lx2,
            base_ly2,
            nx,
            ny,
            zone_depth_px,
            proc_width,
            proc_height,
        )
        outside_zone = build_zone_polygon(
            base_lx1,
            base_ly1,
            base_lx2,
            base_ly2,
            -nx,
            -ny,
            zone_depth_px,
            proc_width,
            proc_height,
        )

    writer = None
    if args.save:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out_fps = fps / float(stride)
        writer = cv2.VideoWriter(args.save, fourcc, out_fps, (proc_width, proc_height))

    frame_index = 0
    last_side_by_id: dict[int, int] = {}
    last_zone_by_id: dict[int, int] = {}
    smooth_foot_by_id: dict[int, tuple[float, float]] = {}
    entered = 0
    left = 0
    uploads_started = 0
    next_upload_left_threshold = 2
    active_uploads: list[dict[str, object]] = []

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if process_scale != 1.0:
            interp = cv2.INTER_AREA if process_scale < 1.0 else cv2.INTER_LINEAR
            frame = cv2.resize(frame, (proc_width, proc_height), interpolation=interp)

        if inside_zone is not None and outside_zone is not None:
            # Inside=yellow, Outside=green
            cv2.polylines(frame, [outside_zone], True, (0, 200, 0), 2)
            cv2.polylines(frame, [inside_zone], True, (0, 200, 200), 2)

        results = model.track(
            source=frame,
            conf=args.conf,
            classes=[0],  # class 0 = person in COCO
            persist=True,
            tracker=args.tracker,
            verbose=False,
        )

        result = results[0]
        boxes = result.boxes

        people_in_frame = 0
        if boxes is not None and len(boxes) > 0:
            xyxy = boxes.xyxy.cpu().tolist()
            ids = None
            if boxes.id is not None:
                ids = boxes.id.int().cpu().tolist()

            people_in_frame = len(xyxy)
            for idx, (x1, y1, x2, y2) in enumerate(xyxy):
                tid = None if ids is None else ids[idx]
                tid_i = None if tid is None else int(tid)

                foot_x = (x1 + x2) / 2.0
                foot_y = y2

                # Optional smoothing/clamping to reduce jittery "foot" motion caused by
                # bounding-box fluctuations.
                if tid_i is not None and (foot_max_dy_px > 0 or foot_ema_alpha < 1.0):
                    prev = smooth_foot_by_id.get(tid_i)
                    if prev is None:
                        smooth_foot_by_id[tid_i] = (foot_x, foot_y)
                    else:
                        prev_x, prev_y = prev
                        raw_x, raw_y = foot_x, foot_y

                        if foot_max_dy_px > 0:
                            dy = raw_y - prev_y
                            if dy > float(foot_max_dy_px):
                                raw_y = prev_y + float(foot_max_dy_px)
                            elif dy < -float(foot_max_dy_px):
                                raw_y = prev_y - float(foot_max_dy_px)

                        if foot_ema_alpha < 1.0:
                            a = foot_ema_alpha
                            foot_x = a * raw_x + (1.0 - a) * prev_x
                            foot_y = a * raw_y + (1.0 - a) * prev_y
                        else:
                            foot_x, foot_y = raw_x, raw_y

                        smooth_foot_by_id[tid_i] = (foot_x, foot_y)
                cv2.circle(frame, (int(foot_x), int(foot_y)), 4, (0, 255, 255), -1)

                # Update counts only when we have a stable track ID.
                if tid_i is not None:
                    if args.count_mode == "zone" and inside_zone is not None and outside_zone is not None:
                        in_inside = point_in_polygon(inside_zone, foot_x, foot_y, zone_margin_px)
                        in_outside = point_in_polygon(outside_zone, foot_x, foot_y, zone_margin_px)

                        curr_zone = 0
                        if in_inside and not in_outside:
                            curr_zone = 1
                        elif in_outside and not in_inside:
                            curr_zone = -1

                        if curr_zone != 0:
                            prev_zone = last_zone_by_id.get(tid_i)
                            if prev_zone == -1 and curr_zone == 1:
                                entered += 1
                                try:
                                    risk = check_room_high_risk(
                                        session=session,
                                        api_base_url=api_base_url,
                                        cv_api_key=args.cv_api_key,
                                        room_id=args.room_id,
                                        timeout_seconds=int(args.risk_timeout_seconds),
                                    )
                                    print(
                                        "[room-risk] "
                                        f"room_id={risk.get('room_id', args.room_id)} "
                                        f"score={risk.get('risk_score')} "
                                        f"threshold={risk.get('risk_threshold')} "
                                        f"is_high_risk={risk.get('is_high_risk')}",
                                    )
                                    if (
                                        bool(risk.get("is_high_risk"))
                                        and left >= next_upload_left_threshold
                                        and uploads_started < int(args.max_upload_triggers)
                                    ):
                                        entry_sec = current_video_seconds(cap, frame_index, fps)
                                        clip_duration = max(float(args.upload_duration_seconds), float(entry_sec))
                                        print(
                                            "[uploader] launching "
                                            f"entry_sec={entry_sec:.2f} "
                                            f"start_sec=0.00 "
                                            f"duration={clip_duration:.2f}s",
                                        )
                                        rc = launch_uploader_clip(
                                            uploader_python=str(args.uploader_python),
                                            uploader_script=str(args.uploader_script),
                                            source_video=str(args.video),
                                            room_id=str(args.room_id),
                                            cv_api_key=str(args.cv_api_key),
                                            next_api_base_url=str(args.next_api_base_url),
                                            start_offset_seconds=0.0,
                                            duration_seconds=clip_duration,
                                        )
                                        uploads_started += 1
                                        next_upload_left_threshold += 2
                                        active_uploads.append({"trigger": uploads_started, "proc": rc})
                                        print(
                                            f"[uploader] started trigger={uploads_started} "
                                            f"pid={rc.pid}"
                                        )
                                except (requests.RequestException, ValueError, RuntimeError, OSError) as err:
                                    print(f"[room-risk] failed room_id={args.room_id}: {err}")
                            elif prev_zone == 1 and curr_zone == -1:
                                left += 1
                            last_zone_by_id[tid_i] = curr_zone
                    else:
                        curr_side = side_of_gate(
                            foot_x,
                            foot_y,
                            lx1,
                            ly1,
                            lx2,
                            ly2,
                            int(args.line_margin),
                        )
                        prev_side = last_side_by_id.get(tid_i)

                        if prev_side is None:
                            if curr_side != 0:
                                last_side_by_id[tid_i] = curr_side
                        else:
                            if curr_side != 0 and curr_side != prev_side:
                                direction = crossing_direction(prev_side, curr_side)
                                if direction == args.direction:
                                    entered += 1
                                    try:
                                        risk = check_room_high_risk(
                                            session=session,
                                            api_base_url=api_base_url,
                                            cv_api_key=args.cv_api_key,
                                            room_id=args.room_id,
                                            timeout_seconds=int(args.risk_timeout_seconds),
                                        )
                                        print(
                                            "[room-risk] "
                                            f"room_id={risk.get('room_id', args.room_id)} "
                                            f"score={risk.get('risk_score')} "
                                            f"threshold={risk.get('risk_threshold')} "
                                            f"is_high_risk={risk.get('is_high_risk')}",
                                        )
                                        if (
                                            bool(risk.get("is_high_risk"))
                                            and left >= next_upload_left_threshold
                                            and uploads_started < int(args.max_upload_triggers)
                                        ):
                                            entry_sec = current_video_seconds(cap, frame_index, fps)
                                            clip_duration = max(float(args.upload_duration_seconds), float(entry_sec))
                                            print(
                                                "[uploader] launching "
                                                f"entry_sec={entry_sec:.2f} "
                                                f"start_sec=0.00 "
                                                f"duration={clip_duration:.2f}s",
                                            )
                                            rc = launch_uploader_clip(
                                                uploader_python=str(args.uploader_python),
                                                uploader_script=str(args.uploader_script),
                                                source_video=str(args.video),
                                                room_id=str(args.room_id),
                                                cv_api_key=str(args.cv_api_key),
                                                next_api_base_url=str(args.next_api_base_url),
                                                start_offset_seconds=0.0,
                                                duration_seconds=clip_duration,
                                            )
                                            uploads_started += 1
                                            next_upload_left_threshold += 2
                                            active_uploads.append({"trigger": uploads_started, "proc": rc})
                                            print(
                                                f"[uploader] started trigger={uploads_started} "
                                                f"pid={rc.pid}"
                                            )
                                    except (requests.RequestException, ValueError, RuntimeError, OSError) as err:
                                        print(f"[room-risk] failed room_id={args.room_id}: {err}")
                                elif direction is not None:
                                    left += 1
                                last_side_by_id[tid_i] = curr_side
                            elif curr_side != 0:
                                last_side_by_id[tid_i] = curr_side

                cv2.rectangle(
                    frame,
                    (int(x1), int(y1)),
                    (int(x2), int(y2)),
                    (0, 255, 0),
                    2,
                )
                label = f"ID {tid}" if tid is not None else "person"
                cv2.putText(
                    frame,
                    label,
                    (int(x1), max(20, int(y1) - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                )

        occupancy = max(0, int(args.initial_occupancy) + left - entered)
        cv2.putText(
            frame,
            f"Mode={args.count_mode}  Occ={occupancy} (+{left}/-{entered})  People in frame: {people_in_frame}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 255, 255),
            2,
        )

        if args.show:
            show_frame = frame
            if display_scale != 1.0:
                h, w = frame.shape[:2]
                new_w = max(1, int(w * display_scale))
                new_h = max(1, int(h * display_scale))
                interp = cv2.INTER_AREA if display_scale < 1.0 else cv2.INTER_LINEAR
                show_frame = cv2.resize(frame, (new_w, new_h), interpolation=interp)
            cv2.imshow("People Detector", show_frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        if writer is not None:
            writer.write(frame)

        if active_uploads:
            reap_finished_uploads(active_uploads)

        frame_index += 1

        if stride > 1:
            for _ in range(stride - 1):
                if not cap.grab():
                    break
                frame_index += 1

    cap.release()
    session.close()
    if writer is not None:
        writer.release()
    cv2.destroyAllWindows()

    reap_finished_uploads(active_uploads)
    if active_uploads:
        print(
            "[uploader] still running "
            f"count={len(active_uploads)} "
            "(background uploads may finish after people_counter exits)"
        )

    print("Final summary:")
    print(f"  frames={frame_index}")
    print(f"  entered={entered}")
    print(f"  left={left}")
    print(f"  occupancy={max(0, int(args.initial_occupancy) + entered - left)}")


if __name__ == "__main__":
    main()
