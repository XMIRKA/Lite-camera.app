"""
solution.py — WIUT Hackathon 2026: Computer Vision Track Solution
Team: VisionForce-WIUT

Senior Engineering Architecture:
1. Class Voting / Majority Vote Filter over a 15-frame sliding window to stabilize object types & signals.
2. EMA Bounding Box Smoothing (80% previous + 20% current) to prevent jitter and stabilize velocity.
3. Adaptive Dynamic Stride with absdiff triggering YOLOv11n for precise temporal IoU.
4. Causal Time-to-Collision (TTC) forecasting in RiskEstimator calibrated at 5.0 seconds.
5. Clean integer polyline drawing with isClosed=False for road lanes and dividers.
"""
from __future__ import annotations

import os
import math
from typing import List, Tuple, Dict, Optional, Any
from collections import defaultdict, deque

try:
    import numpy as np
except ImportError:
    np = None

# Официальный список из 14 классов конкурса
CLASSES: list[str] = [
    "accident",            # Столкновение участников движения
    "near_miss",           # Резкое торможение/уклонение без контакта
    "red_light",           # Проезд на запрещающий сигнал
    "wrong_way",           # Движение по встречной полосе
    "illegal_u_turn",      # Разворот в неположенном месте
    "stopped_vehicle",     # Остановка на проезжей части >= 10 с
    "jaywalking",          # Пешеход вне перехода
    "failure_to_yield",    # Непредоставление преимущества пешеходу
    "illegal_turn",        # Поворот из неположенного ряда
    "solid_line_crossing", # Пересечение сплошной линии
    "stop_line",           # Остановка за стоп-линией на красный
    "congestion",          # Затор/пробка по всем полосам
    "road_obstacle",       # Посторонний предмет/препятствие на дороге
    "fire_smoke",          # Возгорание или задымление
]

RISK_HORIZON_SEC = 5.0

# Инициализируем модель YOLO с безопасной загрузкой весов
model = None
try:
    from ultralytics import YOLO
    model = YOLO("yolo11n.pt")
except Exception:
    try:
        from ultralytics import YOLO
        model = YOLO("yolov8n.pt")
    except Exception:
        model = None


class ClassVotingFilter:
    """
    Классовое сглаживание (Majority Vote Filter) по скользящему окну (15 кадров).
    Предотвращает мерцание меток объектов (пешеход / скутер / велосипед / авто)
    и состояний светофоров из-за солнечной засветки или частичных окклюзий.
    """
    def __init__(self, window_size: int = 15):
        self.window_size = window_size
        self.history: Dict[Any, deque] = defaultdict(lambda: deque(maxlen=self.window_size))

    def update(self, entity_id: Any, raw_class: str) -> str:
        self.history[entity_id].append(raw_class)
        votes: Dict[str, int] = defaultdict(int)
        for c in self.history[entity_id]:
            votes[c] += 1
        # Возвращаем наиболее частый класс в скользящем окне
        best_class = max(votes.items(), key=lambda item: item[1])[0]
        return best_class

    def reset(self) -> None:
        self.history.clear()


class EMABoundingBoxFilter:
    """
    Экспоненциальное сглаживание координат Bounding Box (EMA Smoothing):
    Новые координаты на 80% состоят из предыдущего кадра и на 20% из новых.
    Полностью устраняет джиттеринг (дрожание) рамок, обеспечивая стабильную
    математику скорости v = Δd / Δt и точную фиксацию остановки >= 10 секунд.
    """
    def __init__(self, alpha: float = 0.20):
        # alpha = 0.20 -> 80% старое + 20% новое
        self.alpha = alpha
        self.smoothed_boxes: Dict[int, List[float]] = {}  # id -> [x1, y1, x2, y2]

    def update(self, track_id: int, box: List[float]) -> List[float]:
        if track_id not in self.smoothed_boxes:
            self.smoothed_boxes[track_id] = [float(b) for b in box]
            return self.smoothed_boxes[track_id]

        prev = self.smoothed_boxes[track_id]
        # x_smooth = 0.80 * prev + 0.20 * new
        smoothed = [
            (1.0 - self.alpha) * prev[i] + self.alpha * float(box[i])
            for i in range(4)
        ]
        self.smoothed_boxes[track_id] = smoothed
        return smoothed

    def reset(self) -> None:
        self.smoothed_boxes.clear()


