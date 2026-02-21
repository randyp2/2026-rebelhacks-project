"""
Count people entering and leaving a room from a video.

Approach:
- Detect people in each frame using YOLO (Ultralytics).
- Track identities across frames.
- Count an entry when a tracked person crosses a configured line
  in the chosen direction and an exit for the opposite crossing.

Usage:
  python people_counter.py --video input.mp4 --line 300 --direction down
  python people_counter.py --video input.mp4 --rooms-config rooms.example.json
  python people_counter.py --video input.mp4 --auto-detect-doors --show
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field

import cv2
import numpy as np
from ultralytics import YOLO    # model that trackes bodies in video


@dataclass
class TrackState:
    # Last stable side per room:
    # -1 means above line, +1 means below line, None means unknown yet.
    last_side_by_room: dict[str, int | None] = field(default_factory=dict)


@dataclass
class RoomConfig:
    room_id: str
    gate_x1: int
    gate_y1: int
    gate_x2: int
    gate_y2: int
    direction: str
    line_margin: int
    initial_occupancy: int
    line_thickness: int


@dataclass
class RoomStats:
    entered: int = 0
    left: int = 0


@dataclass
class DoorCandidate:
    x1: int
    y1: int
    x2: int
    y2: int
    conf: float
    prompt: str
    accepted: bool
    reason: str


def parse_args() -> argparse.Namespace:
    """Define command-line arguments for running the counter."""
    parser = argparse.ArgumentParser(description="Count people entering a room.")
    parser.add_argument("--video", required=True, help="Path to input video file")
    parser.add_argument(
        "--model",
        default="yolov8n.pt",
        help="Ultralytics model path/name (default: yolov8n.pt)",
    )
    parser.add_argument(
        "--line",
        type=int,
        default=None,
        help="Y-coordinate of virtual counting line in pixels",
    )
    parser.add_argument(
        "--rooms-config",
        help=(
            "Path to JSON config for multi-room counting. "
            "If provided, it overrides --line/--line-x1/--line-x2 for room setup."
        ),
    )
    parser.add_argument(
        "--auto-detect-doors",
        action="store_true",
        help=(
            "Automatically detect doors and create one counting line per door. "
            "Ignored when --rooms-config is set."
        ),
    )
    parser.add_argument(
        "--door-model",
        default="yolov8s-worldv2.pt",
        help="Model used for door detection in auto mode (default: yolov8s-worldv2.pt)",
    )
    parser.add_argument(
        "--door-prompt",
        default="door",
        help="Open-vocabulary prompt for auto door detection (default: door)",
    )
    parser.add_argument(
        "--door-prompts",
        default="door,doorway,entrance,open door,glass door,clear door,wooden door,metal door",
        help=(
            "Comma-separated prompts for auto door detection "
            '(e.g. "door,doorway,entrance,open door,glass door,clear door").'
        ),
    )
    parser.add_argument(
        "--door-negative-prompts",
        default="window,glass window,floor to ceiling window,picture window",
        help=(
            "Comma-separated negative prompts used to reject door candidates "
            '(e.g. "window,glass window").'
        ),
    )
    parser.add_argument(
        "--door-conf",
        type=float,
        default=0.25,
        help="Confidence threshold for auto door detection",
    )
    parser.add_argument(
        "--door-negative-conf",
        type=float,
        default=0.20,
        help="Confidence threshold for negative prompt detections (default: 0.20)",
    )
    parser.add_argument(
        "--max-doors",
        type=int,
        default=4,
        help="Maximum number of doors/rooms to track in auto mode",
    )
    parser.add_argument(
        "--door-min-width",
        type=int,
        default=80,
        help="Minimum detected door width in pixels for auto mode",
    )
    parser.add_argument(
        "--door-line-offset",
        type=int,
        default=6,
        help="Pixels above detected door bottom where counting line is placed",
    )
    parser.add_argument(
        "--door-gate-max-angle",
        type=float,
        default=35.0,
        help="Maximum absolute gate angle in degrees before falling back",
    )
    parser.add_argument(
        "--door-gate-min-bottom-ratio",
        type=float,
        default=0.55,
        help="Require fitted gate endpoints to lie in the lower fraction of door box",
    )
    parser.add_argument(
        "--door-refresh-frames",
        type=int,
        default=30,
        help="Re-run auto door detection every N frames (default: 30)",
    )
    parser.add_argument(
        "--door-refresh-seconds",
        type=float,
        default=1.0,
        help="Re-run auto door detection every N seconds (default: 1.0)",
    )
    parser.add_argument(
        "--door-nms-iou",
        type=float,
        default=0.45,
        help="NMS IoU threshold used to merge duplicate door detections (default: 0.45)",
    )
    parser.add_argument(
        "--door-negative-iou",
        type=float,
        default=0.40,
        help="Reject a door candidate if IoU with a negative box exceeds this value",
    )
    parser.add_argument(
        "--door-max-height-ratio",
        type=float,
        default=0.93,
        help="Reject candidates taller than this fraction of frame height",
    )
    parser.add_argument(
        "--door-require-edge-threshold",
        action="store_true",
        help="Accept only doors whose bottom threshold was found by edge fitting",
    )
    parser.add_argument(
        "--door-split-wide-boxes",
        action="store_true",
        help="Try splitting very wide door detections into two side-by-side door candidates",
    )
    parser.add_argument(
        "--door-split-ratio",
        type=float,
        default=1.35,
        help="Attempt split when door box width/height is above this ratio",
    )
    parser.add_argument(
        "--lock-doors-on-detect",
        action="store_true",
        help="Freeze detected doors after the first successful auto-detection",
    )
    parser.add_argument(
        "--door-preprocess",
        choices=("none", "clahe"),
        default="none",
        help="Preprocess frame for door detection (default: none)",
    )
    parser.add_argument(
        "--door-gamma",
        type=float,
        default=1.0,
        help="Gamma correction for door detection frame (default: 1.0)",
    )
    parser.add_argument(
        "--debug-doors",
        action="store_true",
        help="Enable detailed door detection logs and draw candidate boxes",
    )
    parser.add_argument(
        "--debug-door-max-draw",
        type=int,
        default=30,
        help="Max candidate boxes to draw in debug mode",
    )
    parser.add_argument(
        "--line-x1",
        type=int,
        default=None,
        help="Left X-coordinate of the counting line segment (default: full width)",
    )
    parser.add_argument(
        "--line-x2",
        type=int,
        default=None,
        help="Right X-coordinate of the counting line segment (default: full width)",
    )
    parser.add_argument(
        "--line-thickness",
        type=int,
        default=2,
        help="Thickness of the drawn counting line",
    )
    parser.add_argument(
        "--direction",
        choices=("down", "up"),
        default="down",
        help="Entry direction relative to line crossing",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.35,
        help="Detection confidence threshold",
    )
    parser.add_argument(
        "--line-margin",
        type=int,
        default=6,
        help="Dead-zone around the line to reduce jitter double-counts",
    )
    parser.add_argument(
        "--initial-occupancy",
        type=int,
        default=0,
        help="Starting number of people already in the room",
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
    return parser.parse_args()


def side_of_line(y: float, line_y: int, margin: int) -> int:
    """
    Return which side of the horizontal line a point is on.

    -1: clearly above line
     0: in dead-zone near line (ignore to avoid jitter)
    +1: clearly below line
    """
    if y < line_y - margin:
        return -1
    if y > line_y + margin:
        return 1
    return 0


def side_of_gate(x: float, y: float, room: RoomConfig, margin: int) -> int:
    """
    Return which side of a gate segment a point is on.

    For non-vertical gates, compare y against the gate y-value at point x.
    For vertical gates, fall back to point x against gate x.
    """
    x1, y1 = room.gate_x1, room.gate_y1
    x2, y2 = room.gate_x2, room.gate_y2

    min_x, max_x = min(x1, x2), max(x1, x2)
    # Ignore points that are clearly outside gate span in X.
    if x < (min_x - margin) or x > (max_x + margin):
        return 0

    dx = x2 - x1
    if dx == 0:
        # Vertical gate: side is left/right of gate x.
        if x < x1 - margin:
            return -1
        if x > x1 + margin:
            return 1
        return 0

    t = (x - x1) / dx
    y_on_gate = y1 + t * (y2 - y1)
    if y < y_on_gate - margin:
        return -1
    if y > y_on_gate + margin:
        return 1
    return 0


def crossing_direction(prev_side: int, curr_side: int) -> str | None:
    """Infer crossing direction from side transition."""
    if prev_side == -1 and curr_side == 1:
        return "down"
    if prev_side == 1 and curr_side == -1:
        return "up"
    return None


def clamp_segment(x1: int, x2: int, width: int) -> tuple[int, int]:
    """Clamp and sort segment endpoints into frame width."""
    cx1 = max(0, min(width, x1))
    cx2 = max(0, min(width, x2))
    if cx1 > cx2:
        cx1, cx2 = cx2, cx1
    return cx1, cx2


def fit_gate_line_from_box(
    frame,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    line_offset: int,
    max_angle_deg: float,
    min_bottom_ratio: float,
) -> tuple[int, int, int, int, str]:
    """
    Estimate a doorway threshold line from edges inside a detected door box.

    Returns (gx1, gy1, gx2, gy2, source), where source describes whether
    we used an edge-based estimate or a horizontal fallback.
    """
    h, w = frame.shape[:2]
    x1 = max(0, min(w - 1, x1))
    x2 = max(0, min(w - 1, x2))
    y1 = max(0, min(h - 1, y1))
    y2 = max(0, min(h - 1, y2))
    if x2 <= x1 or y2 <= y1:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=20,
        minLineLength=max(20, int((x2 - x1) * 0.35)),
        maxLineGap=15,
    )

    best = None
    best_score = -1.0
    max_angle_deg = max(5.0, min(80.0, float(max_angle_deg)))
    min_bottom_ratio = max(0.2, min(0.95, float(min_bottom_ratio)))
    if lines is not None:
        roi_h = y2 - y1
        for line in lines:
            lx1, ly1, lx2, ly2 = line[0]
            dx = lx2 - lx1
            dy = ly2 - ly1
            length = float(np.hypot(dx, dy))
            if length < max(20.0, (x2 - x1) * 0.35):
                continue
            # Prefer near-horizontal edges likely to be threshold lines.
            angle = abs(np.degrees(np.arctan2(dy, dx)))
            if angle > max_angle_deg:
                continue
            y_mid = (ly1 + ly2) / 2.0
            if y_mid < roi_h * min_bottom_ratio:
                continue
            score = y_mid * 2.0 + length
            if score > best_score:
                best_score = score
                best = (lx1, ly1, lx2, ly2)

    if best is None:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    lx1, ly1, lx2, ly2 = best
    roi_w = x2 - x1
    roi_h = y2 - y1
    dx = lx2 - lx1
    if dx == 0:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"
    m = (ly2 - ly1) / float(dx)
    # Extend fitted line to full door-box width for stable crossing.
    ly_left = ly1 + (0 - lx1) * m
    ly_right = ly1 + ((roi_w - 1) - lx1) * m
    # Reject if endpoints are not in lower door region.
    if min(ly_left, ly_right) < (roi_h * min_bottom_ratio):
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    gx1 = x1
    gx2 = x2
    gy1 = y1 + int(round(ly_left)) - line_offset
    gy2 = y1 + int(round(ly_right)) - line_offset
    gy1 = max(0, min(h - 1, gy1))
    gy2 = max(0, min(h - 1, gy2))
    return gx1, gy1, gx2, gy2, "edge"


def preprocess_door_frame(args: argparse.Namespace, frame):
    """Apply optional preprocessing to help door detection in low-contrast scenes."""
    out = frame

    if args.door_preprocess == "clahe":
        lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l2 = clahe.apply(l)
        out = cv2.cvtColor(cv2.merge((l2, a, b)), cv2.COLOR_LAB2BGR)

    if args.door_gamma > 0 and abs(args.door_gamma - 1.0) > 1e-6:
        inv = 1.0 / args.door_gamma
        table = np.array([int(((i / 255.0) ** inv) * 255) for i in range(256)], dtype=np.uint8)
        out = cv2.LUT(out, table)

    return out


def parse_prompts(args: argparse.Namespace) -> list[str]:
    """Return detection prompts, preferring --door-prompts when supplied."""
    if args.door_prompts:
        prompts = [p.strip() for p in args.door_prompts.split(",") if p.strip()]
        if prompts:
            return prompts
    return [args.door_prompt]


def parse_negative_prompts(args: argparse.Namespace) -> list[str]:
    """Return negative prompts used to reject door-like false positives."""
    if args.door_negative_prompts:
        return [p.strip() for p in args.door_negative_prompts.split(",") if p.strip()]
    return []


def collect_prompt_detections(
    door_model: YOLO,
    image,
    prompts: list[str],
    conf: float,
) -> list[tuple[float, list[float], str]]:
    """Run prompt-conditioned detections and return (conf, box, prompt) tuples."""
    out: list[tuple[float, list[float], str]] = []
    for prompt in prompts:
        if hasattr(door_model, "set_classes"):
            door_model.set_classes([prompt])
        results = door_model.predict(
            source=image,
            conf=conf,
            verbose=False,
        )
        result = results[0]
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            continue
        xyxy = boxes.xyxy.cpu().tolist()
        confs = boxes.conf.cpu().tolist() if boxes.conf is not None else [0.0] * len(xyxy)
        out.extend((score, box, prompt) for score, box in zip(confs, xyxy))
    return out


def box_iou_xyxy(a: list[float], b: list[float]) -> float:
    """Compute IoU for two [x1, y1, x2, y2] boxes."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    iw = max(0.0, inter_x2 - inter_x1)
    ih = max(0.0, inter_y2 - inter_y1)
    inter = iw * ih
    if inter <= 0.0:
        return 0.0
    a_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    b_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    denom = a_area + b_area - inter
    if denom <= 0.0:
        return 0.0
    return inter / denom


