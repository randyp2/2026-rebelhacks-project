"""
YOLOv8 person detector for SafeStay AI.

Responsibilities:
- Load a YOLOv8 model once at startup
- Accept a single video frame and return detection metadata
- Count only "person" class bounding boxes above the confidence threshold
- Track entry events (person crossing the room-zone boundary line)
- Discard all frames after metadata extraction — no images are stored

TODO: Implement the Detector class
"""

from dataclasses import dataclass
from datetime import datetime

# TODO: from ultralytics import YOLO
# TODO: import cv2


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
        # TODO: self.model = YOLO(model_path)
        # TODO: initialize boundary line tracker for entry counting

    def process_frame(self, frame: object) -> DetectionResult:
        """
        Run inference on a single frame.

        Args:
            frame: numpy array (H x W x 3 BGR) from OpenCV

        Returns:
            DetectionResult with person_count and entry_event.
            The frame is NOT stored.

        TODO:
            1. Run self.model(frame, conf=self.confidence, classes=[0])
               (class 0 = "person" in COCO)
            2. Count bounding boxes → person_count
            3. Check if any box centroid crossed the virtual boundary line
               to determine entry_event
            4. Return DetectionResult; discard frame
        """
        # TODO: implement
        return DetectionResult(
            room_id=self.room_id,
            timestamp=datetime.utcnow(),
            person_count=0,
            entry_event=False,
        )
