# Vehicle Speed Estimation

This project estimates the speed of vehicles in a video using **YOLOv10** for object detection and **DeepSORT** for object tracking. It calculates speed based on pixel distance and perspective transformation, overlaying the results and bounding boxes on the output video.

## Demo 
<p align="center">
  <img src="demo/car1.gif" alt="demo" width="45%">
  <img src="demo/car2.gif" alt="blur" width="45%">
</p>



## Features
- **Object Detection:** Uses `yolov10n.pt` for fast and accurate detection.
- **Object Tracking:** Implements DeepSORT to track vehicles across frames.
- **Speed Estimation:** Calculates speed in km/h using perspective transformation.
- **Blurring:** Option to blur specific objects (e.g., license plates or specific vehicle classes) for privacy.

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/lovnishverma/vehicle-speed-estimation.git
cd vehicle-speed-estimation

```

### 2. Set up the Environment

It is recommended to use a virtual environment to manage dependencies. (conda is optional)

**Windows:**

```bash
python -m venv venv
venv\Scripts\activate

```

**macOS / Linux:**

```bash
python3 -m venv venv
source venv/bin/activate

```

### 3. Install Dependencies

```bash
pip install -r requirements.txt

```

### 4. Prepare Input Files (i have already placed in content folder you can skip this part)

The script requires an input video. You can download the sample videos used in development or place your own video in a `content/` folder.

```bash
mkdir content
# Download sample highway footage
wget -P content https://github.com/AarohiSingla/Speed-detection-of-vehicles/raw/main/highway.mp4

```

> **Note:** The `yolov10n.pt` model weights will be downloaded automatically by the Ultralytics library on the first run.

## Usage

Run the main script `object_tracking.py` with the following arguments:

### Basic Run

Run with default settings (processes `content/highway.mp4`):

```bash
python object_tracking.py

```

### Custom Arguments

You can specify input/output paths, confidence thresholds, and specific classes to track or blur.

| Argument | Description | Default |
| --- | --- | --- |
| `--video` | Path to the input video file. | `content/highway.mp4` |
| `--output` | Path to save the processed video. | `content/output.mp4` |
| `--conf` | Confidence threshold for detection. | `0.5` |
| `--class_id` | Specific class ID to track (e.g., `2` for cars). | `None` (Tracks all) |
| `--blur_id` | Class ID to apply Gaussian blur to. | `None` |

### Examples

**Process a custom video:**

```bash
python object_tracking.py --video data/my_traffic.mp4 --output results/final.mp4

```

**Track only cars (COCO Class ID 2):**

```bash
python object_tracking.py --class_id 2

```

**Blur trucks (COCO Class ID 7) while tracking:**

```bash
python object_tracking.py --blur_id 7

```

## Configuration

### Perspective Transform

To get accurate speed estimations for different camera angles, you must calibrate the perspective transform points in `object_tracking.py`.

Modify the `SOURCE_POLYGONE` array to match the road layout in your specific video:

```python
# object_tracking.py
SOURCE_POLYGONE = np.array([
    [x1, y1], # Top-left
    [x2, y2], # Top-right
    [x3, y3], # Bottom-right
    [x4, y4]  # Bottom-left
], dtype=np.float32)

```

## Acknowledgements

* **YOLOv10:** [Ultralytics](https://github.com/ultralytics/ultralytics)
* **DeepSORT:** [Simple Online and Realtime Tracking](https://github.com/nwojke/deep_sort)