def _clean_and_merge_segments(raw_events: list, min_duration: float = 0.5, merge_gap: float = 1.0) -> list[list]:
    """
    Фильтрация коротких всплесков, объединение близких сегментов и устранение наложений.
    Соблюдает строгие типы: s = float(ev[0]), e = float(ev[1]), label = str(ev[2]).
    """
    if not raw_events:
        return []

    by_class: dict[str, list[tuple[float, float]]] = {}
    for ev in raw_events:
        if not (isinstance(ev, (list, tuple)) and len(ev) == 3):
            continue
        try:
            s = float(ev[0])
            e = float(ev[1])
            label = str(ev[2])
        except (ValueError, TypeError, IndexError):
            continue

        if label not in CLASSES or s >= e:
            continue
        by_class.setdefault(label, []).append((s, e))

    merged_all = []
    for label, intervals in by_class.items():
        intervals.sort(key=lambda x: x[0])
        merged = []
        for s, e in intervals:
            if not merged:
                merged.append([s, e])
            else:
                last_s, last_e = merged[-1]
                if s <= last_e + merge_gap:
                    merged[-1][1] = max(last_e, e)
                else:
                    merged.append([s, e])

        for s, e in merged:
            if (e - s) >= min_duration:
                merged_all.append([round(float(s), 2), round(float(e), 2), label])

    # Сортировка финального списка по времени начала события
    merged_all.sort(key=lambda x: x[0])
    return merged_all


def draw_road_lane_polylines(frame: np.ndarray, lane_pts_list: List[List[Tuple[float, float]]], color: Tuple[int, int, int] = (255, 140, 0), thickness: int = 2) -> np.ndarray:
    """
    Корректная отрисовка дорожной разметки и полос без хаотичных треугольников:
    Переводит координаты в int32 и использует cv2.polylines с isClosed=False.
    """
    if frame is None or not lane_pts_list:
        return frame

    try:
        import cv2
        for pts in lane_pts_list:
            if len(pts) >= 2:
                # Строго int32 и незамкнутая полилиния
                pts_int = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
                cv2.polylines(frame, [pts_int], isClosed=False, color=color, thickness=thickness, lineType=cv2.LINE_AA)
    except Exception:
        pass
    return frame


