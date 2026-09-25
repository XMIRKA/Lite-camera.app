#!/usr/bin/env python3
"""
VisionForce AI — Official Traffic Event Post-Processing & Rule Engine
Module: event_smoothing_and_rules.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Implements Contest Specifications:
1. stopped_vehicle: Vehicle track speed ≈ 0 km/h for > 10.0 seconds.
2. congestion: Massive multi-lane vehicle standstill or road occupancy bottleneck.
3. solid_line_crossing: Wheel contact point (bottom-center of bbox) crossing solid lane markings.
4. fire_smoke / road_obstacle: Lightweight binary classification & debris contour detection.
5. Temporal Smoothing & Debouncing:
   - Gap-merging: Unifies intervals of identical class if gap < 1.5 - 2.0 s.
   - De-noising: Removes micro-segments with duration < 0.5 s.
"""

from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
import math


@dataclass
class RawEventSegment:
    start_sec: float
    end_sec: float
    label: str
    confidence: float
    details: str = ""


class EventSmoothingAndRuleEngine:
    def __init__(self, min_duration_sec: float = 0.5, max_merge_gap_sec: float = 1.5):
        self.min_duration_sec = min_duration_sec
        self.max_merge_gap_sec = max_merge_gap_sec

    def smooth_and_debounce(self, events: List[RawEventSegment]) -> List[RawEventSegment]:
        """
        Applies Temporal Union (gap < 1.5s) and De-noising (duration >= 0.5s)
        """
        if not events:
            return []

        # Group by label
        by_label: Dict[str, List[RawEventSegment]] = {}
        for evt in events:
            by_label.setdefault(evt.label, []).append(evt)

        final_result: List[RawEventSegment] = []

        for label, seg_list in by_label.items():
            # 1. Sort by start_sec
            seg_list.sort(key=lambda x: x.start_sec)

            # 2. Merge overlapping or near segments
            merged: List[RawEventSegment] = []
            curr: Optional[RawEventSegment] = None

            for seg in seg_list:
                if curr is None:
                    curr = RawEventSegment(
                        start_sec=seg.start_sec,
                        end_sec=seg.end_sec,
                        label=seg.label,
                        confidence=seg.confidence,
                        details=seg.details
                    )
                else:
                    if seg.start_sec <= curr.end_sec + self.max_merge_gap_sec:
                        curr.end_sec = max(curr.end_sec, seg.end_sec)
                        curr.confidence = max(curr.confidence, seg.confidence)
                    else:
                        merged.append(curr)
                        curr = RawEventSegment(
                            start_sec=seg.start_sec,
                            end_sec=seg.end_sec,
                            label=seg.label,
                            confidence=seg.confidence,
                            details=seg.details
                        )

            if curr is not None:
                merged.append(curr)

            # 3. Debounce: Remove duration < min_duration_sec
            for m in merged:
                duration = m.end_sec - m.start_sec
                if duration >= self.min_duration_sec:
                    final_result.append(RawEventSegment(
                        start_sec=round(m.start_sec, 2),
                        end_sec=round(m.end_sec, 2),
                        label=m.label,
                        confidence=round(m.confidence, 3),
                        details=m.details
                    ))

        final_result.sort(key=lambda x: x.start_sec)
        return final_result

    @staticmethod
    def check_solid_line_crossing(
        p_prev: Tuple[float, float],
        p_curr: Tuple[float, float],
        solid_line_p1: Tuple[float, float],
        solid_line_p2: Tuple[float, float]
    ) -> bool:
        """
        Wheel contact point intersection with solid line marking segment
        """
        def ccw(a, b, c):
            return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])

        return (
            ccw(p_prev, solid_line_p1, solid_line_p2) != ccw(p_curr, solid_line_p1, solid_line_p2) and
            ccw(p_prev, p_curr, solid_line_p1) != ccw(p_prev, p_curr, solid_line_p2)
        )

    @staticmethod
    def evaluate_stopped_vehicle(
        vehicle_id: int,
        speed_history_kmh: List[float],
        duration_below_threshold_sec: float,
        is_at_red_signal_queue: bool = False
    ) -> Optional[RawEventSegment]:
        """
        stopped_vehicle: Speed ≈ 0 for > 10.0 seconds outside signal queue
        """
        if duration_below_threshold_sec >= 10.0 and not is_at_red_signal_queue:
            return RawEventSegment(
                start_sec=0.0,  # Offset to be set by stream timeline
                end_sec=duration_below_threshold_sec,
                label="stopped_vehicle",
                confidence=0.92,
                details=f"Vehicle #{vehicle_id} stopped on carriageway for {duration_below_threshold_sec:.1f}s"
            )
        return None


if __name__ == "__main__":
    engine = EventSmoothingAndRuleEngine(min_duration_sec=0.5, max_merge_gap_sec=1.5)

    # Test raw segments with jitter and near-intervals
    raw_detections = [
        RawEventSegment(start_sec=2.1, end_sec=2.3, label="near_miss", confidence=0.85),  # 0.2s (Spike -> should filter)
        RawEventSegment(start_sec=4.0, end_sec=5.2, label="near_miss", confidence=0.89),
        RawEventSegment(start_sec=5.8, end_sec=7.1, label="near_miss", confidence=0.94),  # Gap = 0.6s -> should merge [4.0, 7.1]
        RawEventSegment(start_sec=12.0, end_sec=24.5, label="stopped_vehicle", confidence=0.95),
        RawEventSegment(start_sec=15.0, end_sec=28.0, label="congestion", confidence=0.91),
    ]

    smoothed = engine.smooth_and_debounce(raw_detections)
    print("=== Filtered & Smoothed Events ===")
    for evt in smoothed:
        print(f"[{evt.label}] {evt.start_sec}s -> {evt.end_sec}s (duration: {evt.end_sec - evt.start_sec:.2f}s, conf: {evt.confidence})")
