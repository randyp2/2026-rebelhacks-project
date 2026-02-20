"""
SafeStay AI — Computer Vision Pipeline Entry Point

Runs a continuous detection loop:
  1. Open the camera / video source
  2. For each frame, run YOLOv8 person detection via Detector
  3. Record the DetectionResult via Ingestor
  4. Flush metadata to Supabase every INGEST_INTERVAL_SECONDS
  5. Discard the frame — no video is stored

Usage:
    python main.py

Environment variables (see config.py):
    SUPABASE_URL, SUPABASE_SERVICE_KEY, CAMERA_SOURCE,
    ROOM_ZONE_MAP, YOLO_MODEL, INGEST_INTERVAL_SECONDS

TODO: Implement the run() function
"""

import time
import signal
import sys

# TODO: import cv2
from config import (
    CAMERA_SOURCE,
    YOLO_MODEL,
    CONFIDENCE_THRESHOLD,
    INGEST_INTERVAL_SECONDS,
    ROOM_ZONE_MAP,
)
from detector import Detector
from ingestor import Ingestor


def run() -> None:
    """
    Main detection loop.

    TODO:
        1. Open cv2.VideoCapture(CAMERA_SOURCE)
        2. For each room zone in ROOM_ZONE_MAP, create a Detector instance
        3. Create an Ingestor instance
        4. Enter the read loop:
             a. cap.read() → frame
             b. For each detector, call detector.process_frame(frame)
             c. ingestor.record(result)
             d. Every INGEST_INTERVAL_SECONDS, call ingestor.flush()
             e. Discard frame
        5. On SIGINT/SIGTERM, call ingestor.flush() and exit cleanly
    """
    # TODO: implement
    print("SafeStay AI CV pipeline starting...")
    print(f"  Camera source: {CAMERA_SOURCE}")
    print(f"  YOLO model: {YOLO_MODEL}")
    print(f"  Ingest interval: {INGEST_INTERVAL_SECONDS}s")
    print(f"  Room zones: {ROOM_ZONE_MAP}")
    print("TODO: implement detection loop")


if __name__ == "__main__":
    run()
