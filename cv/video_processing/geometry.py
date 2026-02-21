from __future__ import annotations


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


def side_of_gate(x: float, y: float, x1: int, y1: int, x2: int, y2: int, margin: int) -> int:
    """
    Return which side of a gate segment a point is on.

    For non-vertical gates, compare y against the gate y-value at point x.
    For vertical gates, fall back to point x against gate x.
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