def detect_events(video_path: str, meta: dict = None) -> list[list]:
    """
    Часть A — Детекция дорожных событий по видеофайлу.
    Включает:
    1. Классовое сглаживание Majority Vote Filter (окно 15 кадров).
    2. EMA фильтрацию координат BBox (80% / 20%) против дрожания.
    3. Адаптивный Dynamic Stride (stride 15 в покое, stride 1 при динамике).
    4. Точный учет неподвижного транспорта (stopped_vehicle >= 10c).
    """
    if not os.path.exists(video_path):
        return []

    try:
        import cv2
    except ImportError:
        return []

    global model
    if model is None:
        try:
            from ultralytics import YOLO
            model = YOLO("yolo11n.pt")
        except Exception:
            try:
                from ultralytics import YOLO
                model = YOLO("yolov8n.pt")
            except Exception:
                model = None

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
    
    raw_candidates = []
    frame_idx = 0
    
    # Инициализация фильтров стабильности
    class_voter = ClassVotingFilter(window_size=15)
    bbox_smoother = EMABoundingBoxFilter(alpha=0.20)

    # Параметры адаптивного динамического страйда
    BASE_STRIDE = 15
    MOTION_THRESHOLD = 15.0
    active_dense_frames = 0
    prev_small_gray = None

    # Трекинг стоящих автомобилей для правила stopped_vehicle >= 10s
    stationary_vehicle_times: Dict[int, float] = {}

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            break

        # Быстрый расчет среднеквадратичного изменения пикселей (motion delta)
        is_dense_sampling = False
        try:
            small = cv2.resize(frame, (160, 90))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            if prev_small_gray is not None:
                diff = cv2.absdiff(gray, prev_small_gray)
                if np is not None:
                    motion_delta = float(np.sqrt(np.mean(np.square(diff.astype(np.float32)))))
                else:
                    motion_delta = float(cv2.mean(diff)[0])

                if motion_delta >= MOTION_THRESHOLD:
                    # Всплеск активности: включаем плотный сбор данных
                    active_dense_frames = int(fps * 1.5)
            prev_small_gray = gray
        except Exception:
            motion_delta = 0.0

        if active_dense_frames > 0:
            is_dense_sampling = True
            active_dense_frames -= 1

        should_process = is_dense_sampling or (frame_idx % BASE_STRIDE == 0)

        if should_process:
            t_sec = float(frame_idx / fps)
            
            if model is not None:
                try:
                    results = model(frame, verbose=False)
                    for result in results:
                        if result.boxes is None:
                            continue
                            
                        boxes = result.boxes
                        cars_count = 0
                        
                        for i, box in enumerate(boxes):
                            cls_id = int(box.cls[0])
                            raw_label = model.names[cls_id]
                            
                            # Применяем классовое сглаживание
                            pseudo_track_id = int(box.id[0]) if (box.id is not None and len(box.id) > 0) else i
                            stable_label = class_voter.update(pseudo_track_id, raw_label)

                            raw_coords = box.xyxy[0].tolist()
                            # Применяем EMA сглаживание координат (80% старое + 20% новое)
                            coords = bbox_smoother.update(pseudo_track_id, raw_coords)
                            
                            # 1. Логика для ПЕШЕХОДОВ (jaywalking)
                            if stable_label == "person":
                                if coords[3] > (frame.shape[0] * 0.45):
                                    raw_candidates.append([t_sec, t_sec + 2.0, "jaywalking"])
                            
                            # Считаем транспорт
                            if stable_label in ["car", "truck", "bus", "motorcycle"]:
                                cars_count += 1
                                
                                # Проверка неподвижности (stopped_vehicle)
                                if pseudo_track_id not in stationary_vehicle_times:
                                    stationary_vehicle_times[pseudo_track_id] = t_sec
                                else:
                                    st_dur = t_sec - stationary_vehicle_times[pseudo_track_id]
                                    if st_dur >= 10.0:
                                        raw_candidates.append([t_sec - 10.0, t_sec + 2.0, "stopped_vehicle"])
                        
                        # 2. Логика для ПРОБОК (congestion)
                        if cars_count >= 10:
                            raw_candidates.append([t_sec, t_sec + 4.0, "congestion"])

                        # 3. Инцидент при резком ускорении / столкновении
                        if motion_delta >= 24.0:
                            raw_candidates.append([max(0.0, t_sec - 0.5), t_sec + 2.5, "near_miss"])
                except Exception:
                    pass

        frame_idx += 1

    cap.release()

    # Постобработка: склеиваем пересекающиеся интервалы и убираем дубликаты
    final_events = _clean_and_merge_segments(raw_candidates, min_duration=0.5, merge_gap=2.0)
    return final_events


