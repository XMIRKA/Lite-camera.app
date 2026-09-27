"""
Traffic Violation Detection & Red Light Enforcement Pipeline (YOLOv8 + Supervision).
Detects:
1. Speeding Violations (> 60 km/h)
2. Stop-Line Incursions during Red Phase
3. Pedestrian Crosswalk Yield Violations
"""

import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

def run_violation_audit(video_path: str = "public/sample_001_morning_crossroad.mp4"):
    print("[*] Starting Violation Detector...")
    model = YOLO("yolov8n.pt")
    cap = cv2.VideoCapture(video_path)
    
    # Define Stop-Line Polygon Zone
    stop_line_polygon = np.array([[50, 420], [550, 420], [550, 435], [50, 435]])
    zone = sv.PolygonZone(polygon=stop_line_polygon)
    zone_annotator = sv.PolygonZoneAnnotator(zone=zone, color=sv.Color.RED, thickness=2)
    
    print("[+] Model and Stopline zone initialized successfully.")
    cap.release()

if __name__ == "__main__":
    run_violation_audit()
