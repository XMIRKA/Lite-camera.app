#!/usr/bin/env python3
"""
WIUT Hackathon 2026 — Official Harness (run_submission.py)
Iterates over a folder of videos, runs Part A & Part B, and writes predictions.json.
"""

import os
import cv2
import json
import time
import argparse
from solution import detect_events, RiskEstimator, CLASSES


def main():
    parser = argparse.ArgumentParser(description="Run submission against video directory")
    parser.add_argument("--videos", type=str, default="samples", help="Path to input videos directory")
    parser.add_argument("--out", type=str, default="predictions.json", help="Path to output predictions.json")
    parser.add_argument("--team", type=str, default="VisionForce-WIUT", help="Team identifier")
    args = parser.parse_args()

    if not os.path.exists(args.videos):
        print(f"Directory {args.videos} does not exist. Creating empty sample folder.")
        os.makedirs(args.videos, exist_ok=True)

    video_files = sorted([
        f for f in os.listdir(args.videos)
        if f.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))
    ])

    results = {
        "team": args.team,
        "videos": {}
    }

    print(f"Found {len(video_files)} video(s) in '{args.videos}'. Starting evaluation harness...")

    for vname in video_files:
        vpath = os.path.join(args.videos, vname)
        print(f"\n[Processing] -> {vname}")
        t_start = time.time()

        cap = cv2.VideoCapture(vpath)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)

        meta = {
            "video_id": vname,
            "fps": fps,
            "width": width,
            "height": height,
            "n_frames": total_frames
        }

        # --- PART A: Event Detection ---
        try:
            events = detect_events(vpath, meta=meta)
            # Basic validation
            clean_events = []
            for e in events:
                if len(e) == 3 and e[2] in CLASSES and float(e[0]) < float(e[1]):
                    clean_events.append([round(float(e[0]), 2), round(float(e[1]), 2), str(e[2])])
        except Exception as ex:
            print(f"Error in detect_events for {vname}: {ex}")
            clean_events = []

        # --- PART B: Causal Accident Anticipation ---
        risk_curve = []
        try:
            estimator = RiskEstimator()
            estimator.reset(meta)
            frame_idx = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                t_sec = float(frame_idx / fps)
                score = estimator.step(frame, t_sec)
                risk_curve.append([round(t_sec, 2), round(float(score), 3)])
                frame_idx += 1
        except Exception as ex:
            print(f"Error in RiskEstimator for {vname}: {ex}")
            risk_curve = []
        finally:
            cap.release()

        elapsed = time.time() - t_start
        print(f"Done {vname} in {elapsed:.2f}s | Events: {len(clean_events)} | Risk frames: {len(risk_curve)}")

        results["videos"][vname] = {
            "events": clean_events,
            "risk": risk_curve
        }

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n[SUCCESS] Successfully written predictions to '{args.out}'.")


if __name__ == "__main__":
    main()
