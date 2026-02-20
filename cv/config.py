"""
Configuration for the SafeStay AI computer vision pipeline.
Values are loaded from environment variables.
"""

import os

# TODO: load from .env file (use python-dotenv)
# Required environment variables:
#   SUPABASE_URL        — Supabase project URL
#   SUPABASE_SERVICE_KEY — service role key (bypasses RLS for CV ingestion)
#   CAMERA_SOURCE       — video source: int (webcam index), file path, or RTSP URL
#   ROOM_ZONE_MAP       — JSON string mapping camera zone label → room_id
#                         e.g. '{"hallway_3": "304", "hallway_4": "401"}'

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
CAMERA_SOURCE: str | int = os.getenv("CAMERA_SOURCE", "0")
ROOM_ZONE_MAP: dict[str, str] = {}  # TODO: parse from ROOM_ZONE_MAP env var

# YOLO settings
YOLO_MODEL: str = os.getenv("YOLO_MODEL", "yolov8n.pt")  # nano model for speed
CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.4"))
TARGET_CLASS: str = "person"  # YOLO class name to count

# Ingestion settings
INGEST_INTERVAL_SECONDS: int = int(os.getenv("INGEST_INTERVAL_SECONDS", "30"))
ENTRY_COUNT_WINDOW_MINUTES: int = 60  # rolling window for entries_last_hour
