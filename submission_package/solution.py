"""
WIUT Hackathon 2026 — Computer Vision Track: Elimination Task
Official submission module: solution.py
Team: VisionForce-WIUT

Strict compliance with the submission contract:
- CLASSES: Exact 14 official class IDs from competition PDF
- detect_events(video_path: str, meta: dict = None) -> list[list]: Part A event detection with dynamic lane adaptation
- RiskEstimator: Part B causal accident anticipation ([0.0, 1.0])
- Execution budget: <= 3x video duration
"""
from __future__ import annotations

import os
import math
from typing import List, Tuple, Dict, Optional, Any
import numpy as np

# =============================================================================
# 1. OFFICIAL EVENT CLASSES (EXACT 14 IDS FROM COMPETITION PDF)
# =============================================================================
CLASSES: list[str] = [
    "accident",            # Столкновение участников движения
    "near_miss",           # Резкое торможение/уклонение без контакта
    "red_light",           # Проезд на запрещающий сигнал
    "wrong_way",           # Движение по встречной полосе
    "illegal_u_turn",      # Разворот в неположенном месте
    "stopped_vehicle",     # Остановка на проезжей части >= 10 с
    "jaywalking",          # Пешеход вне перехода
    "failure_to_yield",    # Непредоставление преимущества пешеходу
    "illegal_turn",        # Поворот из неположенного ряда
    "solid_line_crossing", # Пересечение сплошной линии
    "stop_line",           # Остановка за стоп-линией на красный
    "congestion",          # Затор/пробка по всем полосам
    "road_obstacle",       # Посторонний предмет/препятствие на дороге
    "fire_smoke"           # Возгорание или задымление
]

RISK_HORIZON_SEC = 5.0


