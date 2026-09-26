"""
Vehicle Speed Estimation & Multi-Object Tracking using YOLOv10 & DeepSORT.
Integrated from vehicle-speed-estimation-main with Perspective Homography & Polygon ROI Masking.
"""

import os
import time
import argparse

try:
    import numpy as np
except ImportError:
    np = None

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import torch
    from ultralytics import YOLO
    from deep_sort_realtime.deepsort_tracker import DeepSort
except ImportError:
    torch = None
    YOLO = None
    DeepSort = None


def parse_args():
    parser = argparse.ArgumentParser(description="YOLOv10 + DeepSORT Vehicle Speed Estimation")
    parser.add_argument(
        "--video",
        type=str,
        default="vehicle-speed-estimation-main/content/highway.mp4",
        help="Path to input video file"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output_speed_estimated.mp4",
        help="Path to output video file"
    )
    parser.add_argument(
        "--weights",
        type=str,
        default="yolov10n.pt",
        help="YOLOv10 model weights (e.g. yolov10n.pt, yolov10s.pt, yolov10m.pt)"
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.45,
        help="Confidence threshold for detection"
    )
    parser.add_argument(
        "--class_id",
        type=int,
        default=None,
        help="Optional class ID to track specifically (e.g. 2 for car, 5 for bus, 7 for truck)"
    )
    parser.add_argument(
        "--blur_id",
        type=int,
        default=None,
        help="Optional class ID to apply Gaussian Blur (e.g. for privacy)"
    )
    parser.add_argument(
        "--speed_limit",
        type=float,
        default=80.0,
        help="Speed limit in km/h to flag speeding vehicles"
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run without cv2.imshow GUI window (ideal for server/cloud headless environments)"
    )
    return parser.parse_args()


def draw_corner_rect(img, bbox, line_length=20, line_thickness=3, rect_thickness=1,
                     rect_color=(255, 0, 255), line_color=(0, 255, 0)):
    """Draws high-tech cybernetic corner brackets around detected vehicles."""
    x, y, w, h = bbox
    x1, y1 = x + w, y + h

    if rect_thickness != 0:
        cv2.rectangle(img, (x, y), (x1, y1), rect_color, rect_thickness)

    # Top Left (x, y)
    cv2.line(img, (x, y), (x + line_length, y), line_color, line_thickness)
    cv2.line(img, (x, y), (x, y + line_length), line_color, line_thickness)

    # Top Right (x1, y)
    cv2.line(img, (x1, y), (x1 - line_length, y), line_color, line_thickness)
    cv2.line(img, (x1, y), (x1, y + line_length), line_color, line_thickness)

    # Bottom Left (x, y1)
    cv2.line(img, (x, y1), (x + line_length, y1), line_color, line_thickness)
    cv2.line(img, (x, y1), (x, y1 - line_length), line_color, line_thickness)

    # Bottom Right (x1, y1)
    cv2.line(img, (x1, y1), (x1 - line_length, y1), line_color, line_thickness)
    cv2.line(img, (x1, y1), (x1, y1 - line_length), line_color, line_thickness)

    return img


def calculate_speed(distance_meters: float, fps: float) -> float:
    """Calculates instantaneous speed in km/h based on Bird's-Eye View distance."""
    return (distance_meters * fps) * 3.6


def calculate_distance(p1, p2) -> float:
    """Euclidean distance in Bird's-Eye View coordinate frame."""
    return float(np.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2))


