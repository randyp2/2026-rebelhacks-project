from __future__ import annotations

import cv2

from .models import DoorCandidate


def draw_door_debug_overlay(frame, candidates: list[DoorCandidate], max_draw: int) -> None:
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