# =============================================================================
# 2. DYNAMIC COMPUTER VISION ROAD & LANE ADAPTATION (PER-VIDEO)
# =============================================================================
def _auto_detect_road_lanes_cv(cap, w: int, h: int) -> list[tuple[tuple[int, int], tuple[int, int]]]:
    try:
        import cv2
        pos = cap.get(cv2.CAP_PROP_POS_FRAMES)
        frames = []
        n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 100)
        step = max(1, n_frames // 6)
        for fi in range(step, n_frames - step, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ret, frame = cap.read()
            if ret and frame is not None:
                frames.append(frame)
                if len(frames) >= 4:
                    break
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)

        if not frames:
            return [
                ((int(0.38 * w), int(0.28 * h)), (int(0.28 * w), int(0.94 * h))),
                ((int(0.62 * w), int(0.28 * h)), (int(0.72 * w), int(0.94 * h)))
            ]

        avg_frame = np.mean(frames, axis=0).astype(np.uint8)
        gray = cv2.cvtColor(avg_frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 45, 140)

        mask = np.zeros_like(edges)
        roi_pts = np.array([
            [(int(0.08 * w), int(0.96 * h)),
             (int(0.38 * w), int(0.28 * h)),
             (int(0.62 * w), int(0.28 * h)),
             (int(0.92 * w), int(0.96 * h))]
        ], dtype=np.int32)
        cv2.fillPoly(mask, roi_pts, 255)
        masked_edges = cv2.bitwise_and(edges, mask)

        lines = cv2.HoughLinesP(masked_edges, 1, np.pi / 180, threshold=35, minLineLength=25, maxLineGap=20)
        left_lines, right_lines = [], []

        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                if x2 == x1:
                    continue
                slope = (y2 - y1) / (x2 - x1)
                if slope < -0.25:
                    left_lines.append((x1, y1, x2, y2))
                elif slope > 0.25:
                    right_lines.append((x1, y1, x2, y2))

        y_top, y_bot = int(0.28 * h), int(0.94 * h)
        left_res = ((int(0.38 * w), y_top), (int(0.28 * w), y_bot))
        right_res = ((int(0.62 * w), y_top), (int(0.72 * w), y_bot))

        if left_lines:
            xs = [l[0] for l in left_lines] + [l[2] for l in left_lines]
            ys = [l[1] for l in left_lines] + [l[3] for l in left_lines]
            if len(xs) >= 2:
                poly = np.polyfit(ys, xs, 1)
                left_res = ((int(np.clip(np.polyval(poly, y_top), 0.1 * w, 0.48 * w)), y_top),
                            (int(np.clip(np.polyval(poly, y_bot), 0.05 * w, 0.45 * w)), y_bot))

        if right_lines:
            xs = [l[0] for l in right_lines] + [l[2] for l in right_lines]
            ys = [l[1] for l in right_lines] + [l[3] for l in right_lines]
            if len(xs) >= 2:
                poly = np.polyfit(ys, xs, 1)
                right_res = ((int(np.clip(np.polyval(poly, y_top), 0.52 * w, 0.9 * w)), y_top),
                             (int(np.clip(np.polyval(poly, y_bot), 0.55 * w, 0.95 * w)), y_bot))

        return [left_res, right_res]
    except Exception:
        return [
            ((int(0.38 * w), int(0.28 * h)), (int(0.28 * w), int(0.94 * h))),
            ((int(0.62 * w), int(0.28 * h)), (int(0.72 * w), int(0.94 * h)))
        ]


# =============================================================================
# 3. TEMPORAL NMS & DEBOUNCING UTILITIES
# =============================================================================
def _clean_and_merge_segments(raw_events: list, video_duration: float, min_duration: float = 0.5, merge_gap: float = 1.2) -> list[list]:
    if not raw_events:
        return []

    by_class: Dict[str, List[Tuple[float, float]]] = {}
    for ev in raw_events:
        if not (isinstance(ev, (list, tuple)) and len(ev) == 3):
            continue
        try:
            s, e, label = float(ev[0]), float(ev[1]), str(ev[2])
        except Exception:
            continue
        if label not in CLASSES or s >= e:
            continue
        s = max(0.0, min(s, video_duration))
        e = min(video_duration, max(s + 0.1, e))
        by_class.setdefault(label, []).append((s, e))

    merged_all = []
    for label, intervals in by_class.items():
        intervals.sort(key=lambda x: x[0])
        merged = []
        for s, e in intervals:
            if not merged:
                merged.append([s, e])
            else:
                last_s, last_e = merged[-1]
                if s <= last_e + merge_gap:
                    merged[-1][1] = max(last_e, e)
                else:
                    merged.append([s, e])

        for s, e in merged:
            if (e - s) >= min_duration:
                merged_all.append([round(float(s), 2), round(float(min(e, video_duration)), 2), label])

    merged_all.sort(key=lambda x: (x[0], x[1]))
    return merged_all


# =============================================================================
# 4. PART A — EVENT DETECTION (detect_events)
# =============================================================================
def detect_events(video_path: str, meta: Optional[dict] = None) -> list[list]:
    if not os.path.exists(video_path):
        return []

    try:
        import cv2
    except ImportError:
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
    duration = float(total_frames / fps) if (total_frames > 0 and fps > 0) else 60.0

    dynamic_dividers = _auto_detect_road_lanes_cv(cap, w, h)

    raw_candidates = []
    stride = max(1, int(fps / 5))
    prev_gray = None
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % stride == 0:
            t_sec = float(frame_idx / fps)
            small = cv2.resize(frame, (320, 180))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

            if prev_gray is not None:
                diff = cv2.absdiff(gray, prev_gray)
                motion_val = float(np.mean(diff))

                if motion_val > 48.0:
                    raw_candidates.append([max(0.0, t_sec - 1.0), min(duration, t_sec + 4.5), "accident"])
                elif motion_val > 28.0:
                    raw_candidates.append([max(0.0, t_sec - 1.2), min(duration, t_sec + 3.0), "near_miss"])

            prev_gray = gray

        frame_idx += 1

    cap.release()
    return _clean_and_merge_segments(raw_candidates, duration, min_duration=0.5, merge_gap=1.5)


# =============================================================================
# 5. PART B — CAUSAL ACCIDENT ANTICIPATION (RiskEstimator)
# =============================================================================
class RiskEstimator:
    def __init__(self):
        self.fps = 25.0
        self.last_score = 0.01
        self.prev_gray = None
        self.frame_count = 0
        self.motion_buffer: List[float] = []

    def reset(self, meta: dict) -> None:
        self.fps = float(meta.get("fps") or 25.0)
        self.last_score = 0.01
        self.prev_gray = None
        self.frame_count = 0
        self.motion_buffer.clear()

    def step(self, frame: np.ndarray, t_sec: float) -> float:
        self.frame_count += 1
        if self.frame_count % 3 == 0 and frame is not None:
            try:
                import cv2
                small = cv2.resize(frame, (160, 90))
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

                if self.prev_gray is not None:
                    diff = cv2.absdiff(gray, self.prev_gray)
                    m = float(np.mean(diff))
                    self.motion_buffer.append(m)
                    if len(self.motion_buffer) > 12:
                        self.motion_buffer.pop(0)

                    avg_m = float(np.mean(self.motion_buffer))
                    delta = max(0.0, m - avg_m)
                    raw = 1.0 / (1.0 + math.exp(-0.2 * (delta - 12.0)))
                    self.last_score = 0.65 * self.last_score + 0.35 * raw
                self.prev_gray = gray
            except Exception:
                pass

        return float(np.clip(self.last_score, 0.0, 1.0))
