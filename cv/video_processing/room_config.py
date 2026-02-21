from __future__ import annotations

import argparse
import json

from ultralytics import YOLO

from .door_detection import detect_doors_from_frame
from .geometry import clamp_segment
from .models import DoorCandidate, RoomConfig


def load_rooms(
    args: argparse.Namespace,
    width: int,
    height: int,
    first_frame,
    door_model: YOLO | None,
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
