#!/usr/bin/env bash
# VisionForce AI — Automated Pipeline Runner
# Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

set -e

echo "========================================================="
echo "🚦 VisionForce AI — Intelligent Traffic Vision Pipeline"
echo "========================================================="

# 1. Install dependencies
echo "[1/4] Checking and installing Python dependencies..."
pip install -r scripts/requirements.txt -q

# 2. Run Verification Benchmarks
echo "[2/4] Validating kinematic and density analyzers..."
python3 scripts/traffic_density_analyzer.py
python3 scripts/collision_vector_forecast.py
python3 scripts/speed_estimation_radar.py

# 3. Process Sample Video
INPUT_VIDEO=${1:-"sample_traffic.mp4"}
if [ -f "$INPUT_VIDEO" ]; then
    echo "[3/4] Processing input video: $INPUT_VIDEO..."
    python3 scripts/pipeline_yolov8_bytetrack.py --input "$INPUT_VIDEO" --output "output_processed.mp4" --weights yolov8m.pt
else
    echo "[3/4] Notice: No local input video '$INPUT_VIDEO' provided. Skipping video inference."
fi

# 4. Launch Streamlit Web App
echo "[4/4] Starting Streamlit Interactive Analytics Dashboard..."
echo "Run: streamlit run scripts/app_streamlit.py"
