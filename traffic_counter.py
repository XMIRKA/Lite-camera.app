"""
Directional Traffic Flow Counter & Turn-Movement Analysis (YOLOv8 + ByteTrack + Supervision LineZone).
"""

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

def run_traffic_counter(video_path: str = "public/sample_001_morning_crossroad.mp4"):
    print("[*] Initializing Directional Line Counter...")
    model = YOLO("yolov8n.pt")
    
    # In / Out Crossing Lines
    line_start = sv.Point(50, 480)
    line_end = sv.Point(1200, 480)
    line_zone = sv.LineZone(start=line_start, end=line_end)
    line_annotator = sv.LineZoneAnnotator(thickness=2, text_thickness=1, text_scale=0.5)
    
    print("[+] Line Zone initialized. In count: 0, Out count: 0")

if __name__ == "__main__":
    run_traffic_counter()
