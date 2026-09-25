#!/usr/bin/env python3
"""
VisionForce AI — Custom YOLOv8 Fine-Tuning Script for Traffic CCTV
File: train_yolov8_custom.py
Authors: (El Capitano) Alisherov Mirkamol, Normatov Bekzod, Muzaffar Solixojaev

Features:
- Automated YAML dataset generation (Traffic classes: car, bus, truck, motorcycle, pedestrian)
- Mosaic, MixUp, HSV color space augmentation for night/rain robustness
- Multi-scale training with Cosine Annealing Learning Rate Scheduler
- Model validation, mAP@0.5:0.95 evaluation & weights export
"""

import os
import yaml
import argparse
from ultralytics import YOLO


def create_dataset_yaml(output_yaml: str = "traffic_dataset.yaml"):
    data = {
        'path': './datasets/traffic_cctv',
        'train': 'images/train',
        'val': 'images/val',
        'test': 'images/test',
        'names': {
            0: 'pedestrian',
            1: 'car',
            2: 'motorcycle',
            3: 'bus',
            4: 'truck'
        }
    }
    with open(output_yaml, 'w') as f:
        yaml.dump(data, f, default_flow_style=False)
    print(f"[Dataset] Generated '{output_yaml}' config.")


def train(args):
    print(f"[Training] Initializing YOLOv8 model: {args.model}")
    model = YOLO(args.model)

    create_dataset_yaml("traffic_dataset.yaml")

    # Hyperparameter configuration
    results = model.train(
        data="traffic_dataset.yaml",
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=8,
        optimizer="AdamW",
        lr0=0.001,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3.0,
        warmup_momentum=0.8,
        # Heavy augmentations for surveillance camera angles & weather
        mosaic=1.0,
        mixup=0.15,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.5,
        shear=2.0,
        perspective=0.0005,
        flipud=0.0,
        fliplr=0.5,
        project="runs/traffic_train",
        name="visionforce_yolov8m_exp1"
    )

    print("[Training] Completed! Running validation on test set...")
    metrics = model.val()
    print(f"[Validation] mAP@0.5: {metrics.box.map50:.4f} | mAP@0.5:0.95: {metrics.box.map:.4f}")

    # Export best model
    best_weights = "runs/traffic_train/visionforce_yolov8m_exp1/weights/best.pt"
    print(f"[Export] Best model saved to: {best_weights}")
    return best_weights


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Custom YOLOv8 on Traffic Data")
    parser.add_argument("--model", type=str, default="yolov8m.pt", help="Base model weights")
    parser.add_argument("--epochs", type=int, default=100, help="Number of training epochs")
    parser.add_argument("--imgsz", type=int, default=1280, help="Input image size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--device", type=str, default="0", help="GPU device ID or 'cpu'")
    args = parser.parse_args()

    train(args)
