from __future__ import annotations

from dataclasses import dataclass, field


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
