#!/usr/bin/env python3
"""
VisionForce AI — YOLOv10 + DeepSORT End-to-End Speed Estimation & Traffic Analytics Pipeline.
Directly implements homography perspective transformation, polygon masking, speed accumulation,
and corner bounding box overlays from vehicle-speed-estimation-main.
"""

import os
import sys
import time
import argparse
import numpy as np
import cv2

try:
    from ultralytics import YOLO
    from deep_sort_realtime.deepsort_tracker import DeepSort
except ImportError:
    YOLO = None
    DeepSort = None

# Add root directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from speed_estimation import run_speed_estimation, draw_corner_rect, calculate_speed, calculate_distance


def parse_args():
    parser = argparse.ArgumentParser(description="YOLOv10 + DeepSORT Speed Tracking Pipeline")
    parser.add_argument("--input", "--video", dest="video", type=str, default="vehicle-speed-estimation-main/content/highway.mp4", help="Input video")
    parser.add_argument("--output", type=str, default="output_processed.mp4", help="Output video")
    parser.add_argument("--weights", type=str, default="yolov10n.pt", help="YOLOv10 weights")
    parser.add_argument("--conf", type=float, default=0.45, help="Confidence threshold")
    parser.add_argument("--speed-limit", dest="speed_limit", type=float, default=80.0, help="Speed limit in km/h")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_speed_estimation(
        video_path=args.video,
        output_path=args.output,
        weights_path=args.weights,
        conf_thresh=args.conf,
        speed_limit_kmh=args.speed_limit,
        headless=True
    )
