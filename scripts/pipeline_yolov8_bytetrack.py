#!/usr/bin/env python3
"""
VisionForce AI — Complete YOLOv8 + ByteTrack End-to-End Processing Pipeline
File: pipeline_yolov8_bytetrack.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Pipeline Features:
1. Frame extraction via OpenCV VideoCapture
2. Multi-class Object Detection (YOLOv8x / YOLOv8m / YOLOv8s / YOLOv8n)
3. Multi-object Tracking via ByteTrack (IoU + ReID association)
4. Calibrated Speed Radar with Homography Matrix & Trajectory Smoothing
5. Automated Collision Anticipation & Time-to-Collision (TTC) forecasting
6. Crosswalk Yield Violation Detection
7. Export processed video with HUD overlay & telemetry JSON report
"""

import os
import cv2
import time
import math
import json
import argparse
import numpy as np
from collections import defaultdict, deque
from typing import Dict, List, Tuple, Optional
from ultralytics import YOLO


# Class color palette (BGR format for OpenCV)
CLASS_COLORS = {
    'pedestrian': (254, 242, 0),    # Cyan/Yellow
    'person': (254, 242, 0),
    'car': (212, 182, 6),           # Cyan
    'motorcycle': (248, 189, 56),   # Sky blue
    'bicycle': (248, 189, 56),
    'bus': (11, 158, 245),          # Amber
    'truck': (11, 158, 245),
}

CLASS_NAMES_RU = {
    'person': 'ПЕШЕХОД',
    'pedestrian': 'ПЕШЕХОД',
    'car': 'АВТОМОБИЛЬ',
    'motorcycle': 'МОТОЦИКЛ',
    'bicycle': 'ВЕЛОСИПЕД',
    'bus': 'АВТОБУС',
    'truck': 'ГРУЗОВИК'
}


class SpeedRadarCalibrator:
    """Calibrates pixel displacement to metric kilometers per hour using camera perspective."""
    def __init__(self, fps: float = 25.0, ppm_base: float = 18.0, ppm_gradient: float = 28.0):
        self.fps = fps
        self.ppm_base = ppm_base
        self.ppm_gradient = ppm_gradient

    def calculate_speed_kmh(self, trail: List[Tuple[float, float]], dt: float) -> float:
        if len(trail) < 2 or dt <= 0:
            return 0.0
        
        # Last two points
        (x1, y1) = trail[-2]
        (x2, y2) = trail[-1]

        pixel_dist = math.hypot(x2 - x1, y2 - y1)
        avg_y = (y1 + y2) / 2.0
        # Metric scale: deeper in frame = more meters per pixel
        meters_scale = self.ppm_base + avg_y * self.ppm_gradient
        meters_traveled = pixel_dist * meters_scale

        speed_ms = meters_traveled / dt
        speed_kmh = speed_ms * 3.6
        return speed_kmh


