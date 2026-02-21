from __future__ import annotations

import argparse

import cv2
import numpy as np
from ultralytics import YOLO

from .geometry import clamp_segment
from .models import DoorCandidate, RoomConfig


def fit_gate_line_from_box(
    frame,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    line_offset: int,
    max_angle_deg: float,
    min_bottom_ratio: float,
) -> tuple[int, int, int, int, str]:
    """
    Estimate a doorway threshold line from edges inside a detected door box.

    Returns (gx1, gy1, gx2, gy2, source), where source describes whether
    we used an edge-based estimate or a horizontal fallback.
    """
    h, w = frame.shape[:2]
    x1 = max(0, min(w - 1, x1))
    x2 = max(0, min(w - 1, x2))
    y1 = max(0, min(h - 1, y1))
    y2 = max(0, min(h - 1, y2))
    if x2 <= x1 or y2 <= y1:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi / 180,
        threshold=20,
        minLineLength=max(20, int((x2 - x1) * 0.35)),
        maxLineGap=15,
    )

    best = None
    best_score = -1.0
    max_angle_deg = max(5.0, min(80.0, float(max_angle_deg)))
    min_bottom_ratio = max(0.2, min(0.95, float(min_bottom_ratio)))
    if lines is not None:
        roi_h = y2 - y1
        for line in lines:
            lx1, ly1, lx2, ly2 = line[0]
            dx = lx2 - lx1
            dy = ly2 - ly1
            length = float(np.hypot(dx, dy))
            if length < max(20.0, (x2 - x1) * 0.35):
                continue
            angle = abs(np.degrees(np.arctan2(dy, dx)))
            if angle > max_angle_deg:
                continue
            y_mid = (ly1 + ly2) / 2.0
            if y_mid < roi_h * min_bottom_ratio:
                continue
            score = y_mid * 2.0 + length
            if score > best_score:
                best_score = score
                best = (lx1, ly1, lx2, ly2)

    if best is None:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    lx1, ly1, lx2, ly2 = best
    roi_w = x2 - x1
    roi_h = y2 - y1
    dx = lx2 - lx1
    if dx == 0:
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"
    m = (ly2 - ly1) / float(dx)
    ly_left = ly1 + (0 - lx1) * m
    ly_right = ly1 + ((roi_w - 1) - lx1) * m
    if min(ly_left, ly_right) < (roi_h * min_bottom_ratio):
        ly = max(0, min(h - 1, y2 - line_offset))
        return x1, ly, x2, ly, "fallback"

    gx1 = x1
    gx2 = x2
    gy1 = y1 + int(round(ly_left)) - line_offset
    gy2 = y1 + int(round(ly_right)) - line_offset
    gy1 = max(0, min(h - 1, gy1))
    gy2 = max(0, min(h - 1, gy2))
    return gx1, gy1, gx2, gy2, "edge"


def preprocess_door_frame(args: argparse.Namespace, frame):
    """Apply optional preprocessing to help door detection in low-contrast scenes."""
    out = frame

    if args.door_preprocess == "clahe":
        lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l2 = clahe.apply(l)
        out = cv2.cvtColor(cv2.merge((l2, a, b)), cv2.COLOR_LAB2BGR)

    if args.door_gamma > 0 and abs(args.door_gamma - 1.0) > 1e-6:
        inv = 1.0 / args.door_gamma
        table = np.array([int(((i / 255.0) ** inv) * 255) for i in range(256)], dtype=np.uint8)
        out = cv2.LUT(out, table)

    return out


def parse_prompts(args: argparse.Namespace) -> list[str]:
    """Return detection prompts, preferring --door-prompts when supplied."""
    if args.door_prompts:
        prompts = [p.strip() for p in args.door_prompts.split(",") if p.strip()]
        if prompts:
            return prompts
    return [args.door_prompt]


def parse_negative_prompts(args: argparse.Namespace) -> list[str]:
    """Return negative prompts used to reject door-like false positives."""
    if args.door_negative_prompts:
        return [p.strip() for p in args.door_negative_prompts.split(",") if p.strip()]
    return []


def collect_prompt_detections(
    door_model: YOLO,
    image,
    prompts: list[str],
    conf: float,
) -> list[tuple[float, list[float], str]]:
    """Run prompt-conditioned detections and return (conf, box, prompt) tuples."""
    out: list[tuple[float, list[float], str]] = []
    for prompt in prompts:
        if hasattr(door_model, "set_classes"):
            door_model.set_classes([prompt])
        results = door_model.predict(
            source=image,
            conf=conf,
            verbose=False,
        )
        result = results[0]
        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            continue
        xyxy = boxes.xyxy.cpu().tolist()
        confs = boxes.conf.cpu().tolist() if boxes.conf is not None else [0.0] * len(xyxy)
        out.extend((score, box, prompt) for score, box in zip(confs, xyxy))
    return out


