#!/usr/bin/env python3
"""
VisionForce AI — Traffic Density & Road Occupancy Analyzer
Module: traffic_density_analyzer.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Calculates real-world Traffic Density, Road Spatial Occupancy (%), and Level of Service (LOS)
according to Highway Capacity Manual (HCM) & ГОСТ standards.
"""

try:
    import cv2
except ImportError:
    cv2 = None

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
        """
        :param road_roi_polygon: Normalized polygon coordinates of the drivable road surface.
        :param free_flow_speed: Target free-flow speed for the roadway segment (km/h).
        """
        poly_pts = [(0.10, 0.95), (0.35, 0.40), (0.65, 0.40), (0.90, 0.95)]
        self.road_area_normalized = calculate_polygon_area(poly_pts)
        if self.road_area_normalized <= 0:
            self.road_area_normalized = 0.45
            
        self.free_flow_speed = free_flow_speed

    def evaluate(self, detections: List[VehicleDetection]) -> TrafficDensityMetrics:
        """
        Evaluates traffic density from active vehicle detections.
        """
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

        for veh in vehicles:
            x1, y1, x2, y2 = veh.bbox
            w = max(0.01, x2 - x1)
            h = max(0.01, y2 - y1)
            total_veh_area += (w * h)

            if veh.speed_kmh > 3.0:
                moving_speeds.append(veh.speed_kmh)
            else:
                stopped_count += 1

        # Spatial Occupancy percentage
        road_occupancy_pct = min(100.0, round((total_veh_area / self.road_area_normalized) * 100.0, 1))

        # Average speed
        avg_speed_kmh = (sum(moving_speeds) / len(moving_speeds)) if moving_speeds else (0.0 if stopped_count > 0 else self.free_flow_speed)
        avg_speed_kmh = round(avg_speed_kmh, 1)

        speed_ratio = min(1.0, max(0.05, avg_speed_kmh / self.free_flow_speed))

        # Vehicles per km equivalent
        density_k = int(round(road_occupancy_pct * 1.75))

        # Highway Capacity Manual (HCM) LOS Classification
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
    
    # Test sample with 4 vehicles driving smoothly
    sample_traffic = [
        VehicleDetection(101, 'car', (0.35, 0.60, 0.45, 0.75), 52.4, True),
        VehicleDetection(102, 'car', (0.55, 0.62, 0.65, 0.77), 48.1, True),
        VehicleDetection(103, 'truck', (0.32, 0.42, 0.42, 0.55), 44.0, True),
    ]
    
    metrics = analyzer.evaluate(sample_traffic)
    print("=== Traffic Density & LOS Metrics ===")
    print(f"Road Spatial Occupancy: {metrics.road_occupancy_pct}%")
    print(f"Vehicle Density:        {metrics.vehicle_density_per_km} veh/km")
    print(f"Average Speed:          {metrics.avg_speed_kmh} km/h (Ratio: {metrics.speed_ratio})")
    print(f"Level of Service (LOS): {metrics.level_of_service} | Congestion Score: {metrics.congestion_score}/10")
    print(f"Traffic State:          {metrics.congestion_level}")
