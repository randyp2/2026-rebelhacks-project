"""Compatibility entrypoint for the refactored video processing pipeline."""

from cv.video_processing.pipeline import run_people_counter


if __name__ == "__main__":
    run_people_counter()