def nms_detections(
    detections: list[tuple[float, list[float], str]],
    iou_threshold: float,
) -> list[tuple[float, list[float], str]]:
    """Class-agnostic NMS across prompts so the same door isn't repeated."""
    if not detections:
        return []
    items = sorted(detections, key=lambda it: it[0], reverse=True)
    kept: list[tuple[float, list[float], str]] = []
    for cand in items:
        _, box, _ = cand
        if any(box_iou_xyxy(box, kept_box) >= iou_threshold for _, kept_box, _ in kept):
            continue
        kept.append(cand)
    return kept


def split_wide_detection_box(
    frame,
    box: list[float],
    min_width: int,
    split_ratio: float,
) -> list[list[float]]:
    """
    Split a very wide detection into two boxes if a central vertical divider exists.

    This helps when two adjacent angled doors are merged into one detection.
    """
    h, w = frame.shape[:2]
    x1f, y1f, x2f, y2f = box
    x1 = max(0, min(w - 1, int(x1f)))
    x2 = max(0, min(w - 1, int(x2f)))
    y1 = max(0, min(h - 1, int(y1f)))
    y2 = max(0, min(h - 1, int(y2f)))
    bw = x2 - x1
    bh = y2 - y1
    if bw <= 0 or bh <= 0:
        return [box]
    if bh == 0 or (bw / float(bh)) < max(1.0, split_ratio):
        return [box]

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return [box]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    # Vertical-edge energy per column.
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    col_energy = np.mean(np.abs(grad_x), axis=0)
    if col_energy.size < 8:
        return [box]

    left = int(col_energy.size * 0.25)
    right = int(col_energy.size * 0.75)
    if right <= left + 2:
        return [box]
    center_band = col_energy[left:right]
    peak_idx_local = int(np.argmax(center_band))
    peak_idx = left + peak_idx_local

    mean_e = float(np.mean(col_energy))
    std_e = float(np.std(col_energy))
    peak_e = float(col_energy[peak_idx])
    if peak_e < (mean_e + 0.6 * std_e):
        return [box]

    split_x = x1 + peak_idx
    min_part = max(12, int(min_width))
    if (split_x - x1) < min_part or (x2 - split_x) < min_part:
        return [box]

    return [
        [float(x1), float(y1), float(split_x), float(y2)],
        [float(split_x), float(y1), float(x2), float(y2)],
    ]


