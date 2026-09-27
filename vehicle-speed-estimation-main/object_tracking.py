import cv2
import torch
import numpy as np
import argparse, os
from deep_sort_realtime.deepsort_tracker import DeepSort
import time
from ultralytics import YOLO


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--video",
        type=str,
        nargs="?",
        default="content/highway.mp4",
        help="Path to input video"
    )
    parser.add_argument(
        "--output",
        type=str,
        nargs="?",
        help="path to output video",
        default="content/output.mp4"
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.50,
        help="confidence threshold",
    )
    parser.add_argument(
        "--blur_id",
        type=int,
        default=None,
        help="class ID to apply Gaussian Blur",
    )
    parser.add_argument(
        "--class_id",
        type=int,
        default=None,
        help="class ID to track",
    )
    opt = parser.parse_args()
    return opt



def draw_corner_rect(img, bbox, line_length=30, line_thickness=5, rect_thickness=1,
                     rect_color=(255, 0, 255), line_color=(0, 255, 0)):
    x, y, w, h = bbox
    x1, y1 = x + w, y + h

    if rect_thickness != 0:
        cv2.rectangle(img, bbox, rect_color, rect_thickness)

    # Top Left  x, y
    cv2.line(img, (x, y), (x + line_length, y), line_color, line_thickness)
    cv2.line(img, (x, y), (x, y + line_length), line_color, line_thickness)

    # Top Right  x1, y
    cv2.line(img, (x1, y), (x1 - line_length, y), line_color, line_thickness)
    cv2.line(img, (x1, y), (x1, y + line_length), line_color, line_thickness)

    # Bottom Left  x, y1
    cv2.line(img, (x, y1), (x + line_length, y1), line_color, line_thickness)
    cv2.line(img, (x, y1), (x, y1 - line_length), line_color, line_thickness)

    # Bottom Right  x1, y1
    cv2.line(img, (x1, y1), (x1 - line_length, y1), line_color, line_thickness)
    cv2.line(img, (x1, y1), (x1, y1 - line_length), line_color, line_thickness)

    return img  

def calculate_speed(distance, fps):
    return (distance *fps)*3.6


def calculate_distance(p1, p2):
    return np.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)


def read_frames(cap):
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        yield frame 


