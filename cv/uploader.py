"""
Minimal CV uploader:
1. Capture frames from CAMERA_SOURCE
2. Encode to JPEG + base64
3. Batch and POST to Next.js /api/ingest/cv-images

This is intentionally separate from the main CV pipeline to avoid changing
existing detection logic while validating end-to-end ingestion.
"""

from __future__ import annotations

import base64
import math
import os
import signal
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import cv2
import requests
from dotenv import load_dotenv


load_dotenv()

NEXT_API_BASE_URL = os.getenv("NEXT_API_BASE_URL", "http://localhost:3000").rstrip("/")
CV_API_KEY = os.getenv("CV_API_KEY", "")
CAMERA_SOURCE_RAW = os.getenv("CAMERA_SOURCE", "0")
ROOM_ID = os.getenv("ROOM_ID", "")
CAMERA_ID = os.getenv("CAMERA_ID", "")
VIDEO_ID = os.getenv("VIDEO_ID", "").strip()
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5"))
FLUSH_SECONDS = float(os.getenv("FLUSH_SECONDS", "5"))
FRAME_SAMPLE_SECONDS = float(os.getenv("FRAME_SAMPLE_SECONDS", "1.0"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "90"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "75"))
POST_RETRIES = int(os.getenv("POST_RETRIES", "2"))
RETRY_BACKOFF_SECONDS = float(os.getenv("RETRY_BACKOFF_SECONDS", "1.5"))
MIN_POST_INTERVAL_SECONDS = float(os.getenv("MIN_POST_INTERVAL_SECONDS", "1.0"))
START_OFFSET_SECONDS = float(os.getenv("START_OFFSET_SECONDS", "0"))
MAX_DURATION_SECONDS_RAW = os.getenv("MAX_DURATION_SECONDS", "").strip()
MAX_DURATION_SECONDS = float(MAX_DURATION_SECONDS_RAW) if MAX_DURATION_SECONDS_RAW else None


def parse_camera_source(raw: str) -> int | str:
    return int(raw) if raw.isdigit() else raw


def now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def frame_to_base64_jpeg(frame: Any) -> str:
    ok, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    if not ok:
        raise RuntimeError("Failed to JPEG-encode frame")
    return base64.b64encode(encoded.tobytes()).decode("utf-8")


def build_item(frame: Any, video_id: str) -> dict[str, Any]:
    item = {
        "room_id": ROOM_ID,
        "video_id": video_id,
        "captured_at": now_iso_utc(),
        "mime_type": "image/jpeg",
        "image_base64": frame_to_base64_jpeg(frame),
    }
    if CAMERA_ID:
        item["camera_id"] = CAMERA_ID
    return item


def seconds_left_in_video(cap: cv2.VideoCapture) -> float | None:
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    current_frame = cap.get(cv2.CAP_PROP_POS_FRAMES)
    if fps <= 0 or total_frames <= 0:
        return None
    remaining_frames = max(total_frames - current_frame, 0.0)
    return remaining_frames / fps


