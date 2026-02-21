"""
Detect and track people in a video, with an optional fixed counting line.

This script intentionally contains no door detection. It runs frame-by-frame
person detection (COCO class 0) and tracks identities across frames using
Ultralytics' built-in trackers.

If a counting line is configured, it counts an entry/exit when a tracked
person's foot point (bottom-center of the box) crosses the line.

Usage:
  python people_counter.py --video input.mp4 --show
  python people_counter.py --video input.mp4 --save out.mp4
  python people_counter.py --video input.mp4 --tracker botsort.yaml --show
  python people_counter.py --video input.mp4 --line-x1 100 --line-y1 500 --line-x2 400 --line-y2 500 --show
"""

from __future__ import annotations

import argparse

import cv2
from ultralytics import YOLO

# ADJUST RED LINE HERE 
# Default counting line (pixels). Edit these when changing camera/door setup.
DEFAULT_LINE_X1 = 500
DEFAULT_LINE_Y1 = 620
DEFAULT_LINE_X2 = 700
DEFAULT_LINE_Y2 = 620


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


def crossing_direction(prev_side: int, curr_side: int) -> str | None:
    if prev_side == -1 and curr_side == 1:
        return "down"
    if prev_side == 1 and curr_side == -1:
        return "up"
    return None


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
        "--line-margin",
        type=int,
        default=12,
        help="Dead-zone around the line to reduce jitter double-counts",
    )
    parser.add_argument(
        "--line-thickness",
        type=int,
        default=4,
        help="Thickness of the drawn counting line",
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


def main() -> None:
    args = parse_args()

    model = YOLO(args.model)

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {args.video}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    line_args = (args.line_x1, args.line_y1, args.line_x2, args.line_y2)
    any_line = any(v is not None for v in line_args)
    all_line = all(v is not None for v in line_args)
    if any_line and not all_line:
        raise ValueError("Set all of --line-x1/--line-y1/--line-x2/--line-y2, or none.")

    # Default line: full-width horizontal line at ~75% of frame height.
    if all_line:
        lx1, ly1, lx2, ly2 = (int(args.line_x1), int(args.line_y1), int(args.line_x2), int(args.line_y2))
    else:
        lx1, ly1, lx2, ly2 = DEFAULT_LINE_X1, DEFAULT_LINE_Y1, DEFAULT_LINE_X2, DEFAULT_LINE_Y2

    lx1 = clamp_int(lx1, 0, max(0, width - 1))
    lx2 = clamp_int(lx2, 0, max(0, width - 1))
    ly1 = clamp_int(ly1, 0, max(0, height - 1))
    ly2 = clamp_int(ly2, 0, max(0, height - 1))

    writer = None
    if args.save:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.save, fourcc, fps, (width, height))

    frame_index = 0
    last_side_by_id: dict[int, int] = {}
    entered = 0
    left = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        # Draw counting line first so people overlay stays visible on top.
        cv2.line(
            frame,
            (lx1, ly1),
            (lx2, ly2),
            (0, 0, 255),
            max(1, int(args.line_thickness)),
        )

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
                cv2.circle(frame, (int(foot_x), int(foot_y)), 4, (0, 255, 255), -1)

                # Update counts only when we have a stable track ID.
                if tid_i is not None:
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

        occupancy = max(0, int(args.initial_occupancy) + entered - left)
        cv2.putText(
            frame,
            f"Occ={occupancy} (+{entered}/-{left})  People in frame: {people_in_frame}",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 255, 255),
            2,
        )

        if args.show:
            cv2.imshow("People Detector", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        if writer is not None:
            writer.write(frame)

        frame_index += 1

    cap.release()
    if writer is not None:
        writer.release()
    cv2.destroyAllWindows()

    print("Final summary:")
    print(f"  frames={frame_index}")
    print(f"  entered={entered}")
    print(f"  left={left}")
    print(f"  occupancy={max(0, int(args.initial_occupancy) + entered - left)}")


if __name__ == "__main__":
    main()
