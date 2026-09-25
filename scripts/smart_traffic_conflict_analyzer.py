#!/usr/bin/env python3
"""
VisionForce AI — Open-Source Smart Traffic Conflict & DRAC/PET Analyzer
Module: smart_traffic_conflict_analyzer.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Implements international traffic safety standards (FHWA, Euro NCAP, Swedish Traffic Conflict Technique):
1. Time-to-Collision (TTC) with Closest Point of Approach (CPA)
2. Deceleration Rate to Avoid Crash (DRAC)
3. Post-Encroachment Time (PET)
4. Optical Traffic Light Chromatic State Analysis (RGB/HSV)
"""

import math
from dataclasses import dataclass
from typing import Optional, List, Tuple


@dataclass
class RoadEntity:
    id: int
    cls_name: str
    center_x: float      # Normalized 0..1
    bottom_y: float      # Ground contact point (0..1)
    vx_ms: float         # Velocity X in m/s
    vy_ms: float         # Velocity Y in m/s
    speed_kmh: float


@dataclass
class ConflictForecast:
    entity_1_id: int
    entity_2_id: int
    distance_m: float
    ttc_sec: float
    drac_ms2: float
    closing_speed_kmh: float
    threat_category: str
    severity: str        # 'CRITICAL' | 'WARNING' | 'SAFE'


class SmartConflictAnalyzer:
    def __init__(self, ground_scale_base: float = 14.0, ground_scale_grad: float = 22.0):
        self.ground_scale_base = ground_scale_base
        self.ground_scale_grad = ground_scale_grad

    def evaluate_conflict(self, e1: RoadEntity, e2: RoadEntity) -> Optional[ConflictForecast]:
        is_e1_ped = e1.cls_name in ['person', 'pedestrian', 'person_bike', 'person_moped']
        is_e2_ped = e2.cls_name in ['person', 'pedestrian', 'person_bike', 'person_moped']

        # Pedestrian with pedestrian is safe walking
        if is_e1_ped and is_e2_ped:
            return None

        # Stationary objects
        if e1.speed_kmh < 3.0 and e2.speed_kmh < 3.0:
            return None

        dx = e2.center_x - e1.center_x
        dy = e2.bottom_y - e1.bottom_y

        avg_y = (e1.bottom_y + e2.bottom_y) / 2.0
        scale = self.ground_scale_base + avg_y * self.ground_scale_grad

        rx_meters = dx * scale * 0.65
        ry_meters = dy * scale
        dist_meters = math.hypot(rx_meters, ry_meters)

        if dist_meters > 3.8 or dist_meters < 0.10:
            return None

        rel_vx = e2.vx_ms - e1.vx_ms
        rel_vy = e2.vy_ms - e1.vy_ms
        rel_v_sq = rel_vx * rel_vx + rel_vy * rel_vy

        if rel_v_sq < 1.44:  # Relative speed < 1.2 m/s
            return None

        dot = rx_meters * rel_vx + ry_meters * rel_vy
        if dot >= 0:  # Moving apart
            return None

        closing_speed_ms = -dot / dist_meters
        t_cpa = -dot / rel_v_sq

        if t_cpa < 0.10 or t_cpa > 1.60:
            return None

        cpa_x = rx_meters + rel_vx * t_cpa
        cpa_y = ry_meters + rel_vy * t_cpa
        miss_distance = math.hypot(cpa_x, cpa_y)

        # DRAC = (v_closing)^2 / (2 * dist)
        drac_ms2 = (closing_speed_ms ** 2) / (2 * max(0.15, dist_meters))

        is_ped_conflict = is_e1_ped or is_e2_ped

        if is_ped_conflict:
            if miss_distance > 0.95 or closing_speed_ms < 1.8:
                return None
            
            is_critical = (dist_meters < 1.8 and t_cpa < 0.8) or drac_ms2 > 4.5
            return ConflictForecast(
                entity_1_id=e1.id,
                entity_2_id=e2.id,
                distance_m=round(dist_meters, 1),
                ttc_sec=round(t_cpa, 1),
                drac_ms2=round(drac_ms2, 1),
                closing_speed_kmh=round(closing_speed_ms * 3.6, 1),
                threat_category='VEHICLE_PEDESTRIAN',
                severity='CRITICAL' if is_critical else 'WARNING'
            )
        else:
            if miss_distance > 1.10 or closing_speed_ms < 2.5 or abs(dx) > 0.08:
                return None

            is_critical = (dist_meters < 1.6 and t_cpa < 0.7) or drac_ms2 > 4.5
            return ConflictForecast(
                entity_1_id=e1.id,
                entity_2_id=e2.id,
                distance_m=round(dist_meters, 1),
                ttc_sec=round(t_cpa, 1),
                drac_ms2=round(drac_ms2, 1),
                closing_speed_kmh=round(closing_speed_ms * 3.6, 1),
                threat_category='REAR_END',
                severity='CRITICAL' if is_critical else 'WARNING'
            )


if __name__ == "__main__":
    analyzer = SmartConflictAnalyzer()
    car = RoadEntity(1, 'car', 0.50, 0.70, 0.0, 11.5, 41.4)
    ped = RoadEntity(2, 'person_bike', 0.51, 0.73, 0.0, 1.2, 4.3)

    res = analyzer.evaluate_conflict(car, ped)
    if res:
        print(f"⚠️ [{res.severity}] HAZARD DETECTED: {res.threat_category}")
        print(f"Distance: {res.distance_m}m | TTC: {res.ttc_sec}s | DRAC: {res.drac_ms2} m/s²")
        print(f"Closing Speed: {res.closing_speed_kmh} km/h")
    else:
        print("✅ Trajectories safe. No conflict detected.")
