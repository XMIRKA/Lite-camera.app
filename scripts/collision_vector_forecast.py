#!/usr/bin/env python3
"""
VisionForce AI — Collision Vector & TTC Forecaster
Module: collision_vector_forecast.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Calculates pairwise vector kinematics, closure velocity (V_closing), and Time-To-Collision (TTC)
to accurately predict hazardous traffic conflicts while eliminating false alarms.
"""

import math
from dataclasses import dataclass
from typing import List, Optional, Tuple


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
    threat_type: str  # VEHICLE_PEDESTRIAN, REAR_END, INTERSECTION_CROSSING
    is_critical: bool


class CollisionForecaster:
    def __init__(self, perspective_base: float = 14.0, perspective_gradient: float = 24.0):
        self.perspective_base = perspective_base
        self.perspective_gradient = perspective_gradient

    def evaluate_pair(self, e1: TrackedEntity, e2: TrackedEntity) -> Optional[CollisionForecastResult]:
        is_e1_ped = e1.cls_name in ['person', 'pedestrian']
        is_e2_ped = e2.cls_name in ['person', 'pedestrian']
        
        # Pedestrian-pedestrian proximity is safe walking
        if is_e1_ped and is_e2_ped:
            return None

        # Both stationary (stopped in queue / parking) -> No collision
        if e1.speed_kmh < 3.0 and e2.speed_kmh < 3.0:
            return None

        # Metric ground distance
        dx = e2.center_x - e1.center_x
        dy = e2.bottom_y - e1.bottom_y
        norm_dist = math.hypot(dx, dy)

        avg_y = (e1.bottom_y + e2.bottom_y) / 2.0
        meter_scale = self.perspective_base + avg_y * self.perspective_gradient
        dist_meters = norm_dist * meter_scale

        # Velocity vectors in m/s
        v1_ms = e1.speed_kmh / 3.6
        v2_ms = e2.speed_kmh / 3.6

        # Relative velocity
        rel_vx = (e2.vx * v2_ms) - (e1.vx * v1_ms)
        rel_vy = (e2.vy * v2_ms) - (e1.vy * v1_ms)
        rel_v_sq = rel_vx * rel_vx + rel_vy * rel_vy

        if rel_v_sq < 2.25:  # < 1.5 m/s relative motion
            return None

        # Closing rate (dot product of displacement and relative velocity)
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

        # Miss distance at closest point of approach
        cpa_x = rx_meters + rel_vx * t_cpa
        cpa_y = ry_meters + rel_vy * t_cpa
        miss_dist = math.hypot(cpa_x, cpa_y)

        is_ped_conflict = is_e1_ped or is_e2_ped

        if is_ped_conflict:
            # Pedestrian conflict requires direct collision corridor (< 0.95m miss distance)
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
            # Parallel lanes or vehicles passing in adjacent paths have miss distance > 1.10m
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
    # Test case: Car approaching pedestrian on crosswalk
    car = TrackedEntity(101, 'car', 0.45, 0.65, 0.0, 1.0, 42.0)
    ped = TrackedEntity(205, 'person', 0.46, 0.70, 0.0, 0.2, 4.8)

    alert = forecaster.evaluate_pair(car, ped)
    if alert:
        print(f"⚠️ HAZARD DETECTED: {alert.threat_type}")
        print(f"Distance: {alert.distance_meters}m | TTC: {alert.ttc_seconds}s | Closing Speed: {alert.closing_speed_kmh} km/h")
        print(f"Critical Severity: {alert.is_critical}")
    else:
        print("✅ Safe trajectory. No collision anticipated.")