def load_coco_class_names() -> list[str]:
    """Loads COCO 80 class names from local configs or fallback."""
    candidate_paths = [
        "configs/coco.names",
        "vehicle-speed-estimation-main/configs/coco.names",
        os.path.join(os.path.dirname(__file__), "vehicle-speed-estimation-main/configs/coco.names")
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                return [line.strip() for line in f.read().splitlines() if line.strip()]

    # Fallback standard COCO classes
    return [
        "person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train", "truck", "boat",
        "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
        "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
        "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
        "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
        "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
        "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake",
        "chair", "sofa", "potted plant", "bed", "dining table", "toilet", "tvmonitor", "laptop",
        "mouse", "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
        "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
    ]


def run_speed_estimation(
    video_path: str = "vehicle-speed-estimation-main/content/highway.mp4",
    output_path: str = "output_speed_estimated.mp4",
    weights_path: str = "yolov10n.pt",
    conf_thresh: float = 0.45,
    target_class_id: int | None = None,
    blur_class_id: int | None = None,
    speed_limit_kmh: float = 80.0,
    headless: bool = True
):
    """
    Main YOLOv10 + DeepSORT execution pipeline.
    Estimates vehicle speeds via Homography Perspective Transformation and tracks across frames.
    """
    print(f"[*] Initializing YOLOv10 Vehicle Speed Estimation Engine...")
    print(f"[*] Model: {weights_path} | Video Source: {video_path}")

    # Fallback to local mini sample if highway.mp4 is empty or missing
    if not os.path.exists(video_path) or os.path.getsize(video_path) == 0:
        alt_paths = [
            "vehicle-speed-estimation-main/content/highway_mini.mp4",
            "public/sample_001_morning_crossroad.mp4",
            "public/samples/sample_001.mp4"
        ]
        for alt in alt_paths:
            if os.path.exists(alt) and os.path.getsize(alt) > 0:
                print(f"[!] Using alternate video source: {alt}")
                video_path = alt
                break

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[!] Error: Unable to open video source: {video_path}")
        return

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)

    # Calibrated Bird's-Eye View Ground Plane (30 meters wide x 100 meters long stretch)
    FRAME_WIDTH_METERS = 30.0
    FRAME_HEIGHT_METERS = 100.0

    # Source quad normalized or pixel points
    # Standard Highway Road Quadrilateral from vehicle-speed-estimation-main:
    # Top-Left (534, 343), Top-Right (1335, 370), Bottom-Right (1852, 608), Bottom-Left (18, 550)
    scale_x = frame_width / 1920.0
    scale_y = frame_height / 1080.0

    # Standard Highway Road Quadrilateral (Top-Left, Top-Right, Bottom-Right, Bottom-Left):
    SOURCE_POLYGONE = np.array([
        [int(534 * scale_x), int(343 * scale_y)],   # Top-Left (far horizon)
        [int(1335 * scale_x), int(370 * scale_y)],  # Top-Right (far horizon)
        [int(1852 * scale_x), int(608 * scale_y)],  # Bottom-Right (near camera)
        [int(18 * scale_x), int(550 * scale_y)]     # Bottom-Left (near camera)
    ], dtype=np.float32)

    BIRD_EYE_VIEW = np.array([
        [0, 0],                                    # Top-Left (0m from horizon, left)
        [FRAME_WIDTH_METERS, 0],                   # Top-Right (0m from horizon, right)
        [FRAME_WIDTH_METERS, FRAME_HEIGHT_METERS], # Bottom-Right (100m road stretch, right)
        [0, FRAME_HEIGHT_METERS]                   # Bottom-Left (100m road stretch, left)
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(SOURCE_POLYGONE, BIRD_EYE_VIEW)

    # ROI Polygon Mask for Highway Detection
    pts = SOURCE_POLYGONE.astype(np.int32).reshape((-1, 1, 2))
    polygon_mask = np.zeros((frame_height, frame_width), dtype=np.uint8)
    cv2.fillPoly(polygon_mask, [pts], 255)

    # Video Writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(output_path, fourcc, int(fps), (frame_width, frame_height))

    # Initialize Tracker & YOLOv10 Model
    tracker = DeepSort(max_age=50)
    class_names = load_coco_class_names()

    # Determine model path
    model_file = weights_path
    if not os.path.exists(model_file):
        for candidate in ["yolov10n.pt", "vehicle-speed-estimation-main/yolov10n.pt", "yolov8n.pt"]:
            if os.path.exists(candidate) and os.path.getsize(candidate) > 0:
                model_file = candidate
                break

    print(f"[*] Loading neural weights: {model_file}...")
    model = YOLO(model_file)

    np.random.seed(42)
    colors = np.random.randint(50, 255, size=(len(class_names) + 10, 3))

    prev_positions = {}
    speed_accumulator = {}
    frame_count = 0
    start_time = time.time()

    print(f"[*] Processing frames with YOLOv10 + DeepSORT speed estimation...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1

        # YOLOv10 neural detection
        results = model(frame, conf=conf_thresh, verbose=False)
        detections = []

        for pred in results:
            for box in pred.boxes:
                coords = box.xyxy[0].cpu().numpy()
                x1, y1, x2, y2 = map(int, coords)
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])

                if target_class_id is not None and cls_id != target_class_id:
                    continue

                # Target transport classes: bicycle (1), car (2), motorbike (3), bus (5), truck (7)
                if target_class_id is None and cls_id not in [1, 2, 3, 5, 7]:
                    continue

                w = x2 - x1
                h = y2 - y1

                # Filter out giant false positive boxes (> 45% screen width or height)
                if w > frame_width * 0.45 or h > frame_height * 0.45 or w < 12 or h < 12:
                    continue

                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                # Verify center is inside highway tracking polygon mask
                if 0 <= cy < frame_height and 0 <= cx < frame_width:
                    if polygon_mask[cy, cx] == 255:
                        detections.append([[x1, y1, w, h], conf, cls_id])

        # DeepSORT update
        tracks = tracker.update_tracks(detections, frame=frame)

        for track in tracks:
            if not track.is_confirmed():
                continue

            track_id = track.track_id
            ltrb = track.to_ltrb()
            cls_id = track.get_det_class() or 2
            x1, y1, x2, y2 = map(int, ltrb)

            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            if cy < 0 or cy >= frame_height or cx < 0 or cx >= frame_width:
                continue

            # Check inside polygon mask
            if polygon_mask[cy, cx] == 0:
                continue

            color = colors[cls_id % len(colors)]
            B, G, R = map(int, color)

            # Homography Perspective Transformation of vehicle center to meters
            center_pt = np.array([[[cx, cy]]], dtype=np.float32)
            transformed_pt = cv2.perspectiveTransform(center_pt, M)
            curr_pos_m = transformed_pt[0][0]

            # Calculate speed with Deadzone filter for stopped vehicles (eliminating 35 km/h jitter)
            if track_id in prev_positions:
                prev_pos = prev_positions[track_id]
                dist_m = calculate_distance(prev_pos, curr_pos_m)

                # If distance moved is under threshold (0.35m per frame), vehicle is stationary -> 0 km/h
                if dist_m < 0.35:
                    speed_accumulator[track_id] = [0.0]
                else:
                    inst_speed = calculate_speed(dist_m, fps)
                    if 4.0 <= inst_speed <= 180.0:
                        if track_id not in speed_accumulator:
                            speed_accumulator[track_id] = []
                        speed_accumulator[track_id].append(inst_speed)
                        if len(speed_accumulator[track_id]) > 15:
                            speed_accumulator[track_id].pop(0)

            prev_positions[track_id] = curr_pos_m

            # Draw cybernetic corner brackets
            w = x2 - x1
            h = y2 - y1
            frame = draw_corner_rect(
                frame, (x1, y1, w, h),
                line_length=min(16, max(6, w // 4)),
                line_thickness=2,
                rect_thickness=1,
                rect_color=(B, G, R),
                line_color=(0, 255, 200)
            )

            # Draw vehicle label & ID
            class_name = class_names[cls_id] if cls_id < len(class_names) else f"vehicle_{cls_id}"
            label_text = f"#{track_id} {class_name}"
            (tw, th), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
            cv2.rectangle(frame, (x1 - 1, max(0, y1 - th - 8)), (x1 + tw + 8, y1), (B, G, R), -1)
            cv2.putText(frame, label_text, (x1 + 4, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

            # Draw Speed Badge (0 km/h when stopped)
            if track_id in speed_accumulator and len(speed_accumulator[track_id]) >= 1:
                avg_speed = sum(speed_accumulator[track_id]) / len(speed_accumulator[track_id])
                if avg_speed < 3.0:
                    avg_speed = 0.0
                is_speeding = avg_speed > speed_limit_kmh
                badge_color = (0, 0, 230) if is_speeding else (0, 180, 50)
                speed_str = f"{avg_speed:.0f} km/h" if avg_speed > 0 else "0 km/h (Stopped)"
                if is_speeding:
                    speed_str += " [SPEEDING!]"
                (stw, sth), _ = cv2.getTextSize(speed_str, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                cv2.rectangle(frame, (x1 - 1, max(0, y1 - th - sth - 16)), (x1 + stw + 8, max(0, y1 - th - 8)), badge_color, -1)
                cv2.putText(frame, speed_str, (x1 + 4, max(12, y1 - th - 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)

            # Apply Gaussian Blur if requested for privacy
            if blur_class_id is not None and cls_id == blur_class_id:
                if 0 <= x1 < x2 <= frame_width and 0 <= y1 < y2 <= frame_height:
                    frame[y1:y2, x1:x2] = cv2.GaussianBlur(frame[y1:y2, x1:x2], (51, 51), 3)

        # Draw highway zone outline & telemetry HUD
        cv2.polylines(frame, [pts], isClosed=True, color=(255, 180, 0), thickness=2)
        cv2.putText(frame, "YOLOv10 + DeepSORT Highway Radar Zone", (pts[3][0][0] + 10, pts[3][0][1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 200, 0), 2)

        # Write and log
        writer.write(frame)

        if not headless:
            cv2.imshow("YOLOv10 DeepSORT Speed Estimation", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        if frame_count % 30 == 0:
            elapsed = time.time() - start_time
            print(f"[*] Processed {frame_count} frames — Rate: {frame_count / elapsed:.2f} FPS")

    cap.release()
    writer.release()
    if not headless:
        cv2.destroyAllWindows()

    total_time = time.time() - start_time
    print(f"[+] Speed estimation complete! Total frames: {frame_count} in {total_time:.2f}s ({frame_count / max(0.1, total_time):.1f} FPS)")
    print(f"[+] Output saved to: {output_path}")


if __name__ == "__main__":
    opt = parse_args()
    run_speed_estimation(
        video_path=opt.video,
        output_path=opt.output,
        weights_path=opt.weights,
        conf_thresh=opt.conf,
        target_class_id=opt.class_id,
        blur_class_id=opt.blur_id,
        speed_limit_kmh=opt.speed_limit,
        headless=opt.headless
    )
