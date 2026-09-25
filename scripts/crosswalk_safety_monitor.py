#!/usr/bin/env python3
"""
VisionForce AI — Crosswalk Safety & Yield Violation Monitor
File: crosswalk_safety_monitor.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Features:
- Region of Interest (ROI) Crosswalk Polygon Containment
- Detection of Vehicles failing to yield to Pedestrians on Crosswalk
- Automated Timestamped Incident Snapshot & Telemetry Logging
"""

import math
import json
import time
from typing import List, Dict, Tuple, Optional

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None


def point_in_polygon_raycast(px: float, py: float, polygon: List[Tuple[float, float]]) -> bool:
    """Ray-casting point in polygon test in pure Python."""
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
        """Point-in-polygon test."""
        return point_in_polygon_raycast(norm_x, norm_y, self.poly)

    def evaluate_frame(
        self,
        tracked_objects: List[Dict],
        timestamp_sec: float
    ) -> List[Dict]:
        """
        tracked_objects: list of dicts with keys:
          'id', 'cls', 'cx', 'bottom_y', 'speed_kmh', 'bbox'
        """
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

        # If pedestrian is on crosswalk, inspect all moving vehicles in proximity
        if len(active_peds_on_crosswalk) > 0:
            for ped in active_peds_on_crosswalk:
                for veh in active_vehicles:
                    veh_id = veh['id']
                    # Vehicle moving through crosswalk without yielding
                    veh_in_crosswalk = self.is_point_inside(veh['cx'], veh['bottom_y'])
                    
                    # Proximity
                    dx = veh['cx'] - ped['cx']
                    dy = veh['bottom_y'] - ped['bottom_y']
                    dist = math.hypot(dx, dy)

                    if (veh_in_crosswalk or dist < 0.12) and veh['speed_kmh'] > 12.0:
                        # Throttle duplicate alerts per vehicle ID
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
