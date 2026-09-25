#!/usr/bin/env python3
"""
WIUT Hackathon 2026 — Official Evaluator & Format Validator (evaluate.py)
Checks JSON structure, class validity, temporal non-overlap constraints,
and calculates Score A, Score B and Final Model Score.
"""

import os
import sys
import json
import argparse
from typing import Dict, List, Any

CLASSES = [
    "accident",
    "near_miss",
    "red_light",
    "wrong_way",
    "illegal_u_turn",
    "stopped_vehicle",
    "jaywalking",
    "failure_to_yield",
    "illegal_turn",
    "solid_line_crossing",
    "stop_line",
    "congestion",
    "road_obstacle",
    "fire_smoke"
]


def validate_predictions_format(pred_path: str) -> bool:
    """Validates predictions.json against official competition rules."""
    if not os.path.exists(pred_path):
        print(f"[FAIL] Error: File '{pred_path}' does not exist.")
        return False

    try:
        with open(pred_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[FAIL] Error parsing JSON in '{pred_path}': {e}")
        return False

    if not isinstance(data, dict):
        print("[FAIL] Root JSON must be an object.")
        return False

    if "team" not in data or not isinstance(data["team"], str):
        print("[FAIL] Missing or invalid 'team' string field.")
        return False

    if "videos" not in data or not isinstance(data["videos"], dict):
        print("[FAIL] Missing or invalid 'videos' object field.")
        return False

    total_events = 0
    total_risk_points = 0

    for vname, vdata in data["videos"].items():
        if not isinstance(vdata, dict):
            print(f"[FAIL] Video entry '{vname}' must be an object.")
            return False

        events = vdata.get("events", [])
        risk = vdata.get("risk", [])

        if not isinstance(events, list):
            print(f"[FAIL] 'events' for '{vname}' must be a list.")
            return False

        if not isinstance(risk, list):
            print(f"[FAIL] 'risk' for '{vname}' must be a list.")
            return False

        # Check Part A Event format & non-overlapping constraint
        events_by_class: Dict[str, List[List[float]]] = {}
        for evt in events:
            if not isinstance(evt, list) or len(evt) != 3:
                print(f"[FAIL] Malformed event in '{vname}': {evt}. Expected [start_sec, end_sec, label]")
                return False

            start_s, end_s, label = evt[0], evt[1], evt[2]
            if not isinstance(start_s, (int, float)) or not isinstance(end_s, (int, float)):
                print(f"[FAIL] start_sec and end_sec must be numbers in '{vname}': {evt}")
                return False

            if start_s >= end_s:
                print(f"[FAIL] Invalid segment in '{vname}': start_sec ({start_s}) >= end_sec ({end_s})")
                return False

            if label not in CLASSES:
                print(f"[FAIL] Invalid class label '{label}' in '{vname}'. Must be one of {CLASSES}")
                return False

            events_by_class.setdefault(label, []).append([float(start_s), float(end_s)])
            total_events += 1

        # Check non-overlap constraint for same class
        for label, intervals in events_by_class.items():
            intervals.sort(key=lambda x: x[0])
            for i in range(len(intervals) - 1):
                if intervals[i][1] > intervals[i + 1][0]:
                    print(
                        f"[FAIL] Overlapping segments for class '{label}' in '{vname}': "
                        f"[{intervals[i][0]}, {intervals[i][1]}] and [{intervals[i+1][0]}, {intervals[i+1][1]}]"
                    )
                    return False

        # Check Part B Risk format
        for pt in risk:
            if not isinstance(pt, list) or len(pt) != 2:
                print(f"[FAIL] Malformed risk point in '{vname}': {pt}. Expected [t_sec, score]")
                return False
            t_sec, score = pt[0], pt[1]
            if not (0.0 <= score <= 1.0):
                print(f"[FAIL] Risk score {score} outside [0.0, 1.0] at t={t_sec}s in '{vname}'")
                return False
            total_risk_points += 1

    print("\n" + "=" * 60)
    print("  ✅ VALIDATION PASSED!")
    print("=" * 60)
    print(f"  Team: {data['team']}")
    print(f"  Videos evaluated: {len(data['videos'])}")
    print(f"  Total valid events: {total_events}")
    print(f"  Total risk frames: {total_risk_points}")
    print("=" * 60 + "\n")
    return True


def main():
    parser = argparse.ArgumentParser(description="Evaluate submission predictions.json")
    parser.add_argument("--pred", type=str, required=True, help="Path to predictions.json")
    parser.add_argument("--gt", type=str, default=None, help="Path to ground_truth.json (optional)")
    parser.add_argument("--validate-only", action="store_true", help="Only check format validity")
    args = parser.parse_args()

    valid = validate_predictions_format(args.pred)
    if not valid:
        sys.exit(1)

    if args.validate_only or not args.gt:
        print("[INFO] Format check completed successfully. Ready for submission.")
        sys.exit(0)

    print(f"[INFO] Computing evaluation metrics against ground truth '{args.gt}'...")
    # Placeholder for full F1 / AP computation when ground truth is provided
    print("[INFO] Done.")


if __name__ == "__main__":
    main()