def box_iou_xyxy(a: list[float], b: list[float]) -> float:
    """Compute IoU for two [x1, y1, x2, y2] boxes."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)
    iw = max(0.0, inter_x2 - inter_x1)
    ih = max(0.0, inter_y2 - inter_y1)
    inter = iw * ih
    if inter <= 0.0:
        return 0.0
    a_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    b_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    denom = a_area + b_area - inter
    if denom <= 0.0:
        return 0.0
    return inter / denom


def nms_detections(
    detections: list[tuple[float, list[float], str]],
    iou_threshold: float,
) -> list[tuple[float, list[float], str]]:
    """Class-agnostic NMS across prompts so the same door isn't repeated."""
    if not detections:
        return []
    items = sorted(detections, key=lambda it: it[0], reverse=True)
    kept: list[tuple[float, list[float], str]] = []
    for cand in items:
        _, box, _ = cand
        if any(box_iou_xyxy(box, kept_box) >= iou_threshold for _, kept_box, _ in kept):
            continue
        kept.append(cand)
    return kept


def split_wide_detection_box(
    frame,
    box: list[float],
    min_width: int,
    split_ratio: float,
) -> list[list[float]]:
    """
    Split a very wide detection into two boxes if a central vertical divider exists.

    This helps when two adjacent angled doors are merged into one detection.
    """
    h, w = frame.shape[:2]
    x1f, y1f, x2f, y2f = box
    x1 = max(0, min(w - 1, int(x1f)))
    x2 = max(0, min(w - 1, int(x2f)))
    y1 = max(0, min(h - 1, int(y1f)))
    y2 = max(0, min(h - 1, int(y2f)))
    bw = x2 - x1
    bh = y2 - y1
    if bw <= 0 or bh <= 0:
        return [box]
    if bh == 0 or (bw / float(bh)) < max(1.0, split_ratio):
        return [box]

    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return [box]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    col_energy = np.mean(np.abs(grad_x), axis=0)
    if col_energy.size < 8:
        return [box]

    left = int(col_energy.size * 0.25)
    right = int(col_energy.size * 0.75)
    if right <= left + 2:
        return [box]
    center_band = col_energy[left:right]
    peak_idx_local = int(np.argmax(center_band))
    peak_idx = left + peak_idx_local

    mean_e = float(np.mean(col_energy))
    std_e = float(np.std(col_energy))
    peak_e = float(col_energy[peak_idx])
    if peak_e < (mean_e + 0.6 * std_e):
        return [box]

    split_x = x1 + peak_idx
    min_part = max(12, int(min_width))
    if (split_x - x1) < min_part or (x2 - split_x) < min_part:
        return [box]

    return [
        [float(x1), float(y1), float(split_x), float(y2)],
        [float(split_x), float(y1), float(x2), float(y2)],
    ]


