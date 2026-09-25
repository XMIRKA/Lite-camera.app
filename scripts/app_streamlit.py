#!/usr/bin/env python3
"""
VisionForce AI — Streamlit Interactive Web Application
File: app_streamlit.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Run locally:
    streamlit run app_streamlit.py
"""

import os
import cv2
import time
import math
import tempfile
import numpy as np
import pandas as pd
import streamlit as st
from collections import deque, defaultdict
from ultralytics import YOLO

st.set_page_config(
    page_title="VisionForce AI — Traffic Analytics Hub",
    page_icon="🚦",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
<style>
    .main { background-color: #0b132b; color: #ffffff; }
    .stMetric { background-color: #1c2541; padding: 12px; border-radius: 10px; border: 1px solid #3a506b; }
    .badge-lead { background-color: #00f2fe; color: #000; padding: 4px 8px; border-radius: 6px; font-weight: bold; }
</style>
""", unsafe_allow_html=True)

# Sidebar: Authors & Config
with st.sidebar:
    st.title("🚦 VisionForce AI")
    st.markdown("**Команда разработки:**")
    st.markdown("👑 **(El Capitano)** Alisherov Mirkamol")
    st.markdown("🚀 **Normatov Bekzod** — CV & Calibration")
    st.markdown("⚡ **Muzaffar Solixojaev** — AI & Telemetry")
    
    st.markdown("---")
    st.subheader("⚙️ Параметры пайплайна")
    conf_threshold = st.slider("Порог уверенности YOLOv8 (Confidence)", 0.10, 0.95, 0.35, 0.05)
    iou_threshold = st.slider("Порог IoU NMS", 0.10, 0.90, 0.45, 0.05)
    model_size = st.selectbox("Веса модели YOLOv8", ["yolov8n.pt", "yolov8s.pt", "yolov8m.pt"], index=2)
    enable_trajectories = st.checkbox("Отрисовывать траектории ByteTrack", value=True)
    enable_speed_radar = st.checkbox("Радар физической скорости (км/ч)", value=True)
    enable_collision_alerts = st.checkbox("Прогнозирование ДТП и опасных сближений", value=True)

st.title("🎥 Интеллектуальный видеомониторинг дорожного движения")
st.caption("YOLOv8 + ByteTrack + OpenCV (cv2) + Streamlit Engine")

uploaded_video = st.file_uploader("Загрузите видеозапись дорожного движения (.mp4, .avi, .mov)", type=["mp4", "avi", "mov"])

@st.cache_resource
def load_yolo_model(weights_name):
    return YOLO(weights_name)

if uploaded_video is not None:
    tfile = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
    tfile.write(uploaded_video.read())
    video_path = tfile.name

    cap = cv2.VideoCapture(video_path)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps if fps > 0 else 0

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Разрешение кадра", f"{width} × {height}")
    with col2:
        st.metric("Частота кадров (FPS)", f"{fps:.1f}")
    with col3:
        st.metric("Длительность", f"{duration_sec:.1f} сек")
    with col4:
        st.metric("Всего кадров", f"{total_frames}")

    st.markdown("---")
    
    st_frame = st.empty()
    progress_bar = st.progress(0)

    model = load_yolo_model(model_size)
    history = defaultdict(lambda: deque(maxlen=25))
    speeds = {}

    frame_idx = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        results = model.track(
            source=frame,
            persist=True,
            conf=conf_threshold,
            iou=iou_threshold,
            tracker="bytetrack.yaml",
            verbose=False
        )

        if results and len(results) > 0 and results[0].boxes is not None and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.int().cpu().numpy()
            cls_indices = results[0].boxes.cls.int().cpu().numpy()
            confs = results[0].boxes.conf.cpu().numpy()
            names = model.names

            for box, track_id, cls_idx, conf in zip(boxes, track_ids, cls_indices, confs):
                cls_name = names[cls_idx]
                x1, y1, x2, y2 = map(int, box)
                color = (0, 255, 0) if cls_name == 'person' else (255, 200, 0)

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                label = f"#{track_id} {cls_name} ({conf:.2f})"
                cv2.putText(frame, label, (x1, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

        # Convert to RGB for Streamlit
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        st_frame.image(frame_rgb, channels="RGB", use_column_width=True)
        progress_bar.progress(min(1.0, frame_idx / max(1, total_frames)))

    cap.release()
    st.success("Обработка видеозаписи успешно завершена!")