def detect_doors_from_frame(
    args: argparse.Namespace, frame, width: int, height: int, door_model: YOLO
) -> tuple[list[RoomConfig], list[DoorCandidate]]:
    """Detect doors in a frame and create RoomConfig entries."""
    input_frame = preprocess_door_frame(args, frame)
    prompts = parse_prompts(args)
    detections = collect_prompt_detections(door_model, input_frame, prompts, args.door_conf)
    negative_prompts = parse_negative_prompts(args)
    negative_detections: list[tuple[float, list[float], str]] = []
    if negative_prompts and args.door_negative_conf > 0:
        negative_detections = collect_prompt_detections(
            door_model,
            input_frame,
            negative_prompts,
            args.door_negative_conf,
        )
        negative_detections = nms_detections(
            negative_detections, max(0.0, min(0.95, args.door_nms_iou))
        )
    negative_boxes = [box for _, box, _ in negative_detections]

    if not detections:
        print("[door-status] NOT CONNECTED: no doors detected in this frame.")
        if args.debug_doors:
            print(
                f"[door-debug] prompts={prompts} conf>={args.door_conf} produced 0 boxes "
                f"(negative_prompts={negative_prompts})"
            )
        print(
            "[door-status] Continuing without door lines. "
            "Try lower --door-conf, another --door-model, or --rooms-config."
        )
        return [], []

    detections = nms_detections(detections, max(0.0, min(0.95, args.door_nms_iou)))
    if args.door_split_wide_boxes:
        split_detections: list[tuple[float, list[float], str]] = []
        for conf, box, prompt in detections:
            parts = split_wide_detection_box(
                input_frame,
                box,
                min_width=args.door_min_width,
                split_ratio=args.door_split_ratio,
            )
            for part in parts:
                split_detections.append((conf, part, prompt))
        detections = nms_detections(
            split_detections, max(0.0, min(0.95, args.door_nms_iou))
        )
    detections.sort(key=lambda item: item[0], reverse=True)

    rooms: list[RoomConfig] = []
    candidates: list[DoorCandidate] = []
    max_height_ratio = max(0.0, min(1.0, args.door_max_height_ratio))
    neg_iou = max(0.0, min(1.0, args.door_negative_iou))
    for conf, (x1f, y1f, x2f, y2f), prompt in detections:
        if len(rooms) >= max(1, args.max_doors):
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="max_doors_reached",
                )
            )
            continue

        x1, x2 = clamp_segment(int(x1f), int(x2f), width)
        if (x2 - x1) < args.door_min_width:
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="too_narrow",
                )
            )
            continue

        cand_h = max(1.0, float(y2f - y1f))
        if (cand_h / float(height)) > max_height_ratio:
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="too_tall_for_door",
                )
            )
            continue

        overlaps_negative = any(
            box_iou_xyxy([x1f, y1f, x2f, y2f], neg_box) >= neg_iou for neg_box in negative_boxes
        )
        if overlaps_negative:
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="overlaps_negative_prompt",
                )
            )
            continue

        gx1, gy1, gx2, gy2, gate_source = fit_gate_line_from_box(
            input_frame,
            int(x1f),
            int(y1f),
            int(x2f),
            int(y2f),
            args.door_line_offset,
            args.door_gate_max_angle,
            args.door_gate_min_bottom_ratio,
        )
        if args.door_require_edge_threshold and gate_source != "edge":
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="missing_threshold_edge",
                )
            )
            continue

        rooms.append(
            RoomConfig(
                room_id="",
                gate_x1=gx1,
                gate_y1=gy1,
                gate_x2=gx2,
                gate_y2=gy2,
                direction=args.direction,
                line_margin=args.line_margin,
                initial_occupancy=args.initial_occupancy,
                line_thickness=max(1, args.line_thickness),
            )
        )
        candidates.append(
            DoorCandidate(
                x1=int(x1f),
                y1=int(y1f),
                x2=int(x2f),
                y2=int(y2f),
                conf=float(conf),
                prompt=prompt,
                accepted=True,
                reason=f"accepted_{gate_source}",
            )
        )

    if not rooms:
        print("[door-status] NOT CONNECTED: door candidates were filtered out.")
        if args.debug_doors:
            narrow = sum(1 for c in candidates if c.reason == "too_narrow")
            too_tall = sum(1 for c in candidates if c.reason == "too_tall_for_door")
            neg_overlap = sum(1 for c in candidates if c.reason == "overlaps_negative_prompt")
            missing_edge = sum(1 for c in candidates if c.reason == "missing_threshold_edge")
            print(
                f"[door-debug] raw={len(detections)} too_narrow={narrow} "
                f"too_tall={too_tall} neg_overlap={neg_overlap} "
                f"missing_edge={missing_edge} max_doors_reached=0 accepted=0 "
                f"min_width={args.door_min_width}"
            )
        print(
            "[door-status] Continuing without door lines. "
            "Try lower --door-min-width or use --rooms-config."
        )
        return [], candidates

    # Assign stable room IDs left-to-right to reduce ID reshuffle across refreshes.
    rooms.sort(key=lambda r: ((r.gate_x1 + r.gate_x2) / 2.0))
    for idx, room in enumerate(rooms, start=1):
        room.room_id = f"room_{idx}"

    print(f"[door-status] CONNECTED: detected {len(rooms)} door(s).")
    if args.debug_doors:
        narrow = sum(1 for c in candidates if c.reason == "too_narrow")
        over = sum(1 for c in candidates if c.reason == "max_doors_reached")
        too_tall = sum(1 for c in candidates if c.reason == "too_tall_for_door")
        neg_overlap = sum(1 for c in candidates if c.reason == "overlaps_negative_prompt")
        missing_edge = sum(1 for c in candidates if c.reason == "missing_threshold_edge")
        print(
            f"[door-debug] raw={len(detections)} accepted={len(rooms)} "
            f"too_narrow={narrow} too_tall={too_tall} neg_overlap={neg_overlap} "
            f"missing_edge={missing_edge} max_doors_reached={over} "
            f"neg_boxes={len(negative_boxes)} "
            f"preprocess={args.door_preprocess} gamma={args.door_gamma}"
        )
    for room in rooms:
        print(
            f"[door-status] {room.room_id}: "
            f"({room.gate_x1},{room.gate_y1}) -> ({room.gate_x2},{room.gate_y2})"
        )
    return rooms, candidates


