"""
Vehicle Speed Estimation & Multi-Object Tracking using YOLOv8, ByteTrack & Supervision.
Official Hackathon Pipeline for Traffic Video Analytics.
"""

import argparse
from collections import defaultdict, deque
import cv2
import numpy as np
import supervision as sv
from ultralytics import YOLO

# Calibrated Perspective Matrix for Road Homography (Pixels -> Real Meters)
# SOURCE: 4 Points on road quadrilateral [Top-Left, Top-Right, Bottom-Right, Bottom-Left]
SOURCE = np.array([
    [420, 220],
    [860, 220],
    [1240, 680],
    [60, 680]
])

# TARGET: Real-world rectangular dimensions in meters (e.g. 18m width x 60m road stretch)
TARGET = np.array([
    [0, 0],
    [18, 0],
    [18, 60],
    [0, 60]
])

class ViewTransformer:
    def __init__(self, source: np.ndarray, target: np.ndarray):
        source = source.astype(np.float32)
        target = target.astype(np.float32)
        self.m = cv2.getPerspectiveTransform(source, target)

    def transform_points(self, points: np.ndarray) -> np.ndarray:
        if points.size == 0:
            return points
        reshaped = points.reshape(-1, 1, 2).astype(np.float32)
        transformed = cv2.perspectiveTransform(reshaped, self.m)
        return transformed.reshape(-1, 2)


def process_video(
    source_weights: str = "yolov8n.pt",
    source_video_path: str = "sample_001.mp4",
    target_video_path: str = "output_speed_estimated.mp4",
    confidence_threshold: float = 0.35,
    iou_threshold: float = 0.5,
    speed_limit: float = 60.0
):
    print(f"[*] Initializing YOLOv8 model: {source_weights}")
    model = YOLO(source_weights)

    # Setup Video Info & ByteTrack
    video_info = sv.VideoInfo.from_video_path(source_video_path)
    byte_tracker = sv.ByteTrack(
        track_activation_threshold=confidence_threshold,
        lost_track_buffer=video_info.fps * 2,
        minimum_matching_threshold=0.8,
        frame_rate=video_info.fps
    )

    # Initialize Homography Matrix
    view_transformer = ViewTransformer(source=SOURCE, target=TARGET)

    # Setup Supervision Annotators
    corner_annotator = sv.BoxCornerAnnotator(
        thickness=2,
        corner_length=12,
        color=sv.ColorPalette.from_hex(["#06b6d4", "#10b981", "#f59e0b", "#38bdf8"])
    )
    box_annotator = sv.BoxAnnotator(thickness=2)
    label_annotator = sv.LabelAnnotator(
        text_scale=0.5,
        text_thickness=1,
        text_padding=6,
        text_position=sv.Position.TOP_LEFT
    )
    trace_annotator = sv.TraceAnnotator(
        thickness=2,
        trace_length=video_info.fps * 2,
        position=sv.Position.BOTTOM_CENTER
    )

    # Tracking storage
    coordinates = defaultdict(lambda: deque(maxlen=video_info.fps))
    speeds = defaultdict(lambda: deque(maxlen=video_info.fps // 2))
    class_votes = defaultdict(lambda: deque(maxlen=15))
    ema_boxes = {}

    frame_generator = sv.get_video_frames_generator(source_path=source_video_path)
    
    with sv.VideoSink(target_path=target_video_path, video_info=video_info) as sink:
        for frame_idx, frame in enumerate(frame_generator):
            # 1. Run YOLOv8 Inference
            result = model(frame, conf=confidence_threshold, iou=iou_threshold, verbose=False)[0]
            detections = sv.Detections.from_ultralytics(result)

            # Filter for traffic classes: 0: person, 1: bicycle, 2: car, 3: motorcycle, 5: bus, 7: truck
            valid_classes = [0, 1, 2, 3, 5, 7]
            detections = detections[np.isin(detections.class_id, valid_classes)]

            # 2. Update ByteTrack
            detections = byte_tracker.update_with_detections(detections)

            if len(detections) > 0 and detections.tracker_id is not None:
                # EMA Bounding Box Smoothing (80% старое + 20% новое)
                smoothed_boxes = []
                for tid, b in zip(detections.tracker_id, detections.xyxy):
                    if tid not in ema_boxes:
                        ema_boxes[tid] = np.array(b, dtype=np.float32)
                    else:
                        ema_boxes[tid] = 0.80 * ema_boxes[tid] + 0.20 * np.array(b, dtype=np.float32)
                    smoothed_boxes.append(ema_boxes[tid])
                detections.xyxy = np.array(smoothed_boxes, dtype=np.float32)

            # 3. Transform anchor points to real-world meters
            points = detections.get_anchors_coordinates(anchor=sv.Position.BOTTOM_CENTER)
            transformed_points = view_transformer.transform_points(points=points)

            labels = []
            for tracker_id, [x, y], class_id in zip(detections.tracker_id, transformed_points, detections.class_id):
                # Class Voting (15 frames)
                class_votes[tracker_id].append(class_id)
                v_counts = defaultdict(int)
                for c in class_votes[tracker_id]:
                    v_counts[c] += 1
                stable_class_id = max(v_counts.items(), key=lambda item: item[1])[0]

                coordinates[tracker_id].append((x, y))
                
                # Class name mapping
                class_name = model.names[stable_class_id].upper()

                # Calculate speed over time window (at least 0.3s)
                if len(coordinates[tracker_id]) > video_info.fps // 3:
                    coords = coordinates[tracker_id]
                    dist_meters = np.hypot(coords[-1][0] - coords[0][0], coords[-1][1] - coords[0][1])
                    time_seconds = len(coords) / video_info.fps
                    speed_kmh = (dist_meters / time_seconds) * 3.6

                    # Apply class physics limits
                    if stable_class_id == 0: # Person
                        speed_kmh = min(6.0, max(2.8, speed_kmh))
                    elif stable_class_id in [1, 3]: # Bicycle / Motorcycle
                        speed_kmh = min(45.0, max(12.0, speed_kmh))

                    speeds[tracker_id].append(speed_kmh)
                    avg_speed = np.mean(speeds[tracker_id])
                    
                    status = " [SPEEDING!]" if avg_speed > speed_limit and stable_class_id != 0 else ""
                    labels.append(f"#{tracker_id} {class_name} | {avg_speed:.1f} km/h{status}")
                else:
                    labels.append(f"#{tracker_id} {class_name} | CALC...")

            # 4. Annotate Video Frame
            annotated_frame = frame.copy()
            annotated_frame = trace_annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = corner_annotator.annotate(scene=annotated_frame, detections=detections)
            annotated_frame = label_annotator.annotate(scene=annotated_frame, detections=detections, labels=labels)

            sink.write_frame(frame=annotated_frame)
            if frame_idx % 30 == 0:
                print(f"[+] Processed frame {frame_idx}/{video_info.total_frames}")

    print(f"[✓] Speed estimation complete. Output saved to: {target_video_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="YOLOv8 + ByteTrack Traffic Speed Radar")
    parser.add_argument("--weights", type=str, default="yolov8n.pt", help="YOLO model weights path")
    parser.add_argument("--source", type=str, default="public/sample_001_morning_crossroad.mp4", help="Video source")
    parser.add_argument("--output", type=str, default="output_speed.mp4", help="Output path")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold")
    args = parser.parse_args()

    process_video(
        source_weights=args.weights,
        source_video_path=args.source,
        target_video_path=args.output,
        confidence_threshold=args.conf
    )
