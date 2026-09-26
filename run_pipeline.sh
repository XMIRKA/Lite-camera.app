#!/bin/bash
echo "=== VisionForce AI: Autonomous Traffic Surveillance Pipeline ==="
echo "[1/3] Installing Python Computer Vision Requirements..."
pip install -r requirements.txt

echo "[2/3] Launching YOLOv10 + DeepSORT Speed Estimation Pipeline..."
python speed_estimation.py --weights yolov10n.pt --video vehicle-speed-estimation-main/content/highway.mp4 --output output_speed_estimated.mp4

echo "[3/3] Launching Interactive Web Streamlit Dashboard..."
streamlit run app_streamlit.py