def load_rooms(
    args: argparse.Namespace, width: int, height: int, first_frame, door_model: YOLO | None
) -> tuple[list[RoomConfig], list[DoorCandidate]]:
    """Build room configs from JSON (multi-room) or CLI (single-room fallback)."""
    if args.rooms_config:
        with open(args.rooms_config, "r", encoding="utf-8") as f:
            payload = json.load(f)
        room_items = payload.get("rooms", payload) if isinstance(payload, dict) else payload
        if not isinstance(room_items, list) or not room_items:
            raise ValueError("rooms-config must contain a non-empty list of rooms.")

        rooms: list[RoomConfig] = []
        for idx, item in enumerate(room_items, start=1):
            if not isinstance(item, dict):
                raise ValueError(f"Room #{idx} must be an object.")

            room_id = str(item.get("room_id", item.get("id", f"room_{idx}")))
            has_gate_points = all(
                k in item for k in ("gate_x1", "gate_y1", "gate_x2", "gate_y2")
            )
            if has_gate_points:
                gx1 = int(item["gate_x1"])
                gy1 = int(item["gate_y1"])
                gx2 = int(item["gate_x2"])
                gy2 = int(item["gate_y2"])
            else:
                if "line" not in item:
                    raise ValueError(
                        f"Room #{idx} must include either gate points or a line field."
                    )
                line_y = int(item["line"])
                x1 = int(item.get("x1", 0))
                x2 = int(item.get("x2", width))
                x1, x2 = clamp_segment(x1, x2, width)
                gx1, gy1, gx2, gy2 = x1, line_y, x2, line_y
            direction = str(item.get("direction", args.direction))
            if direction not in {"down", "up"}:
                raise ValueError(f"{room_id}: direction must be 'down' or 'up'.")
            line_margin = int(item.get("line_margin", args.line_margin))
            initial_occupancy = int(item.get("initial_occupancy", 0))
            line_thickness = max(1, int(item.get("line_thickness", args.line_thickness)))

            rooms.append(
                RoomConfig(
                    room_id=room_id,
                    gate_x1=gx1,
                    gate_y1=gy1,
                    gate_x2=gx2,
                    gate_y2=gy2,
                    direction=direction,
                    line_margin=line_margin,
                    initial_occupancy=initial_occupancy,
                    line_thickness=line_thickness,
                )
            )
        return rooms, []

    if args.auto_detect_doors:
        if door_model is None:
            raise RuntimeError("Auto door detection requested, but door model was not initialized.")
        return detect_doors_from_frame(args, first_frame, width, height, door_model)

    if args.line is None:
        raise ValueError("Set --line for single-room mode, or provide --rooms-config.")
    if (args.line_x1 is None) != (args.line_x2 is None):
        raise ValueError("Set both --line-x1 and --line-x2, or neither.")
    if args.line_x1 is None:
        x1, x2 = 0, width
    else:
        x1, x2 = clamp_segment(args.line_x1, args.line_x2, width)

    return (
        [
            RoomConfig(
                room_id="room_1",
                gate_x1=x1,
                gate_y1=args.line,
                gate_x2=x2,
                gate_y2=args.line,
                direction=args.direction,
                line_margin=args.line_margin,
                initial_occupancy=args.initial_occupancy,
                line_thickness=max(1, args.line_thickness),
            )
        ],
        [],
    )


