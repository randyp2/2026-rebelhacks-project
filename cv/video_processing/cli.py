from __future__ import annotations

import argparse


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
