from __future__ import annotations

import cv2
from ultralytics import YOLO

from .cli import parse_args
from .door_detection import detect_doors_from_frame
from .geometry import crossing_direction, side_of_gate
from .models import RoomStats, TrackState
from .rendering import draw_door_debug_overlay
from .room_config import load_rooms


def _room_signature(rooms) -> list[tuple[str, int, int, int, int, str, int]]:
    return [
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


def run_people_counter() -> None:
    args = parse_args()
    model = YOLO(args.model)

    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {args.video}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    ok, first_frame = cap.read()
    if not ok:
        raise RuntimeError(f"Cannot read first frame from video: {args.video}")

    door_model = None
    if args.auto_detect_doors and not args.rooms_config:
        door_model = YOLO(args.door_model)
        if hasattr(door_model, "set_classes"):
            door_model.set_classes([args.door_prompt])

    rooms, latest_door_candidates = load_rooms(args, width, height, first_frame, door_model)
    doors_locked = bool(
        args.auto_detect_doors and not args.rooms_config and args.lock_doors_on_detect and rooms
    )
    if doors_locked:
        print(f"[door-status] LOCKED: using {len(rooms)} detected door(s) for this run.")

    writer = None
    if args.save:
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(args.save, fourcc, fps, (width, height))

    track_states: dict[int, TrackState] = {}
    room_stats: dict[str, RoomStats] = {room.room_id: RoomStats() for room in rooms}
    prev_room_signature = _room_signature(rooms)
    frame_index = 0

    while True:
        if first_frame is not None:
            frame = first_frame
            first_frame = None
            ok = True
        else:
            ok, frame = cap.read()
        if not ok:
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
            should_refresh = frame_index % refresh_n == 0
            if should_refresh:
                new_rooms, latest_door_candidates = detect_doors_from_frame(
                    args,
                    frame,
                    width,
                    height,
                    door_model,
                )
                if new_rooms:
                    chosen_rooms = new_rooms if len(new_rooms) >= len(rooms) else rooms
                    for room in chosen_rooms:
                        room_stats.setdefault(room.room_id, RoomStats())
                    new_signature = _room_signature(chosen_rooms)
                    if new_signature != prev_room_signature:
                        track_states.clear()
                        prev_room_signature = new_signature
                    rooms = chosen_rooms
                    if args.lock_doors_on_detect:
                        doors_locked = True
                        print(
                            f"[door-status] LOCKED: using {len(rooms)} detected door(s) for this run."
                        )

        results = model.track(
            source=frame,
            conf=args.conf,
            classes=[0],
            persist=True,
            tracker="bytetrack.yaml",
            verbose=False,
        )

        result = results[0]
        boxes = result.boxes

        if boxes is not None and boxes.id is not None:
            ids = boxes.id.int().cpu().tolist()
            xyxy = boxes.xyxy.cpu().tolist()

            for tid, (x1, y1, x2, y2) in zip(ids, xyxy):
                foot_x = (x1 + x2) / 2
                foot_y = y2
                state = track_states.setdefault(tid, TrackState())

                for room in rooms:
                    curr_side = side_of_gate(
                        foot_x,
                        foot_y,
                        room.gate_x1,
                        room.gate_y1,
                        room.gate_x2,
                        room.gate_y2,
                        room.line_margin,
                    )
                    prev_side = state.last_side_by_room.get(room.room_id)

                    if prev_side is None:
                        if curr_side != 0:
                            state.last_side_by_room[room.room_id] = curr_side
                    else:
                        if curr_side != 0 and curr_side != prev_side:
                            direction = crossing_direction(prev_side, curr_side)
                            if direction == room.direction:
                                room_stats[room.room_id].entered += 1
                            elif direction is not None:
                                room_stats[room.room_id].left += 1
                            state.last_side_by_room[room.room_id] = curr_side
                        elif curr_side != 0:
                            state.last_side_by_room[room.room_id] = curr_side

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

        if args.show:
            cv2.imshow("People Counter", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        if writer is not None:
            writer.write(frame)
        frame_index += 1

    cap.release()
    if writer is not None:
        writer.release()
    cv2.destroyAllWindows()

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