def main(_argv):
    FRAME_WIDTH=30
    FRAME_HEIGHT=100

    SOURCE_POLYGONE = np.array([[534, 343], [1335, 370], [1852, 608], [18, 550]], dtype=np.float32)
    BIRD_EYE_VIEW = np.array([[0, 0], [FRAME_WIDTH, 0], [FRAME_WIDTH, FRAME_HEIGHT], [0, FRAME_HEIGHT]], dtype=np.float32)

    M = cv2.getPerspectiveTransform(SOURCE_POLYGONE, BIRD_EYE_VIEW)


    # Initialize the video capture
    video_input = opt.video

    cap = cv2.VideoCapture(video_input)
    if not cap.isOpened():
        print('Error: Unable to open video source.')
        return
    
  
    frame_generator = read_frames(cap)
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))

    pts = SOURCE_POLYGONE.astype(np.int32) 
    pts = pts.reshape((-1, 1, 2))

    polygon_mask = np.zeros((frame_height, frame_width), dtype=np.uint8)
    cv2.fillPoly(polygon_mask, [pts], 255)
    # video writer objects
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(opt.output, fourcc, fps, (frame_width, frame_height))

    # Initialize the DeepSort tracker
    tracker = DeepSort(max_age=50)
    # Load YOLO model
    model = YOLO("yolov10n.pt")
    # Load the COCO class labels
    classes_path = "configs/coco.names"
    with open(classes_path, "r") as f:
        class_names = f.read().strip().split("\n")

    np.random.seed(42)
    colors = np.random.randint(0, 255, size=(len(class_names), 3)) 
    # FPS calculation variables
    frame_count = 0
    start_time = time.time()
    prev_positions={}
    speed_accumulator={}
    
    while True:
        try:
            frame = next(frame_generator)
        except StopIteration:
            break
        # Run model on each frame
        with torch.no_grad():
            results = model(frame)
        detect = []
        for pred in results:
            for box in pred.boxes:    
                x1, y1, x2, y2 = map(int, box.xyxy[0] )
                confidence = box.conf[0]     
                label = box.cls[0]  

                # Filter out weak detections, non-vehicles (no pedestrians!), and oversized boxes
                w = x2 - x1
                h = y2 - y1
                if w > frame_width * 0.45 or h > frame_height * 0.45 or w < 12 or h < 12:
                    continue

                if opt.class_id is None:
                    # Transport classes: bicycle (1), car (2), motorbike (3), bus (5), truck (7)
                    if int(label) not in [1, 2, 3, 5, 7] or confidence < opt.conf:
                        continue
                else:
                    if int(label) != opt.class_id or confidence < opt.conf:
                        continue            
                    
                if polygon_mask[(y1 + y2) // 2, (x1 + x2) // 2] == 255:
                    detect.append([[x1, y1, x2 - x1, y2 - y1], confidence, int(label)])            
        tracks = tracker.update_tracks(detect, frame=frame)
        for track in tracks:
            if not track.is_confirmed():
                continue
            track_id = track.track_id    
            ltrb = track.to_ltrb()
            class_id = track.get_det_class() or 2
            x1, y1, x2, y2 = map(int, ltrb)
            if polygon_mask[(y1+y2)//2,(x1+x2)//2] == 0:
                tracks.remove(track)
            color = colors[class_id % len(colors)]
            B, G, R = map(int, color)
            text = f"#{track_id} {class_names[class_id] if class_id < len(class_names) else 'vehicle'}"
            center_pt = np.array([[(x1+x2)//2, (y1+y2)//2]], dtype=np.float32)
            transformed_pt = cv2.perspectiveTransform(center_pt[None, :, :], M)
            
            # Speed estimation with stationary deadzone
            if track_id in prev_positions:
                prev_position = prev_positions[track_id]
                distance = calculate_distance(prev_position, transformed_pt[0][0])
                if distance < 0.35:
                    # Vehicle is stationary -> 0 km/h (eliminating 35 km/h jitter)
                    speed_accumulator[track_id] = [0.0]
                else:
                    speed = calculate_speed(distance, fps)
                    if 4.0 <= speed <= 180.0:
                        if track_id not in speed_accumulator:
                            speed_accumulator[track_id] = []
                        speed_accumulator[track_id].append(speed)
                        if len(speed_accumulator[track_id]) > 15:
                            speed_accumulator[track_id].pop(0)

            prev_positions[track_id] = transformed_pt[0][0]
            
            # Draw compact cybernetic bounding box and text
            w = x2 - x1
            h = y2 - y1
            frame = draw_corner_rect(frame, (x1, y1, w, h), line_length=min(16, max(6, w // 4)), line_thickness=2, rect_thickness=1, rect_color=(B, G, R), line_color=(R, G, B))
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
            cv2.rectangle(frame, (x1 - 1, max(0, y1 - th - 8)), (x1 + tw + 8, y1), (B, G, R), -1)
            cv2.putText(frame, text, (x1 + 4, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)
            
            if track_id in speed_accumulator and len(speed_accumulator[track_id]) >= 1:
                avg_speed = sum(speed_accumulator[track_id]) / len(speed_accumulator[track_id])
                if avg_speed < 3.0:
                    avg_speed = 0.0
                speed_str = f"Speed: {avg_speed:.0f} km/h" if avg_speed > 0 else "0 km/h (Stopped)"
                (stw, sth), _ = cv2.getTextSize(speed_str, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
                cv2.rectangle(frame, (x1 - 1, max(0, y1 - th - sth - 16)), (x1 + stw + 8, max(0, y1 - th - 8)), (0, 0, 255) if avg_speed > 80 else (0, 180, 50), -1)
                cv2.putText(frame, speed_str, (x1 + 4, max(12, y1 - th - 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1)
            # Apply Gaussian Blur
            if opt.blur_id is not None and class_id == opt.blur_id:
                print("true")
                if 0 <= x1 < x2 <= frame.shape[1] and 0 <= y1 < y2 <= frame.shape[0]:
                    frame[y1:y2, x1:x2] = cv2.GaussianBlur(frame[y1:y2, x1:x2], (99, 99), 3)

        cv2.polylines(frame, [pts], isClosed=True, color=(255, 0, 0), thickness=2)
        cv2.putText(frame, f"Height: {FRAME_HEIGHT}", (1500, 900), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        cv2.putText(frame, f"Width: {FRAME_WIDTH}", (1530, 930), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        cv2.imshow('speed_estimation', frame)
        writer.write(frame)
        frame_count += 1
        if frame_count % 10 == 0:
            elapsed_time = time.time() - start_time
            fps_calc = frame_count / elapsed_time
            print(f"FPS: {fps_calc:.2f}")
    
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    writer.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    opt = parse_args()
    main(opt)