def draw_door_debug_overlay(
    frame, candidates: list[DoorCandidate], max_draw: int
) -> None:
    """Draw accepted/rejected door candidates with reasons and confidence."""
    draw_items = candidates[: max(0, max_draw)]
    for cand in draw_items:
        color = (0, 200, 0) if cand.accepted else (0, 128, 255)
        cv2.rectangle(frame, (cand.x1, cand.y1), (cand.x2, cand.y2), color, 2)
        label = f"{cand.prompt} {cand.conf:.2f} {cand.reason}"
        cv2.putText(
            frame,
            label,
            (cand.x1, max(15, cand.y1 - 6)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            color,
            1,
        )


def main() -> None:
    # Parse CLI inputs once at startup.
    args = parse_args()
    # Load YOLO model (e.g., yolov8n.pt). This will download weights if needed.
    model = YOLO(args.model)

    # Open the input video stream.
    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {args.video}")

    # Read source video properties so overlays/output match input dimensions.
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # Read first frame for auto door detection and process it in the main loop.
    ok, first_frame = cap.read()
    if not ok:
        raise RuntimeError(f"Cannot read first frame from video: {args.video}")

    door_model = None
    if args.auto_detect_doors and not args.rooms_config:
        door_model = YOLO(args.door_model)
        # YOLO-World supports open-vocabulary prompts through set_classes.
        if hasattr(door_model, "set_classes"):
            door_model.set_classes([args.door_prompt])

    rooms, latest_door_candidates = load_rooms(args, width, height, first_frame, door_model)
    doors_locked = bool(
        args.auto_detect_doors
        and not args.rooms_config
        and args.lock_doors_on_detect
        and rooms
    )
    if doors_locked:
        print(f"[door-status] LOCKED: using {len(rooms)} detected door(s) for this run.")

    # Optional writer for annotated output video.
    writer = None
    if args.save:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.save, fourcc, fps, (width, height))

    # Per-track memory: {track_id -> TrackState}.
    track_states: dict[int, TrackState] = {}
    room_stats: dict[str, RoomStats] = {room.room_id: RoomStats() for room in rooms}
    prev_room_signature = [
        (
            room.room_id,
            room.gate_x1,
            room.gate_y1,
            room.gate_x2,
            room.gate_y2,
            room.direction,
            room.line_margin,
        )
        for room in rooms
    ]
    frame_index = 0

    # Main processing loop: frame-by-frame inference and counting.
    while True:
        if first_frame is not None:
            frame = first_frame
            first_frame = None
            ok = True
        else:
            ok, frame = cap.read()
        if not ok:
            # End of file or read error.
            break

        if (
            args.auto_detect_doors
            and not args.rooms_config
            and door_model is not None
            and not doors_locked
        ):
            if args.door_refresh_seconds is not None:
                refresh_n = max(1, int(round(max(0.05, args.door_refresh_seconds) * fps)))
            else:
                refresh_n = max(1, args.door_refresh_frames)
            should_refresh = (frame_index % refresh_n == 0)
            if should_refresh:
                new_rooms, latest_door_candidates = detect_doors_from_frame(
                    args, frame, width, height, door_model
                )
                if new_rooms:
                    # Prefer updates that discover at least as many doors as current set.
                    chosen_rooms = new_rooms if len(new_rooms) >= len(rooms) else rooms
                    for room in chosen_rooms:
                        room_stats.setdefault(room.room_id, RoomStats())
                    new_signature = [
                        (
                            room.room_id,
                            room.gate_x1,
                            room.gate_y1,
                            room.gate_x2,
                            room.gate_y2,
                            room.direction,
                            room.line_margin,
                        )
                        for room in chosen_rooms
                    ]
                    if new_signature != prev_room_signature:
                        track_states.clear()
                        prev_room_signature = new_signature
                    rooms = chosen_rooms
                    if args.lock_doors_on_detect:
                        doors_locked = True
                        print(
                            f"[door-status] LOCKED: using {len(rooms)} detected door(s) for this run."
                        )

        # Run detection + tracking on this frame.
        # classes=[0] restricts detections to "person" (COCO class 0).
        # persist=True keeps tracker state between consecutive calls.
        results = model.track(
            source=frame,
            conf=args.conf,
            classes=[0],  # class 0 = person in COCO
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False,
        )

        result = results[0]
        boxes = result.boxes

        # boxes.id can be None if tracker has no valid IDs in this frame.
        if boxes is not None and boxes.id is not None:
            # Convert tensors to plain Python lists for simple iteration.
            ids = boxes.id.int().cpu().tolist()
            xyxy = boxes.xyxy.cpu().tolist()

            for tid, (x1, y1, x2, y2) in zip(ids, xyxy):
                # Use bottom-center (feet area) for doorway crossing.
                foot_x = (x1 + x2) / 2
                foot_y = y2
                # Create state on first sight of this track ID.
                state = track_states.setdefault(tid, TrackState())

                for room in rooms:
                    curr_side = side_of_gate(foot_x, foot_y, room, room.line_margin)
                    prev_side = state.last_side_by_room.get(room.room_id)

                    if prev_side is None:
                        if curr_side != 0:
                            state.last_side_by_room[room.room_id] = curr_side
                    else:
                        # Only evaluate a crossing when current side is stable.
                        if curr_side != 0 and curr_side != prev_side:
                            direction = crossing_direction(prev_side, curr_side)
                            if direction == room.direction:
                                room_stats[room.room_id].entered += 1
                            elif direction is not None:
                                room_stats[room.room_id].left += 1
                            state.last_side_by_room[room.room_id] = curr_side
                        elif curr_side != 0:
                            state.last_side_by_room[room.room_id] = curr_side

                # Draw tracked person box + ID label for debugging/visibility.
                color = (0, 255, 0)
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                cv2.circle(frame, (int((x1 + x2) / 2), int(foot_y)), 4, (0, 255, 255), -1)
                cv2.putText(
                    frame,
                    f"ID {tid}",
                    (int(x1), max(20, int(y1) - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    color,
                    2,
                )

        # Draw configured counting lines.
        for room in rooms:
            cv2.line(
                frame,
                (room.gate_x1, room.gate_y1),
                (room.gate_x2, room.gate_y2),
                (0, 0, 255),
                room.line_thickness,
            )

        if args.auto_detect_doors and not rooms:
            cv2.putText(
                frame,
                "No doors detected (counting disabled)",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2,
            )
        if args.debug_doors and args.auto_detect_doors:
            draw_door_debug_overlay(frame, latest_door_candidates, args.debug_door_max_draw)

        # Draw per-room running totals.
        text_y = 40
        for room in rooms:
            stats = room_stats[room.room_id]
            occupancy = max(0, room.initial_occupancy + stats.entered - stats.left)
            cv2.putText(
                frame,
                (
                    f"{room.room_id}: In={occupancy} "
                    f"(+{stats.entered}/-{stats.left}, dir={room.direction})"
                ),
                (20, text_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                (0, 255, 255),
                2,
            )
            text_y += 30

        # Optionally display live results.
        if args.show:
            cv2.imshow("People Counter", frame)
            # Press 'q' to stop early.
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        # Optionally save annotated frame to output file.
        if writer is not None:
            writer.write(frame)
        frame_index += 1

    # Always release resources.
    cap.release()
    if writer is not None:
        writer.release()
    cv2.destroyAllWindows()

    # Final terminal summary per room.
    print("Final room summary:")
    if not rooms:
        print("  No rooms active (no doors detected).")
    else:
        for room in rooms:
            stats = room_stats[room.room_id]
            occupancy = max(0, room.initial_occupancy + stats.entered - stats.left)
            print(
                f"  {room.room_id}: "
                f"entered={stats.entered}, left={stats.left}, occupancy={occupancy}"
            )


if __name__ == "__main__":
    main()
