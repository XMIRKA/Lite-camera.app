=============================================================================
WIUT Hackathon 2026 — Computer Vision Track
VisionForce-WIUT Submission Scripts Documentation
Team: Alisherov Mirkamol (Lead), Normatov Bekzod, Muzaffar Solixojaev
=============================================================================

Files in this archive:
1. solution.py.txt
   - Part A: detect_events(video_path: str, meta: dict = None) -> list[list]
   - Part B: RiskEstimator (predict_frame causal accident anticipation)
   - 14 Official Competition Event Classes
   - HomographySpeedEstimator (IPM Perspective transformation to road coordinates in meters)
   - OpenCV Canny + HoughLinesP Dynamic Road Lane and Solid Line Crossing Detector

2. Traffic Light Interlocking Phase Logic:
   - Evaluates multi-directional traffic light pairs on intersections.
   - If Phase A (Main Road) is RED, Phase B (Cross/Perpendicular Road) is GREEN.
   - If one traffic light is occluded or unlit, infers state strictly according to traffic laws (ПДД).

=============================================================================