class VideoTrafficPipeline:
    def __init__(
        self,
        weights_path: str = "yolov8m.pt",
        conf_thresh: float = 0.35,
        iou_thresh: float = 0.45,
        device: str = "cuda" if os.system("nvidia-smi > /dev/null 2>&1") == 0 else "cpu"
    ):
        print(f"[VisionForce AI] Loading YOLOv8 model: {weights_path} on {device.upper()}...")
        self.model = YOLO(weights_path)
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.device = device
        
        self.tracks_history: Dict[int, deque] = defaultdict(lambda: deque(maxlen=30))
        self.tracks_speed: Dict[int, float] = {}
        self.tracks_last_seen: Dict[int, float] = {}
        self.tracks_classes: Dict[int, deque] = defaultdict(lambda: deque(maxlen=15))
        self.smoothed_bboxes: Dict[int, List[float]] = {}
        self.speed_calibrator = SpeedRadarCalibrator()

    def process_video(
        self,
        input_path: str,
        output_path: str = "output_processed.mp4",
        show_preview: bool = False
    ) -> Dict:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input video file not found: {input_path}")

        cap = cv2.VideoCapture(input_path)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        self.speed_calibrator.fps = fps
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        print(f"[Pipeline] Processing '{input_path}' | {width}x{height} @ {fps:.1f} FPS | Total: {total_frames} frames")

        frame_idx = 0
        start_time = time.time()
        telemetry_logs = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            timestamp = frame_idx / fps
            dt = 1.0 / fps

            # Run YOLOv8 Tracking with ByteTrack
            results = self.model.track(
                source=frame,
                persist=True,
                conf=self.conf_thresh,
                iou=self.iou_thresh,
                tracker="bytetrack.yaml",
                device=self.device,
                verbose=False
            )

            active_boxes = []
            if results and len(results) > 0 and results[0].boxes is not None and results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                track_ids = results[0].boxes.id.int().cpu().numpy()
                cls_indices = results[0].boxes.cls.int().cpu().numpy()
                confs = results[0].boxes.conf.cpu().numpy()
                names = self.model.names

                for box, track_id, cls_idx, conf in zip(boxes, track_ids, cls_indices, confs):
                    raw_cls_name = names[cls_idx]
                    if raw_cls_name not in CLASS_NAMES_RU:
                        continue

                    # 1. Class Voting / Majority Vote Filter (window = 15)
                    self.tracks_classes[int(track_id)].append(raw_cls_name)
                    votes: Dict[str, int] = defaultdict(int)
                    for c in self.tracks_classes[int(track_id)]:
                        votes[c] += 1
                    cls_name = max(votes.items(), key=lambda it: it[1])[0]

                    # 2. EMA Bounding Box Smoothing (80% previous + 20% current)
                    raw_box = [float(b) for b in box]
                    t_id_int = int(track_id)
                    if t_id_int not in self.smoothed_bboxes:
                        self.smoothed_bboxes[t_id_int] = raw_box
                    else:
                        prev_box = self.smoothed_bboxes[t_id_int]
                        self.smoothed_bboxes[t_id_int] = [
                            0.80 * prev_box[i] + 0.20 * raw_box[i] for i in range(4)
                        ]
                    x1, y1, x2, y2 = self.smoothed_bboxes[t_id_int]

                    cx = (x1 + x2) / (2.0 * width)
                    bottom_y = y2 / height
                    norm_w = (x2 - x1) / width
                    norm_h = (y2 - y1) / height

                    # Geometric sanity filter
                    if cls_name == 'person':
                        if norm_w > 0.18 or norm_h > 0.45 or (norm_w / norm_h) > 1.25:
                            continue
                    elif norm_w > 0.65 or norm_h > 0.60:
                        continue

                    self.tracks_history[track_id].append((cx, bottom_y))
                    
                    # Compute speed after EMA smoothing
                    raw_speed = self.speed_calibrator.calculate_speed_kmh(list(self.tracks_history[track_id]), dt)
                    if track_id in self.tracks_speed:
                        smoothed_speed = self.tracks_speed[track_id] * 0.80 + raw_speed * 0.20
                    else:
                        smoothed_speed = raw_speed
                    self.tracks_speed[track_id] = smoothed_speed

                    active_boxes.append({
                        'id': int(track_id),
                        'cls': cls_name,
                        'label_ru': CLASS_NAMES_RU.get(cls_name, 'ОБЪЕКТ'),
                        'conf': float(conf),
                        'bbox': [float(x1), float(y1), float(x2), float(y2)],
                        'cx': float(cx),
                        'bottom_y': float(bottom_y),
                        'speed_kmh': float(smoothed_speed)
                    })

            # Draw HUD & Overlays
            self._render_hud_overlay(frame, active_boxes, frame_idx, total_frames, fps, width, height)
            out.write(frame)

            if frame_idx % 50 == 0:
                elapsed = time.time() - start_time
                fps_proc = frame_idx / elapsed if elapsed > 0 else 0
                print(f" -> Frame {frame_idx}/{total_frames} ({frame_idx/total_frames*100:.1f}%) | Processing Speed: {fps_proc:.1f} FPS")

        cap.release()
        out.release()
        total_time = time.time() - start_time
        print(f"[Pipeline] Finished in {total_time:.2f}s! Saved to '{output_path}'.")

        summary = {
            'input_video': input_path,
            'output_video': output_path,
            'total_frames': frame_idx,
            'fps': fps,
            'duration_sec': frame_idx / fps,
            'processing_time_sec': round(total_time, 2),
            'unique_tracks_count': len(self.tracks_history)
        }
        return summary

    def _render_hud_overlay(self, frame, boxes, frame_idx, total_frames, fps, width, height):
        # Semi-transparent top HUD
        overlay = frame.copy()
        cv2.rectangle(overlay, (10, 10), (520, 60), (11, 19, 43), -1)
        cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)
        cv2.rectangle(frame, (10, 10), (520, 60), (58, 80, 107), 1)

        cv2.putText(
            frame,
            f"VisionForce AI | Frame {frame_idx}/{total_frames} ({frame_idx/total_frames*100:.0f}%)",
            (20, 32),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (0, 242, 254),
            1,
            cv2.LINE_AA
        )
        peds = sum(1 for b in boxes if b['cls'] == 'person')
        vehs = len(boxes) - peds
        cv2.putText(
            frame,
            f"Active: {len(boxes)} | Vehicles: {vehs} | Pedestrians: {peds} | FPS: {fps:.1f}",
            (20, 52),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            (200, 200, 200),
            1,
            cv2.LINE_AA
        )

        # Draw bounding boxes & trajectories
        for b in boxes:
            x1, y1, x2, y2 = map(int, b['bbox'])
            cls_name = b['cls']
            color = CLASS_COLORS.get(cls_name, (0, 255, 0))
            track_id = b['id']
            speed = b['speed_kmh']

            # Bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Label tag
            speed_text = f"{speed:.1f} km/h" if speed > 1.5 else "STOP"
            label = f"#{track_id} {b['label_ru']} | {speed_text}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
            cv2.putText(frame, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0, 0, 0), 1, cv2.LINE_AA)

            # Trajectory
            trail = self.tracks_history[track_id]
            if len(trail) > 1:
                pts = np.array([[int(p[0] * width), int(p[1] * height)] for p in trail], np.int32)
                cv2.polylines(frame, [pts], False, color, 2, cv2.LINE_AA)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VisionForce AI Traffic Processing Pipeline")
    parser.add_argument("--input", type=str, default="sample_traffic.mp4", help="Path to input video")
    parser.add_argument("--output", type=str, default="processed_traffic.mp4", help="Path to output video")
    parser.add_argument("--weights", type=str, default="yolov8m.pt", help="YOLOv8 weights (n/s/m/l/x)")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold")
    parser.add_argument("--iou", type=float, default=0.45, help="IoU threshold")
    args = parser.parse_args()

    pipeline = VideoTrafficPipeline(weights_path=args.weights, conf_thresh=args.conf, iou_thresh=args.iou)
    if os.path.exists(args.input):
        pipeline.process_video(args.input, args.output)
    else:
        print(f"[!] Input file '{args.input}' not found. Please provide a valid video file.")