def detect_doors_from_frame(
    args: argparse.Namespace,
    frame,
    width: int,
    height: int,
    door_model: YOLO,
) -> tuple[list[RoomConfig], list[DoorCandidate]]:
    """Detect doors in a frame and create RoomConfig entries."""
    input_frame = preprocess_door_frame(args, frame)
    prompts = parse_prompts(args)
    detections = collect_prompt_detections(door_model, input_frame, prompts, args.door_conf)
    negative_prompts = parse_negative_prompts(args)
    negative_detections: list[tuple[float, list[float], str]] = []
    if negative_prompts and args.door_negative_conf > 0:
        negative_detections = collect_prompt_detections(
            door_model,
            input_frame,
            negative_prompts,
            args.door_negative_conf,
        )
        negative_detections = nms_detections(
            negative_detections,
            max(0.0, min(0.95, args.door_nms_iou)),
        )
    negative_boxes = [box for _, box, _ in negative_detections]

    if not detections:
        print("[door-status] NOT CONNECTED: no doors detected in this frame.")
        if args.debug_doors:
            print(
                f"[door-debug] prompts={prompts} conf>={args.door_conf} produced 0 boxes "
                f"(negative_prompts={negative_prompts})"
            )
        print(
            "[door-status] Continuing without door lines. "
            "Try lower --door-conf, another --door-model, or --rooms-config."
        )
        return [], []

    detections = nms_detections(detections, max(0.0, min(0.95, args.door_nms_iou)))
    if args.door_split_wide_boxes:
        split_detections: list[tuple[float, list[float], str]] = []
        for conf, box, prompt in detections:
            parts = split_wide_detection_box(
                input_frame,
                box,
                min_width=args.door_min_width,
                split_ratio=args.door_split_ratio,
            )
            for part in parts:
                split_detections.append((conf, part, prompt))
        detections = nms_detections(split_detections, max(0.0, min(0.95, args.door_nms_iou)))
    detections.sort(key=lambda item: item[0], reverse=True)

    rooms: list[RoomConfig] = []
    candidates: list[DoorCandidate] = []
    max_height_ratio = max(0.0, min(1.0, args.door_max_height_ratio))
    neg_iou = max(0.0, min(1.0, args.door_negative_iou))
    for conf, (x1f, y1f, x2f, y2f), prompt in detections:
        if len(rooms) >= max(1, args.max_doors):
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="max_doors_reached",
                )
            )
            continue

        x1, x2 = clamp_segment(int(x1f), int(x2f), width)
        if (x2 - x1) < args.door_min_width:
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="too_narrow",
                )
            )
            continue

        cand_h = max(1.0, float(y2f - y1f))
        if (cand_h / float(height)) > max_height_ratio:
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="too_tall_for_door",
                )
            )
            continue

        overlaps_negative = any(
            box_iou_xyxy([x1f, y1f, x2f, y2f], neg_box) >= neg_iou for neg_box in negative_boxes
        )
        if overlaps_negative:
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="overlaps_negative_prompt",
                )
            )
            continue

        gx1, gy1, gx2, gy2, gate_source = fit_gate_line_from_box(
            input_frame,
            int(x1f),
            int(y1f),
            int(x2f),
            int(y2f),
            args.door_line_offset,
            args.door_gate_max_angle,
            args.door_gate_min_bottom_ratio,
        )
        if args.door_require_edge_threshold and gate_source != "edge":
            candidates.append(
                DoorCandidate(
                    x1=int(x1f),
                    y1=int(y1f),
                    x2=int(x2f),
                    y2=int(y2f),
                    conf=float(conf),
                    prompt=prompt,
                    accepted=False,
                    reason="missing_threshold_edge",
                )
            )
            continue

        rooms.append(
            RoomConfig(
                room_id="",
                gate_x1=gx1,
                gate_y1=gy1,
                gate_x2=gx2,
                gate_y2=gy2,
                direction=args.direction,
                line_margin=args.line_margin,
                initial_occupancy=args.initial_occupancy,
                line_thickness=max(1, args.line_thickness),
            )
        )
        candidates.append(
            DoorCandidate(
                x1=int(x1f),
                y1=int(y1f),
                x2=int(x2f),
                y2=int(y2f),
                conf=float(conf),
                prompt=prompt,
                accepted=True,
                reason=f"accepted_{gate_source}",
            )
        )

    if not rooms:
        print("[door-status] NOT CONNECTED: door candidates were filtered out.")
        if args.debug_doors:
            narrow = sum(1 for c in candidates if c.reason == "too_narrow")
            too_tall = sum(1 for c in candidates if c.reason == "too_tall_for_door")
            neg_overlap = sum(1 for c in candidates if c.reason == "overlaps_negative_prompt")
            missing_edge = sum(1 for c in candidates if c.reason == "missing_threshold_edge")
            print(
                f"[door-debug] raw={len(detections)} too_narrow={narrow} "
                f"too_tall={too_tall} neg_overlap={neg_overlap} "
                f"missing_edge={missing_edge} max_doors_reached=0 accepted=0 "
                f"min_width={args.door_min_width}"
            )
        print(
            "[door-status] Continuing without door lines. "
            "Try lower --door-min-width or use --rooms-config."
        )
        return [], candidates

    rooms.sort(key=lambda r: ((r.gate_x1 + r.gate_x2) / 2.0))
    for idx, room in enumerate(rooms, start=1):
        room.room_id = f"room_{idx}"

    print(f"[door-status] CONNECTED: detected {len(rooms)} door(s).")
    if args.debug_doors:
        narrow = sum(1 for c in candidates if c.reason == "too_narrow")
        over = sum(1 for c in candidates if c.reason == "max_doors_reached")
        too_tall = sum(1 for c in candidates if c.reason == "too_tall_for_door")
        neg_overlap = sum(1 for c in candidates if c.reason == "overlaps_negative_prompt")
        missing_edge = sum(1 for c in candidates if c.reason == "missing_threshold_edge")
        print(
            f"[door-debug] raw={len(detections)} accepted={len(rooms)} "
            f"too_narrow={narrow} too_tall={too_tall} neg_overlap={neg_overlap} "
            f"missing_edge={missing_edge} max_doors_reached={over} "
            f"neg_boxes={len(negative_boxes)} "
            f"preprocess={args.door_preprocess} gamma={args.door_gamma}"
        )
    for room in rooms:
        print(
            f"[door-status] {room.room_id}: "
            f"({room.gate_x1},{room.gate_y1}) -> ({room.gate_x2},{room.gate_y2})"
        )
    return rooms, candidates
