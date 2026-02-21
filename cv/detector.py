"""
YOLOv8 person detector for SafeStay AI.

Responsibilities:
- Load a YOLOv8 model once at startup
- Accept a single video frame and return detection metadata
- Count only "person" class bounding boxes above the confidence threshold
- Emit an entry event when occupancy changes from 0 -> >0
- Optionally call Next.js to check whether the room is high risk
"""

from __future__ import annotations

import argparse
import os
import signal
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import cv2
import requests
from dotenv import load_dotenv
from ultralytics import YOLO

load_dotenv()


@dataclass
class DetectionResult:
    """Metadata extracted from a single frame — no pixel data retained."""
    room_id: str
    timestamp: datetime
    person_count: int
    entry_event: bool  # True if a new entry crossing was detected this frame


class Detector:
    """
    Wraps a YOLOv8 model for per-frame person detection.

    Usage:
        detector = Detector(model_path="yolov8n.pt", room_id="304")
        result = detector.process_frame(frame)
    """

    def __init__(self, model_path: str, room_id: str, confidence: float = 0.4):
        self.room_id = room_id
        self.confidence = confidence
        self.model = YOLO(model_path)
        self._previous_person_count = 0

    def process_frame(self, frame: object) -> DetectionResult:
        """
        Run inference on a single frame.

        Args:
            frame: numpy array (H x W x 3 BGR) from OpenCV

        Returns:
            DetectionResult with person_count and entry_event.
            The frame is NOT stored.

        Current entry heuristic:
            - entry_event=True when person count transitions from 0 to >0.
        """
        results = self.model(frame, conf=self.confidence, classes=[0], verbose=False)
        boxes = results[0].boxes if results else None
        person_count = int(len(boxes)) if boxes is not None else 0
        entry_event = self._previous_person_count == 0 and person_count > 0
        self._previous_person_count = person_count

        return DetectionResult(
            room_id=self.room_id,
            timestamp=datetime.now(timezone.utc),
            person_count=person_count,
            entry_event=entry_event,
        )


def parse_camera_source(raw: str) -> int | str:
    return int(raw) if raw.isdigit() else raw


def check_room_high_risk(
    session: requests.Session,
    room_id: str,
    api_base_url: str,
    cv_api_key: str,
    timeout_seconds: int,
) -> dict[str, Any]:
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
        raise RuntimeError("Invalid room-risk response payload")
    return payload


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run person-entry detection and query room high-risk status.",
    )
    parser.add_argument("--room-id", required=True, help="Room identifier to tag detections")
    parser.add_argument("--model", default=os.getenv("YOLO_MODEL", "yolov8n.pt"))
    parser.add_argument("--source", default=os.getenv("CAMERA_SOURCE", "0"))
    parser.add_argument(
        "--confidence",
        type=float,
        default=float(os.getenv("CONFIDENCE_THRESHOLD", "0.4")),
    )
    parser.add_argument(
        "--next-api-base-url",
        default=os.getenv("NEXT_API_BASE_URL", "http://localhost:3000"),
    )
    parser.add_argument("--cv-api-key", default=os.getenv("CV_API_KEY", ""))
    parser.add_argument(
        "--risk-timeout-seconds",
        type=int,
        default=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "10")),
    )
    return parser


def run_detector() -> None:
    args = build_arg_parser().parse_args()

    if not args.cv_api_key:
        raise RuntimeError("Missing CV_API_KEY (env or --cv-api-key)")

    camera_source = parse_camera_source(args.source)
    cap = cv2.VideoCapture(camera_source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open source={args.source}")

    detector = Detector(model_path=args.model, room_id=args.room_id, confidence=args.confidence)
    should_stop = {"value": False}

    def handle_stop(signum: int, _frame: Any) -> None:
        print(f"\nSignal {signum} received, stopping detector...")
        should_stop["value"] = True

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    print("Detector started")
    print(f"  room_id={args.room_id}")
    print(f"  source={args.source}")
    print(f"  model={args.model}")
    print(f"  confidence={args.confidence}")
    print(f"  risk_check={args.next_api_base_url.rstrip('/')}/api/cv/room-risk")

    with requests.Session() as session:
        try:
            while not should_stop["value"]:
                ok, frame = cap.read()
                if not ok:
                    time.sleep(0.1)
                    continue

                result = detector.process_frame(frame)
                if not result.entry_event:
                    continue

                print(
                    "entry_event detected "
                    f"room_id={result.room_id} "
                    f"timestamp={result.timestamp.isoformat()} "
                    f"person_count={result.person_count}",
                )

                try:
                    risk_payload = check_room_high_risk(
                        session=session,
                        room_id=result.room_id,
                        api_base_url=args.next_api_base_url,
                        cv_api_key=args.cv_api_key,
                        timeout_seconds=args.risk_timeout_seconds,
                    )
                except (requests.RequestException, ValueError, RuntimeError) as error:
                    print(f"room-risk check failed room_id={result.room_id}: {error}")
                    continue

                print(
                    "room-risk result "
                    f"room_id={risk_payload.get('room_id')} "
                    f"found={risk_payload.get('found')} "
                    f"risk_score={risk_payload.get('risk_score')} "
                    f"threshold={risk_payload.get('risk_threshold')} "
                    f"is_high_risk={risk_payload.get('is_high_risk')}",
                )
        finally:
            cap.release()
            print("Detector stopped")


if __name__ == "__main__":
    run_detector()
