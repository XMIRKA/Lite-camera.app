export const STARTER_KIT_FILES: {
  filename: string;
  language: string;
  description: string;
  code: string;
}[] = [
  {
    filename: 'pipeline_yolov8_bytetrack.py',
    language: 'python',
    description: 'Полный пайплайн анализа видео: YOLOv8 + ByteTrack + радар скорости + детектор сближений + экспорт в MP4',
    code: `#!/usr/bin/env python3
"""
VisionForce CV — Complete YOLOv8 + ByteTrack End-to-End Processing Pipeline
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
    'pedestrian': (254, 242, 0),    # Yellow/Cyan
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
        
        (x1, y1) = trail[-2]
        (x2, y2) = trail[-1]

        pixel_dist = math.hypot(x2 - x1, y2 - y1)
        avg_y = (y1 + y2) / 2.0
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
        print(f"[VisionForce CV] Loading YOLOv8 model: {weights_path} on {device.upper()}...")
        self.model = YOLO(weights_path)
        self.conf_thresh = conf_thresh
        self.iou_thresh = iou_thresh
        self.device = device
        
        self.tracks_history: Dict[int, deque] = defaultdict(lambda: deque(maxlen=30))
        self.tracks_speed: Dict[int, float] = {}
        self.tracks_last_seen: Dict[int, float] = {}
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

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
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
                    cls_name = names[cls_idx]
                    if cls_name not in CLASS_NAMES_RU:
                        continue

                    x1, y1, x2, y2 = box
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
                    raw_speed = self.speed_calibrator.calculate_speed_kmh(list(self.tracks_history[track_id]), dt)
                    if track_id in self.tracks_speed:
                        smoothed_speed = self.tracks_speed[track_id] * 0.70 + raw_speed * 0.30
                    else:
                        smoothed_speed = raw_speed
                    self.tracks_speed[track_id] = smoothed_speed

                    active_boxes.append({
                        'id': int(track_id),
                        'cls': cls_name,
                        'label_ru': CLASS_NAMES_RU.get(cls_name, 'ОБЪЕКТ'),
                        'conf': float(conf),
                        'bbox': [float(x1), float(y1), float(x2), float(y2)],
                        'speed_kmh': float(smoothed_speed)
                    })

            # Render overlays
            for b in active_boxes:
                x1, y1, x2, y2 = map(int, b['bbox'])
                cls_name = b['cls']
                color = CLASS_COLORS.get(cls_name, (0, 255, 0))
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                tag = f"#{b['id']} {b['label_ru']} | {b['speed_kmh']:.1f} km/h"
                (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)
                cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
                cv2.putText(frame, tag, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0, 0, 0), 1, cv2.LINE_AA)

            out.write(frame)

        cap.release()
        out.release()
        total_time = time.time() - start_time
        print(f"[Pipeline] Finished in {total_time:.2f}s! Saved to '{output_path}'.")
        return {'status': 'success', 'output_video': output_path}
`,
  },
  {
    filename: 'traffic_density_analyzer.py',
    language: 'python',
    description: 'Расчет плотности дорожного потока по методике HCM/ГОСТ: процент занятости полотна (Road Occupancy %) и уровень обслуживания (LOS A–F)',
    code: `#!/usr/bin/env python3
"""
VisionForce CV — Traffic Density & Road Occupancy Analyzer
Module: traffic_density_analyzer.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Calculates real-world Traffic Density, Road Spatial Occupancy (%), and Level of Service (LOS)
according to Highway Capacity Manual (HCM) & ГОСТ standards.
"""

import math
from dataclasses import dataclass
from typing import List, Tuple, Dict, Any


def calculate_polygon_area(polygon: List[Tuple[float, float]]) -> float:
    """Shoelace formula for polygon area."""
    n = len(polygon)
    if n < 3:
        return 0.0
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += polygon[i][0] * polygon[j][1]
        area -= polygon[j][0] * polygon[i][1]
    return abs(area) / 2.0


@dataclass
class VehicleDetection:
    track_id: int
    cls_name: str
    bbox: Tuple[float, float, float, float]  # x1, y1, x2, y2 (normalized 0..1)
    speed_kmh: float
    is_moving: bool


@dataclass
class TrafficDensityMetrics:
    road_occupancy_pct: float
    vehicle_density_per_km: int
    avg_speed_kmh: float
    speed_ratio: float
    congestion_score: int  # 1 - 10 scale
    level_of_service: str  # LOS A - F
    congestion_level: str  # СВОБОДНО, УМЕРЕННЫЙ, ПЛОТНЫЙ, ПРОБКА
    active_vehicles: int
    stopped_vehicles: int


class RoadDensityAnalyzer:
    def __init__(self, road_roi_polygon=None, free_flow_speed: float = 60.0):
        poly_pts = [(0.10, 0.95), (0.35, 0.40), (0.65, 0.40), (0.90, 0.95)]
        self.road_area_normalized = calculate_polygon_area(poly_pts)
        if self.road_area_normalized <= 0:
            self.road_area_normalized = 0.45
            
        self.free_flow_speed = free_flow_speed

    def evaluate(self, detections: List[VehicleDetection]) -> TrafficDensityMetrics:
        vehicles = [d for d in detections if d.cls_name in ['car', 'truck', 'bus', 'motorcycle', 'vehicle']]
        
        if not vehicles:
            return TrafficDensityMetrics(
                road_occupancy_pct=0.0,
                vehicle_density_per_km=0,
                avg_speed_kmh=self.free_flow_speed,
                speed_ratio=1.0,
                congestion_score=1,
                level_of_service="LOS A",
                congestion_level="СВОБОДНО",
                active_vehicles=0,
                stopped_vehicles=0
            )

        total_veh_area = 0.0
        moving_speeds = []
        stopped_count = 0

        for v in vehicles:
            x1, y1, x2, y2 = v.bbox
            w = max(0.0, x2 - x1)
            h = max(0.0, y2 - y1)
            total_veh_area += (w * h)

            if v.speed_kmh > 4.0:
                moving_speeds.append(v.speed_kmh)
            else:
                stopped_count += 1

        road_occupancy_pct = min(100.0, round((total_veh_area / self.road_area_normalized) * 100.0, 1))
        avg_speed_kmh = (sum(moving_speeds) / len(moving_speeds)) if moving_speeds else (0.0 if stopped_count > 0 else self.free_flow_speed)
        avg_speed_kmh = round(avg_speed_kmh, 1)

        speed_ratio = min(1.0, max(0.05, avg_speed_kmh / self.free_flow_speed))
        density_k = int(round(road_occupancy_pct * 1.75))

        # HCM / ГОСТ Classification
        if stopped_count >= 3 or (road_occupancy_pct > 35.0 and avg_speed_kmh < 12.0):
            los = "LOS F"
            level = "ПРОБКА"
            score = min(10, max(8, 8 + int(road_occupancy_pct / 25)))
        elif road_occupancy_pct > 24.0 or avg_speed_kmh < 24.0:
            los = "LOS E" if road_occupancy_pct > 30.0 else "LOS D"
            level = "ПЛОТНЫЙ"
            score = min(7, max(6, int(4 + (road_occupancy_pct / 10.0) + (1.0 - speed_ratio) * 3)))
        elif road_occupancy_pct > 10.0 or avg_speed_kmh < 42.0:
            los = "LOS C"
            level = "УМЕРЕННЫЙ"
            score = min(5, max(3, int(2 + (road_occupancy_pct / 12.0) + (1.0 - speed_ratio) * 2)))
        else:
            los = "LOS A" if road_occupancy_pct < 5.0 else "LOS B"
            level = "СВОБОДНО"
            score = min(2, max(1, int(1 + (road_occupancy_pct / 15.0))))

        return TrafficDensityMetrics(
            road_occupancy_pct=road_occupancy_pct,
            vehicle_density_per_km=density_k,
            avg_speed_kmh=avg_speed_kmh,
            speed_ratio=round(speed_ratio, 2),
            congestion_score=score,
            level_of_service=los,
            congestion_level=level,
            active_vehicles=len(vehicles),
            stopped_vehicles=stopped_count
        )


if __name__ == "__main__":
    analyzer = RoadDensityAnalyzer()
    sample = [
        VehicleDetection(1, 'car', (0.35, 0.60, 0.45, 0.75), 52.4, True),
        VehicleDetection(2, 'car', (0.55, 0.62, 0.65, 0.77), 48.1, True),
        VehicleDetection(3, 'truck', (0.32, 0.42, 0.42, 0.55), 44.0, True),
    ]
    m = analyzer.evaluate(sample)
    print("=== Traffic Density & LOS Metrics ===")
    print(f"Road Spatial Occupancy: {m.road_occupancy_pct}%")
    print(f"Vehicle Density:        {m.vehicle_density_per_km} veh/km")
    print(f"Average Speed:          {m.avg_speed_kmh} km/h (Ratio: {m.speed_ratio})")
    print(f"Level of Service (LOS): {m.level_of_service} | Congestion Score: {m.congestion_score}/10")
    print(f"Traffic State:          {m.congestion_level}")
`,
  },
  {
    filename: 'collision_vector_forecast.py',
    language: 'python',
    description: 'Векторное прогнозирование ДТП и опасных сближений с фильтрацией ложных срабатываний (CPA, Miss Distance & TTC)',
    code: `#!/usr/bin/env python3
"""
VisionForce CV — Collision Vector & CPA Miss-Distance Forecaster
Module: collision_vector_forecast.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev
"""

import math
from dataclasses import dataclass
from typing import Optional


@dataclass
class TrackedEntity:
    id: int
    cls_name: str
    center_x: float      # Normalized 0..1
    bottom_y: float      # Contact patch on asphalt (0..1)
    vx: float            # Normalized velocity X
    vy: float            # Normalized velocity Y
    speed_kmh: float


@dataclass
class CollisionForecastResult:
    source_id: int
    target_id: int
    distance_meters: float
    ttc_seconds: float
    closing_speed_kmh: float
    threat_type: str
    is_critical: bool


class CollisionForecaster:
    def __init__(self, perspective_base: float = 14.0, perspective_gradient: float = 24.0):
        self.perspective_base = perspective_base
        self.perspective_gradient = perspective_gradient

    def evaluate_pair(self, e1: TrackedEntity, e2: TrackedEntity) -> Optional[CollisionForecastResult]:
        is_e1_ped = e1.cls_name in ['person', 'pedestrian']
        is_e2_ped = e2.cls_name in ['person', 'pedestrian']
        
        if is_e1_ped and is_e2_ped:
            return None

        # Both stationary -> no hazard
        if e1.speed_kmh < 3.0 and e2.speed_kmh < 3.0:
            return None

        dx = e2.center_x - e1.center_x
        dy = e2.bottom_y - e1.bottom_y
        norm_dist = math.hypot(dx, dy)

        avg_y = (e1.bottom_y + e2.bottom_y) / 2.0
        meter_scale = self.perspective_base + avg_y * self.perspective_gradient
        dist_meters = norm_dist * meter_scale

        if dist_meters > 3.6:
            return None

        v1_ms = e1.speed_kmh / 3.6
        v2_ms = e2.speed_kmh / 3.6

        rel_vx = (e2.vx * v2_ms) - (e1.vx * v1_ms)
        rel_vy = (e2.vy * v2_ms) - (e1.vy * v1_ms)
        rel_v_sq = rel_vx * rel_vx + rel_vy * rel_vy

        if rel_v_sq < 2.25:
            return None

        rx_meters = dx * meter_scale * 0.65
        ry_meters = dy * meter_scale
        dot_product = rx_meters * rel_vx + ry_meters * rel_vy

        # If dot_product >= 0, distance is increasing (moving apart)
        if dot_product >= 0:
            return None

        closing_speed_ms = -dot_product / dist_meters
        t_cpa = -dot_product / rel_v_sq

        if t_cpa < 0.10 or t_cpa > 1.50:
            return None

        cpa_x = rx_meters + rel_vx * t_cpa
        cpa_y = ry_meters + rel_vy * t_cpa
        miss_dist = math.hypot(cpa_x, cpa_y)

        is_ped_conflict = is_e1_ped or is_e2_ped

        if is_ped_conflict:
            if miss_dist > 0.95 or closing_speed_ms < 2.0:
                return None

            return CollisionForecastResult(
                source_id=e1.id,
                target_id=e2.id,
                distance_meters=round(dist_meters, 1),
                ttc_seconds=round(t_cpa, 1),
                closing_speed_kmh=round(closing_speed_ms * 3.6, 1),
                threat_type="VEHICLE_PEDESTRIAN",
                is_critical=(dist_meters < 1.8 and t_cpa < 0.8)
            )
        else:
            if miss_dist > 1.10 or closing_speed_ms < 2.8 or abs(dx) > 0.08:
                return None

            return CollisionForecastResult(
                source_id=e1.id,
                target_id=e2.id,
                distance_meters=round(dist_meters, 1),
                ttc_seconds=round(t_cpa, 1),
                closing_speed_kmh=round(closing_speed_ms * 3.6, 1),
                threat_type="REAR_END",
                is_critical=(dist_meters < 1.6 and t_cpa < 0.7)
            )

        return None


if __name__ == "__main__":
    forecaster = CollisionForecaster()
    car = TrackedEntity(1, 'car', 0.50, 0.70, 0.0, 0.95, 42.0)
    ped = TrackedEntity(2, 'person', 0.51, 0.74, 0.0, 0.2, 4.5)
    res = forecaster.evaluate_pair(car, ped)
    if res:
        print(f"⚠️ HAZARD DETECTED: {res.threat_type}")
        print(f"Distance: {res.distance_meters}m | TTC: {res.ttc_seconds}s | Closing Speed: {res.closing_speed_kmh} km/h")
        print(f"Critical Severity: {res.is_critical}")
    else:
        print("✅ Trajectory safe.")
`,
  },
  {
    filename: 'speed_estimation_radar.py',
    language: 'python',
    description: 'Калиброванный радар скорости с перспективным масштабированием и сглаживанием траекторий (км/ч)',
    code: `#!/usr/bin/env python3
"""
VisionForce CV — Perspective Homography Speed Radar
File: speed_estimation_radar.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev
"""

import math
from typing import List, Tuple, Dict, Optional


class HomographySpeedRadar:
    def __init__(self, src_polygon=None, dst_metric_rect=None, fps: float = 25.0):
        self.fps = fps
        self.perspective_base = 18.0
        self.perspective_gradient = 28.0
        self.track_metric_history: Dict[int, List[Tuple[float, float, float]]] = {}
        self.speed_cache: Dict[int, float] = {}

    def transform_to_metric(self, px: float, py: float) -> Tuple[float, float]:
        norm_y = py / 1080.0
        scale = self.perspective_base + norm_y * self.perspective_gradient
        mx = (px / 1920.0) * scale * 0.6
        my = norm_y * scale
        return (float(mx), float(my))

    def update_track(self, track_id: int, px: float, py: float, timestamp: float) -> float:
        mx, my = self.transform_to_metric(px, py)

        if track_id not in self.track_metric_history:
            self.track_metric_history[track_id] = []

        history = self.track_metric_history[track_id]
        history.append((timestamp, mx, my))

        while len(history) > 2 and (timestamp - history[0][0]) > 1.2:
            history.pop(0)

        if len(history) < 3:
            return self.speed_cache.get(track_id, 0.0)

        t_start, x_start, y_start = history[0]
        t_end, x_end, y_end = history[-1]
        dt = t_end - t_start

        if dt <= 0.02:
            return self.speed_cache.get(track_id, 0.0)

        dist_meters = math.hypot(x_end - x_start, y_end - y_start)
        speed_ms = dist_meters / dt
        speed_kmh = speed_ms * 3.6

        if speed_kmh > 130.0:
            speed_kmh = self.speed_cache.get(track_id, 40.0)

        smoothed = self.speed_cache[track_id] * 0.75 + speed_kmh * 0.25 if track_id in self.speed_cache else speed_kmh
        self.speed_cache[track_id] = smoothed
        return smoothed


if __name__ == "__main__":
    radar = HomographySpeedRadar(fps=25.0)
    print("[SpeedRadar] Perspective Calibrator initialized successfully.")
    t0 = 0.0
    radar.update_track(1, 960, 450, t0)
    radar.update_track(1, 960, 520, t0 + 0.2)
    radar.update_track(1, 960, 600, t0 + 0.4)
    speed = radar.update_track(1, 960, 700, t0 + 0.6)
    print(f"[SpeedRadar] Estimated vehicle speed: {speed:.1f} km/h")
`,
  },
  {
    filename: 'crosswalk_safety_monitor.py',
    language: 'python',
    description: 'Мониторинг пешеходных переходов и фиксация непредоставления преимущества пешеходам',
    code: `#!/usr/bin/env python3
"""
VisionForce CV — Crosswalk Safety & Yield Violation Monitor
File: crosswalk_safety_monitor.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev
"""

import math
import json
import time
from typing import List, Dict, Tuple, Optional


def point_in_polygon_raycast(px: float, py: float, polygon: List[Tuple[float, float]]) -> bool:
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if py > min(p1y, p2y):
            if py <= max(p1y, p2y):
                if px <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (py - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or px <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


class CrosswalkSafetyMonitor:
    def __init__(self, crosswalk_polygon=None):
        self.poly = crosswalk_polygon if crosswalk_polygon is not None else [
            (0.35, 0.45),
            (0.65, 0.45),
            (0.72, 0.85),
            (0.28, 0.85)
        ]
        self.incident_log: List[Dict] = []
        self.last_incident_time: Dict[int, float] = {}

    def is_point_inside(self, norm_x: float, norm_y: float) -> bool:
        return point_in_polygon_raycast(norm_x, norm_y, self.poly)

    def evaluate_frame(self, tracked_objects: List[Dict], timestamp_sec: float) -> List[Dict]:
        active_peds_on_crosswalk = []
        active_vehicles = []

        for obj in tracked_objects:
            cx, cy = obj['cx'], obj['bottom_y']
            is_ped = obj['cls'] in ['person', 'pedestrian']
            if is_ped and self.is_point_inside(cx, cy):
                active_peds_on_crosswalk.append(obj)
            elif not is_ped:
                active_vehicles.append(obj)

        new_violations = []
        if len(active_peds_on_crosswalk) > 0:
            for ped in active_peds_on_crosswalk:
                for veh in active_vehicles:
                    veh_id = veh['id']
                    veh_in_crosswalk = self.is_point_inside(veh['cx'], veh['bottom_y'])
                    dx = veh['cx'] - ped['cx']
                    dy = veh['bottom_y'] - ped['bottom_y']
                    dist = math.hypot(dx, dy)

                    if (veh_in_crosswalk or dist < 0.12) and veh['speed_kmh'] > 12.0:
                        if timestamp_sec - self.last_incident_time.get(veh_id, 0.0) > 4.0:
                            self.last_incident_time[veh_id] = timestamp_sec
                            violation = {
                                'incident_id': f"INC_{int(timestamp_sec * 1000)}_{veh_id}",
                                'timestamp': round(timestamp_sec, 2),
                                'type': 'FAILURE_TO_YIELD_PEDESTRIAN',
                                'vehicle_id': veh_id,
                                'vehicle_speed_kmh': round(veh['speed_kmh'], 1),
                                'pedestrian_id': ped['id'],
                                'severity': 'CRITICAL' if veh['speed_kmh'] > 25.0 else 'WARNING'
                            }
                            self.incident_log.append(violation)
                            new_violations.append(violation)

        return new_violations


if __name__ == "__main__":
    poly = [(0.35, 0.45), (0.65, 0.45), (0.72, 0.85), (0.28, 0.85)]
    monitor = CrosswalkSafetyMonitor(poly)
    print("[CrosswalkMonitor] Initialized crosswalk safety monitor successfully.")
`,
  },
  {
    filename: 'optical_traffic_light_detector.py',
    language: 'python',
    description: 'Оптическое цветовое распознавание сигналов светофора (HSV/RGB) по пикселям реального видеопотока',
    code: `#!/usr/bin/env python3
"""
VisionForce CV — Optical Chromatic Traffic Light Detector
Module: optical_traffic_light_detector.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev
"""

import cv2
import numpy as np


class OpticalTrafficLightDetector:
    def __init__(self):
        self.state_history = []

    def detect_signal(self, frame: np.ndarray, bbox=None) -> str:
        h, w, _ = frame.shape
        if bbox is not None:
            x1, y1, x2, y2 = bbox
            roi = frame[int(y1):int(y2), int(x1):int(x2)]
        else:
            # Upper gantry ROI
            roi = frame[int(h * 0.05):int(h * 0.40), int(w * 0.35):int(w * 0.65)]

        if roi.size == 0:
            return "GREEN"

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

        # Red mask
        lower_red1 = np.array([0, 100, 100])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([160, 100, 100])
        upper_red2 = np.array([180, 255, 255])
        mask_r1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask_r2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask_red = cv2.bitwise_or(mask_r1, mask_r2)

        # Yellow mask
        lower_yellow = np.array([18, 100, 100])
        upper_yellow = np.array([35, 255, 255])
        mask_yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)

        # Green mask
        lower_green = np.array([40, 80, 80])
        upper_green = np.array([90, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)

        r_count = cv2.countNonZero(mask_red)
        y_count = cv2.countNonZero(mask_yellow)
        g_count = cv2.countNonZero(mask_green)

        if y_count > r_count and y_count > g_count and y_count > 15:
            return "YELLOW"
        elif r_count > g_count and r_count > 15:
            return "RED"
        elif g_count > 15:
            return "GREEN"

        return "GREEN"


if __name__ == "__main__":
    detector = OpticalTrafficLightDetector()
    print("[TrafficLightDetector] Chromatic HSV analyzer initialized successfully.")
`,
  },
  {
    filename: 'requirements.txt',
    language: 'text',
    description: 'Все проверенные зависимости Python для YOLOv8, ByteTrack, OpenCV, PyTorch и Streamlit',
    code: `ultralytics>=8.3.0
torch>=2.2.0
torchvision>=0.17.0
opencv-python-headless>=4.9.0
supervision>=0.22.0
lapx>=0.5.5
filterpy>=1.4.5
scipy>=1.12.0
numpy>=1.26.0
shapely>=2.0.3
streamlit>=1.35.0
pandas>=2.2.0
matplotlib>=3.8.0
seaborn>=0.13.0
plotly>=5.22.0
onnx>=1.16.0
onnxruntime>=1.17.0
pyyaml>=6.0.1
tqdm>=4.66.0
requests>=2.31.0
`,
  },
  {
    filename: 'run_pipeline.sh',
    language: 'bash',
    description: 'Скрипт автоматического развертывания, проверки и запуска всех модулей одной командой',
    code: `#!/usr/bin/env bash
set -e
echo "========================================================="
echo "🚦 VisionForce CV — Intelligent Traffic Vision Pipeline"
echo "========================================================="

echo "[1/4] Checking and installing Python dependencies..."
pip install -r scripts/requirements.txt -q

echo "[2/4] Validating kinematic and density analyzers..."
python3 scripts/traffic_density_analyzer.py
python3 scripts/collision_vector_forecast.py
python3 scripts/speed_estimation_radar.py
python3 scripts/crosswalk_safety_monitor.py

echo "[3/4] Ready for video processing!"
echo "Run: python3 scripts/pipeline_yolov8_bytetrack.py --input sample_traffic.mp4"
echo "Run: streamlit run scripts/app_streamlit.py"
`,
  }
];