def post_batch(session: requests.Session, batch: list[dict[str, Any]]) -> requests.Response:
    url = f"{NEXT_API_BASE_URL}/api/ingest/cv-images"
    headers = {"x-cv-api-key": CV_API_KEY}
    return session.post(
        url,
        headers=headers,
        json={"items": batch},
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

def post_batch_with_retry(session: requests.Session, batch: list[dict[str, Any]]) -> requests.Response | None:
    max_attempts = POST_RETRIES + 1
    for attempt in range(1, max_attempts + 1):
        try:
            return post_batch(session, batch)
        except requests.RequestException as error:
            if attempt >= max_attempts:
                print(f"flush={len(batch)} failed after {attempt} attempts: {error}")
                return None
            sleep_seconds = RETRY_BACKOFF_SECONDS * attempt
            print(
                f"flush={len(batch)} attempt={attempt} failed: {error}. "
                f"Retrying in {sleep_seconds:.1f}s..."
            )
            time.sleep(sleep_seconds)

    return None


def enforce_post_rate_limit(last_post_ts: float | None) -> None:
    if last_post_ts is None:
        return
    elapsed = time.time() - last_post_ts
    if elapsed < MIN_POST_INTERVAL_SECONDS:
        time.sleep(MIN_POST_INTERVAL_SECONDS - elapsed)


def finalize_video_with_retry(session: requests.Session, video_id: str) -> dict[str, Any] | None:
    url = f"{NEXT_API_BASE_URL}/api/ingest/cv-images/finalize"
    headers = {"x-cv-api-key": CV_API_KEY}
    max_attempts = POST_RETRIES + 1

    for attempt in range(1, max_attempts + 1):
        try:
            response = session.post(
                url,
                headers=headers,
                json={"video_id": video_id},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            payload = response.json()
            if response.status_code >= 400:
                print(f"finalize status={response.status_code} body={str(payload)[:500]}")
                return None
            return payload if isinstance(payload, dict) else None
        except (requests.RequestException, ValueError) as error:
            if attempt >= max_attempts:
                print(f"finalize failed after {attempt} attempts: {error}")
                return None
            sleep_seconds = RETRY_BACKOFF_SECONDS * attempt
            print(f"finalize attempt={attempt} failed: {error}. Retrying in {sleep_seconds:.1f}s...")
            time.sleep(sleep_seconds)

    return None


def log_batch_response(
    response: requests.Response,
    batch_size: int,
    seconds_left: float | None = None,
) -> dict[str, Any] | None:
    try:
        payload = response.json()
    except ValueError:
        text_preview = response.text[:400].replace("\n", " ")
        print(f"flush={batch_size} status={response.status_code} body={text_preview}")
        return None

    accepted = payload.get("accepted")
    analyzed = payload.get("analyzed")
    inserted = payload.get("inserted")
    base_line = (
        f"flush={batch_size} status={response.status_code} accepted={accepted} "
        f"analyzed={analyzed} inserted={inserted}"
    )
    if seconds_left is not None:
        base_line += f" video_seconds_left={seconds_left:.1f}"
    print(base_line)

    summary = payload.get("final_video_summary")
    risk = payload.get("overall_risk_level")
    score = payload.get("overall_suspicion_score")
    action = payload.get("recommended_action")
    if summary:
        print(f"gemini_video_summary={summary}")
    if risk is not None or score is not None:
        print(f"gemini_overall_risk={risk} score={score}")
    if action:
        print(f"gemini_recommended_action={action}")

    errors = payload.get("errors")
    if isinstance(errors, list) and errors:
        print(f"errors={errors}")

    return payload if isinstance(payload, dict) else None


def run_uploader() -> None:
    if not CV_API_KEY:
        raise RuntimeError("Missing CV_API_KEY")
    if not ROOM_ID:
        raise RuntimeError("Missing ROOM_ID")
    if BATCH_SIZE < 1:
        raise RuntimeError("BATCH_SIZE must be >= 1")
    if FLUSH_SECONDS <= 0 or FRAME_SAMPLE_SECONDS <= 0:
        raise RuntimeError("FLUSH_SECONDS and FRAME_SAMPLE_SECONDS must be > 0")
    if START_OFFSET_SECONDS < 0:
        raise RuntimeError("START_OFFSET_SECONDS must be >= 0")
    if MAX_DURATION_SECONDS is not None and MAX_DURATION_SECONDS <= 0:
        raise RuntimeError("MAX_DURATION_SECONDS must be > 0 when provided")

    camera_source = parse_camera_source(CAMERA_SOURCE_RAW)
    is_file_source = isinstance(camera_source, str) and os.path.isfile(camera_source)
    generated_video_id = f"vid_{int(time.time())}_{uuid4().hex[:8]}"
    run_video_id = VIDEO_ID if VIDEO_ID else generated_video_id
    cap = cv2.VideoCapture(camera_source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open CAMERA_SOURCE={CAMERA_SOURCE_RAW}")

    if is_file_source and START_OFFSET_SECONDS > 0:
        cap.set(cv2.CAP_PROP_POS_MSEC, START_OFFSET_SECONDS * 1000.0)
    elif START_OFFSET_SECONDS > 0:
        print("START_OFFSET_SECONDS ignored for non-file source")

    clip_start_ms = cap.get(cv2.CAP_PROP_POS_MSEC) if is_file_source else None
    clip_end_ms = None
    if is_file_source and MAX_DURATION_SECONDS is not None and clip_start_ms is not None:
        clip_end_ms = clip_start_ms + MAX_DURATION_SECONDS * 1000.0

    expected_posts: int | None = None
    if is_file_source:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if fps > 0 and total_frames > 0:
            start_sec = 0.0
            if clip_start_ms is not None and clip_start_ms > 0:
                start_sec = clip_start_ms / 1000.0
            end_sec = total_frames / fps
            if clip_end_ms is not None:
                end_sec = min(end_sec, clip_end_ms / 1000.0)
            effective_seconds = max(end_sec - start_sec, 0.0)
            expected_samples = effective_seconds / FRAME_SAMPLE_SECONDS
            expected_posts = math.ceil(expected_samples / BATCH_SIZE)

    print("CV uploader started")
    print(f"  route={NEXT_API_BASE_URL}/api/ingest/cv-images")
    print(f"  source={CAMERA_SOURCE_RAW} room_id={ROOM_ID} camera_id={CAMERA_ID or '(none)'}")
    print(f"  video_id={run_video_id}")
    print(
        f"  sample={FRAME_SAMPLE_SECONDS}s batch={BATCH_SIZE} flush={FLUSH_SECONDS}s "
        f"timeout={REQUEST_TIMEOUT_SECONDS}s"
    )
    if is_file_source:
        print(
            f"  clip_start_seconds={(clip_start_ms or 0.0) / 1000.0:.2f} "
            f"clip_max_duration_seconds={MAX_DURATION_SECONDS if MAX_DURATION_SECONDS is not None else '(full)'}"
        )
    if expected_posts is not None:
        print(f"  expected_posts={expected_posts}")

    should_stop = {"value": False}

    def handle_stop(signum: int, _frame: Any) -> None:
        print(f"\nSignal {signum} received, flushing and stopping...")
        should_stop["value"] = True

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    batch: list[dict[str, Any]] = []
    last_flush = time.time()
    total_sent_frames = 0
    last_post_ts: float | None = None
    post_count = 0

    with requests.Session() as session:
        try:
            while not should_stop["value"]:
                ok, frame = cap.read()
                if not ok:
                    if is_file_source:
                        print("Reached end of video file, flushing and exiting...")
                        break
                    time.sleep(0.1)
                    continue

                if is_file_source and clip_end_ms is not None:
                    current_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                    if current_ms >= clip_end_ms:
                        print("Reached configured clip duration, flushing and exiting...")
                        break

                batch.append(build_item(frame, run_video_id))
                now = time.time()

                if len(batch) >= BATCH_SIZE or (now - last_flush) >= FLUSH_SECONDS:
                    remaining = seconds_left_in_video(cap) if is_file_source else None
                    post_count += 1
                    label = f"post #{post_count}" + (f" of {expected_posts}" if expected_posts is not None else "")
                    print(f"\n--- {label} ---")
                    enforce_post_rate_limit(last_post_ts)
                    response = post_batch_with_retry(session, batch)
                    last_post_ts = time.time()
                    if response is not None:
                        log_batch_response(response, len(batch), remaining)
                        total_sent_frames += len(batch)
                    batch = []
                    last_flush = now

                if is_file_source:
                    next_ms = cap.get(cv2.CAP_PROP_POS_MSEC) + FRAME_SAMPLE_SECONDS * 1000
                    cap.set(cv2.CAP_PROP_POS_MSEC, next_ms)
                else:
                    time.sleep(FRAME_SAMPLE_SECONDS)
        finally:
            cap.release()
            if batch:
                remaining = seconds_left_in_video(cap) if is_file_source else None
                post_count += 1
                label = f"post #{post_count}" + (f" of {expected_posts}" if expected_posts is not None else "")
                print(f"\n--- {label} ---")
                enforce_post_rate_limit(last_post_ts)
                response = post_batch_with_retry(session, batch)
                last_post_ts = time.time()
                if response is not None:
                    log_batch_response(response, len(batch), remaining)
                    total_sent_frames += len(batch)

            if total_sent_frames > 0:
                print(f"\nFinalizing video summary for video_id={run_video_id}...")
                final_payload = finalize_video_with_retry(session, run_video_id)
                if final_payload:
                    print("=== Final Gemini Video Summary ===")
                    print(f"summary: {final_payload.get('final_video_summary')}")
                    print(
                        "risk: "
                        f"{final_payload.get('overall_risk_level')} "
                        f"(score={final_payload.get('overall_suspicion_score')})"
                    )
                    print(f"recommended_action: {final_payload.get('recommended_action')}")
            print("CV uploader stopped")


if __name__ == "__main__":
    run_uploader()