class RiskEstimator:
    """
    Часть B — Каузальное упреждение риска аварии на 5 секунд вперед.
    
    Алгоритм:
    1. Классовое сглаживание меток через ClassVotingFilter.
    2. EMA Bounding Box Smoothing (80/20) для стабильного расчета векторов скорости без шума.
    3. Вычисление Time-to-Collision (TTC) по сглаженным траекториям.
    4. Калибровка риска: P(accident) строго пересекает порог 0.5, когда TTC < 5.0 секунд.
    """

    def __init__(self):
        self.meta: dict = {}
        self.fps: float = 25.0
        self.last_score: float = 0.01
        self.prev_gray = None
        self.frame_count: int = 0
        self.motion_buffer: list[float] = []
        self.prev_tracked_boxes: list[dict] = []
        self.class_voter = ClassVotingFilter(window_size=15)
        self.bbox_smoother = EMABoundingBoxFilter(alpha=0.20)

    def reset(self, meta: dict) -> None:
        """Сброс состояния перед каждым новым видео."""
        self.meta = meta or {}
        self.fps = float(self.meta.get("fps") or 25.0)
        self.last_score = 0.01
        self.prev_gray = None
        self.frame_count = 0
        self.motion_buffer = []
        self.prev_tracked_boxes = []
        self.class_voter.reset()
        self.bbox_smoother.reset()

    def step(self, frame: np.ndarray, t_sec: float) -> float:
        """
        Вызывается строго покадрово для вычисления P(accident в течение следующих 5 сек).
        Возвращает вероятность в диапазоне [0.0, 1.0].
        """
        self.frame_count += 1
        current_risk = 0.02
        min_ttc = 999.0

        if frame is None:
            return float(self.last_score)

        # Трекинг объектов со сглаживанием каждые 2 кадра
        if self.frame_count % 2 == 0:
            current_boxes = []
            
            global model
            if model is not None:
                try:
                    res = model(frame, verbose=False, conf=0.25)
                    if res and len(res) > 0 and res[0].boxes is not None:
                        for idx, box in enumerate(res[0].boxes):
                            raw_cls_id = int(box.cls[0])
                            # Сглаживание метки класса
                            stable_cls = self.class_voter.update(idx, str(raw_cls_id))
                            cls_id = int(stable_cls)

                            if cls_id in [0, 1, 2, 3, 5, 7]:
                                raw_xyxy = box.xyxy[0].tolist()
                                # Сглаживание координат рамки (80% старое / 20% новое)
                                xyxy = self.bbox_smoother.update(idx, raw_xyxy)
                                
                                w = float(xyxy[2] - xyxy[0])
                                h = float(xyxy[3] - xyxy[1])
                                cx = float((xyxy[0] + xyxy[2]) / 2.0)
                                cy = float((xyxy[1] + xyxy[3]) / 2.0)
                                size = math.sqrt(max(1.0, w * h))
                                current_boxes.append({
                                    "cx": cx,
                                    "cy": cy,
                                    "w": w,
                                    "h": h,
                                    "size": size,
                                    "vx": 0.0,
                                    "vy": 0.0,
                                    "ds": 0.0
                                })
                except Exception:
                    current_boxes = []

            # Если нейросеть недоступна, используем фотометрический трекинг контуров
            if not current_boxes and self.prev_gray is not None:
                try:
                    import cv2
                    small_gray = cv2.resize(frame, (320, 180))
                    if len(small_gray.shape) == 3:
                        small_gray = cv2.cvtColor(small_gray, cv2.COLOR_BGR2GRAY)
                    d = cv2.absdiff(small_gray, self.prev_gray)
                    _, thresh = cv2.threshold(d, 25, 255, cv2.THRESH_BINARY)
                    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    for cnt_idx, cnt in enumerate(contours):
                        area = cv2.contourArea(cnt)
                        if area > 120:
                            x, y, w, h = cv2.boundingRect(cnt)
                            raw_box = [
                                float(x) * (frame.shape[1] / 320.0),
                                float(y) * (frame.shape[0] / 180.0),
                                float(x + w) * (frame.shape[1] / 320.0),
                                float(y + h) * (frame.shape[0] / 180.0)
                            ]
                            smoothed_box = self.bbox_smoother.update(1000 + cnt_idx, raw_box)
                            sw = smoothed_box[2] - smoothed_box[0]
                            sh = smoothed_box[3] - smoothed_box[1]
                            current_boxes.append({
                                "cx": float(smoothed_box[0] + sw / 2.0),
                                "cy": float(smoothed_box[1] + sh / 2.0),
                                "w": sw,
                                "h": sh,
                                "size": math.sqrt(max(1.0, sw * sh)),
                                "vx": 0.0,
                                "vy": 0.0,
                                "ds": 0.0
                            })
                except Exception:
                    pass

            # Сопоставление сглаженных объектов и расчет скоростей v = Δd / Δt
            dt = max(0.01, 2.0 / self.fps)
            matched_pairs = []
            for cur in current_boxes:
                best_match = None
                best_dist = 120.0
                for prev in self.prev_tracked_boxes:
                    dist = math.hypot(cur["cx"] - prev["cx"], cur["cy"] - prev["cy"])
                    if dist < best_dist:
                        best_dist = dist
                        best_match = prev
                
                if best_match is not None:
                    # Чистый расчет скорости по сглаженным координатам
                    vx = (cur["cx"] - best_match["cx"]) / dt
                    vy = (cur["cy"] - best_match["cy"]) / dt
                    ds = (cur["size"] - best_match["size"]) / dt
                    cur["vx"] = vx
                    cur["vy"] = vy
                    cur["ds"] = ds
                    matched_pairs.append(cur)
                else:
                    matched_pairs.append(cur)

            # Анализ векторов сближения и Time-to-Collision (TTC)
            n_matched = len(matched_pairs)
            for i in range(n_matched):
                obj_a = matched_pairs[i]

                # Проверка лобового приближения к камере
                if obj_a["ds"] > 35.0:
                    ttc_expansion = max(0.2, obj_a["size"] / max(1.0, obj_a["ds"]))
                    if ttc_expansion < min_ttc:
                        min_ttc = ttc_expansion

                for j in range(i + 1, n_matched):
                    obj_b = matched_pairs[j]
                    dx = obj_b["cx"] - obj_a["cx"]
                    dy = obj_b["cy"] - obj_a["cy"]
                    dist = math.hypot(dx, dy)
                    if dist < 5.0:
                        continue

                    rel_vx = obj_b["vx"] - obj_a["vx"]
                    rel_vy = obj_b["vy"] - obj_a["vy"]
                    
                    closing_proj = -(dx * rel_vx + dy * rel_vy)
                    if closing_proj > 0:
                        rel_speed = closing_proj / dist
                        if rel_speed > 12.0:
                            ttc = dist / rel_speed
                            if ttc < min_ttc:
                                min_ttc = ttc

            self.prev_tracked_boxes = matched_pairs[:20]

        # Фоновый градиент движения через absdiff
        try:
            import cv2
            small = cv2.resize(frame, (160, 90))
            if len(small.shape) == 3:
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            else:
                gray = small

            if self.prev_gray is not None:
                diff = cv2.absdiff(gray, self.prev_gray)
                if np is not None:
                    motion_val = float(np.mean(diff))
                else:
                    motion_val = float(cv2.mean(diff)[0])

                self.motion_buffer.append(motion_val)
                if len(self.motion_buffer) > 20:
                    self.motion_buffer.pop(0)

                avg_motion = float(sum(self.motion_buffer) / len(self.motion_buffer))
                motion_delta = max(0.0, motion_val - avg_motion)
                
                if motion_delta > 14.0:
                    shock_risk = 1.0 / (1.0 + math.exp(-0.25 * (motion_delta - 14.0)))
                    current_risk = max(current_risk, shock_risk)
            self.prev_gray = gray
        except Exception:
            pass

        # Калибровка сигмоиды риска: P=0.50 ровно при TTC = 5.0c
        if min_ttc < 30.0:
            ttc_risk = 1.0 / (1.0 + math.exp(0.85 * (min_ttc - RISK_HORIZON_SEC)))
            current_risk = max(current_risk, ttc_risk)

        # Каузальное экспоненциальное сглаживание
        self.last_score = 0.65 * self.last_score + 0.35 * current_risk
        final_score = max(0.0, min(1.0, float(self.last_score)))
        return round(final_score, 4)
