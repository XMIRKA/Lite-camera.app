#!/bin/bash
echo "=== VisionForce AI: Autonomous Traffic Surveillance Pipeline ==="
echo "[1/3] Installing Python Computer Vision Requirements..."
pip install -r requirements.txt

echo "[2/3] Launching YOLOv8 + ByteTrack Speed Estimation Pipeline..."
python speed_estimation.py --weights yolov8n.pt --source public/sample_001_morning_crossroad.mp4

echo "[3/3] Launching Interactive Web Streamlit Dashboard..."
streamlit run app_streamlit.py
