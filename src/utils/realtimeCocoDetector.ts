import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import {
  calculateTrafficDensityAndLOS,
  evaluatePairwiseCollisionRisks,
  TrafficDensityMetrics,
  TrackedTrafficEntity
} from './trafficAnalyticsEngine';
import {
  IndividualTrafficLight,
  IntersectionPhaseState,
  analyzeSingleTrafficLight,
  autoLocateTrafficLightSpots,
  evaluateIntersectionInterlocking,
  getStableSignalState
} from './trafficLightOpticalDetector';
export type { IndividualTrafficLight, IntersectionPhaseState };
import {
  analyzeOpticalSmokeFire,
  DEFAULT_SOLID_DIVIDERS,
  doSegmentsIntersect,
  smoothAndDebounceEvents,
  OpticalSmokeFireResult,
  SolidLaneDivider
} from './eventRuleEngine';
export type { SolidLaneDivider };
import { OfficialClass, TrafficEvent } from '../types/hackathon';

export interface CameraCalibrationParams {
  roadLengthMeters: number;
  laneWidthMeters: number;
  cameraHeightMeters: number;
  cameraPitchDeg: number;
  vanishingPointY: number;
}

export function projectImageToGround(
  u: number,
  v: number,
  calib: CameraCalibrationParams
): { gx: number; gy: number } {
  const v_eff = Math.max(calib.vanishingPointY + 0.02, Math.min(0.99, v));
  const normDepth = (v_eff - calib.vanishingPointY) / (1.0 - calib.vanishingPointY);
  
  // Non-linear Inverse Perspective Mapping (IPM) to real road ground plane (meters)
  // Longitudinal ground distance along the road
  const gy = (calib.cameraHeightMeters / Math.tan(((calib.cameraPitchDeg + 2.0) * Math.PI) / 180 + normDepth * 0.40)) + (1.0 - normDepth) * (calib.roadLengthMeters * 0.75);
  
  // Lateral road coordinate X in meters
  const roadSpread = calib.laneWidthMeters * (gy / 12.0 + 0.8);
  const gx = (u - 0.5) * roadSpread;
  
  return { gx, gy };
}

export interface LiveDetectedObject {
  id: number;
  class: 'person' | 'car' | 'truck' | 'bus' | 'motorcycle' | 'bicycle' | string;
  labelRu: string;
  classHistory?: string[];
  score: number;
  // Normalized 0..1 bounding box (ground truth from detector)
  x: number;
  y: number;
  w: number;
  h: number;
  // Target coordinates for smooth easing
  targetX: number;
  targetY: number;
  targetW: number;
  targetH: number;
  // Velocity vectors for forward projection
  vx: number;
  vy: number;
  // Butter-smooth 60 FPS Render coordinates (interpolated)
  renderX: number;
  renderY: number;
  renderW: number;
  renderH: number;
  // Physical Homography Ground Coordinates (meters) & Kinematics History
  groundX: number;
  groundY: number;
  deltaDistanceM: number;
  history: { gx: number; gy: number; t: number }[];
  // Pure Mathematical Speed (km/h) calculated via CV Trajectory Kinematics (v = d/dt * 3.6)
  speedKmh: number;
  speedHistory: number[];
  isMoving: boolean;
  stillFrameCount: number;
  status: 'ДВИЖЕНИЕ' | 'ОСТАНОВКА' | 'ПЕРЕХОД' | 'СТОИТ' | 'ПРЕВЫШЕНИЕ' | 'ОПАСНОСТЬ' | 'СПЛОШНАЯ' | 'СТОИТ >10с';
  color: string;
  trail: { x: number; y: number }[];
  lastSeen: number;
  lastVideoTime: number;
  missedFrames: number;
  // Rules & Timers
  stoppedDurationSec: number;
  hasTriggeredStoppedVehicle?: boolean;
  hasCrossedSolidLine?: boolean;
  // Collision & Proximity Alerts
  collisionRisk?: boolean;
  conflictWithId?: number;
  distanceMeters?: number;
  ttcSeconds?: number;
}

export interface CollisionAlertEvent {
  id: string;
  timestamp: number;
  timeFormatted: string;
  sourceId: number;
  sourceLabel: string;
  targetId: number;
  targetLabel: string;
  distanceMeters: number;
  ttcSeconds: number;
  severity: 'CRITICAL' | 'WARNING';
}

export interface TrafficSceneAnalysis {
  trafficLightState: 'RED' | 'YELLOW' | 'GREEN';
  trafficLightLabel: string;
  trafficLights: IndividualTrafficLight[];
  intersectionPhase: IntersectionPhaseState;
  congestionScore: number; // 1 - 10
  congestionLevel: 'СВОБОДНО' | 'УМЕРЕННЫЙ' | 'ПЛОТНЫЙ' | 'ПРОБКА';
  levelOfService: 'LOS A' | 'LOS B' | 'LOS C' | 'LOS D' | 'LOS E' | 'LOS F';
  roadOccupancyPct: number;
  vehicleDensityPerKm: number;
  vehicleCount: number;
  pedestrianCount: number;
  averageSpeedKmh: number;
  activeCollisions: CollisionAlertEvent[];
  densityDescriptionRu: string;
}

interface RawFusedDetection {
  bbox: [number, number, number, number]; // x, y, w, h in 0..1
  class: string;
  labelRu: string;
  color: string;
  score: number;
}

export interface CustomSignalConfig {
  id: number;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  direction: 'MAIN_DIRECTION' | 'CROSS_DIRECTION';
  manualOverride: 'AUTO' | 'RED' | 'YELLOW' | 'GREEN';
}

class RealtimeNeuralVisionEngine {
  private model: cocoSsd.ObjectDetection | null = null;
  private isModelLoading: boolean = false;
  private isProcessing: boolean = false;
  private activeTracks: Map<number, LiveDetectedObject> = new Map();
  private nextTrackId: number = 1;
  private trafficLightState: 'RED' | 'YELLOW' | 'GREEN' = 'GREEN';
  private detectedTrafficLights: IndividualTrafficLight[] = [];
  private intersectionPhase: IntersectionPhaseState = {
    mainPhase: 'GREEN',
    crossPhase: 'RED',
    activePhaseDescriptionRu: 'Фаза 1: Главное направление свободно (ЗЕЛЕНЫЙ), Второстепенное закрыто (КРАСНЫЙ).',
    interlockCompliant: true,
    signals: []
  };
  private collisionLog: CollisionAlertEvent[] = [];
  private lastAlertTime: number = 0;
  private isPaused: boolean = false;
  private pairConflictFrames: Map<string, number> = new Map();
  private rawEvents: TrafficEvent[] = [];
  private opticalSmokeResult: OpticalSmokeFireResult = { detected: false, type: null, confidence: 0 };
  private customDividers: SolidLaneDivider[] = [];

  // Configured Traffic Light ROIs
  private customSignals: CustomSignalConfig[] = [
    {
      id: 1,
      label: 'Светофор #1 (Главное напр.)',
      x: 0.70,
      y: 0.10,
      w: 0.045,
      h: 0.12,
      direction: 'MAIN_DIRECTION',
      manualOverride: 'AUTO'
    },
    {
      id: 2,
      label: 'Светофор #2 (Поперечное напр.)',
      x: 0.20,
      y: 0.12,
      w: 0.045,
      h: 0.12,
      direction: 'CROSS_DIRECTION',
      manualOverride: 'AUTO'
    }
  ];

  // Offscreen inference canvas for hardware acceleration
  private inferCanvas: HTMLCanvasElement;
  private inferCtx: CanvasRenderingContext2D | null;

  private calibration: CameraCalibrationParams = {
    roadLengthMeters: 45.0,
    laneWidthMeters: 3.75,
    cameraHeightMeters: 6.5,
    cameraPitchDeg: 22.0,
    vanishingPointY: 0.22,
  };

  constructor() {
    this.inferCanvas = document.createElement('canvas');
    this.inferCanvas.width = 640;
    this.inferCanvas.height = 360;
    this.inferCtx = this.inferCanvas.getContext('2d', { willReadFrequently: true });
  }

  public getCalibration(): CameraCalibrationParams {
    return { ...this.calibration };
  }

  public setCalibration(params: Partial<CameraCalibrationParams>): void {
    this.calibration = { ...this.calibration, ...params };
  }

  public getCustomSignals(): CustomSignalConfig[] {
    return [...this.customSignals];
  }

  public setCustomSignals(signals: CustomSignalConfig[]): void {
    this.customSignals = [...signals];
  }

  public updateSignalPosition(id: number, x: number, y: number, w?: number, h?: number): void {
    const sig = this.customSignals.find(s => s.id === id);
    if (sig) {
      sig.x = Math.max(0.01, Math.min(0.95, parseFloat(x.toFixed(3))));
      sig.y = Math.max(0.01, Math.min(0.95, parseFloat(y.toFixed(3))));
      if (w !== undefined) sig.w = Math.max(0.02, Math.min(0.2, parseFloat(w.toFixed(3))));
      if (h !== undefined) sig.h = Math.max(0.04, Math.min(0.3, parseFloat(h.toFixed(3))));
    }
  }

  public setSignalOverride(id: number, override: 'AUTO' | 'RED' | 'YELLOW' | 'GREEN'): void {
    const sig = this.customSignals.find(s => s.id === id);
    if (sig) {
      sig.manualOverride = override;
    }
  }

  public autoLocateSignalsFromVideo(video: HTMLVideoElement): CustomSignalConfig[] {
    if (this.inferCtx && video.readyState >= 2) {
      this.inferCtx.drawImage(video, 0, 0, 640, 360);
      const spots = autoLocateTrafficLightSpots(this.inferCtx, 640, 360);
      if (spots.length >= 2) {
        this.customSignals = [
          {
            id: 1,
            label: 'Светофор #1 (Главное напр.)',
            x: spots[0].x,
            y: spots[0].y,
            w: spots[0].w,
            h: spots[0].h,
            direction: 'MAIN_DIRECTION',
            manualOverride: 'AUTO'
          },
          {
            id: 2,
            label: 'Светофор #2 (Поперечное напр.)',
            x: spots[1].x,
            y: spots[1].y,
            w: spots[1].w,
            h: spots[1].h,
            direction: 'CROSS_DIRECTION',
            manualOverride: 'AUTO'
          }
        ];
      } else if (spots.length === 1) {
        this.customSignals[0].x = spots[0].x;
        this.customSignals[0].y = spots[0].y;
        this.customSignals[0].w = spots[0].w;
        this.customSignals[0].h = spots[0].h;
      }
    }
    return [...this.customSignals];
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused) {
      const now = performance.now();
      for (const track of this.activeTracks.values()) {
        track.lastSeen = now;
      }
    }
  }

  public async init(): Promise<boolean> {
    if (this.model) return true;
    if (this.isModelLoading) return false;

    this.isModelLoading = true;
    try {
      await tf.ready();
      try {
        await tf.setBackend('webgl');
      } catch {
        // Fallback
      }

      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      });
      this.isModelLoading = false;
      return true;
    } catch (err) {
      console.error('Failed to load TF model:', err);
      this.isModelLoading = false;
      return false;
    }
  }

  public isReady(): boolean {
    return this.model !== null;
  }

  public getTracks(): LiveDetectedObject[] {
    return Array.from(this.activeTracks.values());
  }

  public getCollisionLog(): CollisionAlertEvent[] {
    return [...this.collisionLog];
  }

  /**
   * Butter-smooth 60 FPS interpolation with exponential easing
   */
  public updateInterpolation(): void {
    const smoothFactor = 0.28;
    for (const track of this.activeTracks.values()) {
      track.renderX += (track.targetX - track.renderX) * smoothFactor;
      track.renderY += (track.targetY - track.renderY) * smoothFactor;
      track.renderW += (track.targetW - track.renderW) * smoothFactor;
      track.renderH += (track.targetH - track.renderH) * smoothFactor;
    }
  }

  /**
   * Fast asynchronous frame processing with trajectory-windowed kinematics & multi-signal optical detection
   */
  public async processFrame(
    video: HTMLVideoElement,
    confThreshold: number = 0.28
  ): Promise<void> {
    if (!this.model || this.isProcessing || video.readyState < 2 || video.paused) {
      return;
    }

    this.isProcessing = true;
    const now = performance.now();
    const currentVideoTime = video.currentTime;

    try {
      if (this.inferCtx) {
        this.inferCtx.drawImage(video, 0, 0, 640, 360);
      }
      const rawPredictions = await this.model.detect(this.inferCanvas, 20, Math.min(confThreshold, 0.18));

      // 1. High-Precision Optical Multi-Traffic Light Detection & Phase Interlocking Analysis
      if (this.inferCtx) {
        const activeSignals: IndividualTrafficLight[] = this.customSignals.map(cfg => {
          const chroma = analyzeSingleTrafficLight(this.inferCtx!, {
            x: cfg.x,
            y: cfg.y,
            w: cfg.w,
            h: cfg.h
          }, 640, 360);

          let state = chroma.state;
          let colorHex = chroma.colorHex;
          let stateLabel = chroma.state === 'RED' ? 'КРАСНЫЙ' : chroma.state === 'YELLOW' ? 'ЖЕЛТЫЙ' : 'ЗЕЛЕНЫЙ';

          // Apply Majority Vote Filter across 15 frames to prevent optical glare flicker
          const stable = getStableSignalState(cfg.id, chroma.state, 15);
          state = stable.state;
          colorHex = stable.colorHex;
          stateLabel = stable.stateLabelRu;

          if (cfg.manualOverride && cfg.manualOverride !== 'AUTO') {
            state = cfg.manualOverride;
            colorHex = state === 'RED' ? '#ef4444' : state === 'YELLOW' ? '#f59e0b' : '#10b981';
            stateLabel = state === 'RED' ? 'КРАСНЫЙ' : state === 'YELLOW' ? 'ЖЕЛТЫЙ' : 'ЗЕЛЕНЫЙ';
          }

          return {
            id: cfg.id,
            label: cfg.label,
            direction: cfg.direction,
            directionLabelRu: cfg.direction === 'MAIN_DIRECTION' ? 'Главное направление' : 'Поперечное направление',
            x: cfg.x,
            y: cfg.y,
            w: cfg.w,
            h: cfg.h,
            state,
            manualOverride: cfg.manualOverride,
            stateLabelRu: stateLabel,
            confidence: chroma.confidence,
            activeColorHex: colorHex,
            lastUpdatedTime: currentVideoTime,
            isOccludedOrInferred: false,
            lampValues: chroma.lampValues
          };
        });

        // Apply strict ПДД Crossroad Conflict Matrix
        this.intersectionPhase = evaluateIntersectionInterlocking(activeSignals);
        this.detectedTrafficLights = this.intersectionPhase.signals;
        this.trafficLightState = this.intersectionPhase.mainPhase;
      }

      const trafficClasses = new Set(['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle']);
      
      // 2. Initial geometric filtering
      const validDetections = rawPredictions.filter(p => {
        if (!trafficClasses.has(p.class) || p.score < confThreshold) return false;
        const nw = p.bbox[2] / 640;
        const nh = p.bbox[3] / 360;
        const area = nw * nh;

        if (p.class === 'person') {
          if (nw > 0.25 || nh > 0.48 || area > 0.08 || nw < 0.008 || nh < 0.015) return false;
        } else if (p.class === 'motorcycle' || p.class === 'bicycle') {
          if (nw > 0.35 || nh > 0.45 || area > 0.09 || nw < 0.010 || nh < 0.015) return false;
        } else if (p.class === 'bus' || p.class === 'truck') {
          if (nw > 0.58 || nh > 0.52 || area > 0.24 || nw < 0.035 || nh < 0.035) return false;
        } else {
          if (nw > 0.48 || nh > 0.45 || area > 0.18 || nw < 0.020 || nh < 0.020) return false;
        }
        return true;
      });

      // 3. Multi-Class Fusion & Scooter / Rider Identification
      const fusedDetections: RawFusedDetection[] = [];
      const usedIndices = new Set<number>();

      const personIndices = validDetections.map((p, idx) => p.class === 'person' ? idx : -1).filter(i => i !== -1);
      const twoWheelerIndices = validDetections.map((p, idx) => (p.class === 'bicycle' || p.class === 'motorcycle') ? idx : -1).filter(i => i !== -1);

      // Check overlaps between persons and two-wheelers
      for (const pIdx of personIndices) {
        const pDet = validDetections[pIdx];
        const px = pDet.bbox[0] / 640;
        const py = pDet.bbox[1] / 360;
        const pw = pDet.bbox[2] / 640;
        const ph = pDet.bbox[3] / 360;

        let matchedBikeIdx: number | null = null;
        let isMoped = false;

        for (const bIdx of twoWheelerIndices) {
          if (usedIndices.has(bIdx)) continue;
          const bDet = validDetections[bIdx];
          const bx = bDet.bbox[0] / 640;
          const by = bDet.bbox[1] / 360;
          const bw = bDet.bbox[2] / 640;
          const bh = bDet.bbox[3] / 360;

          const xA = Math.max(px, bx);
          const yA = Math.max(py, by);
          const xB = Math.min(px + pw, bx + bw);
          const yB = Math.min(py + ph, by + bh);
          const interW = Math.max(0, xB - xA);
          const interH = Math.max(0, yB - yA);
          const interArea = interW * interH;
          const unionArea = pw * ph + bw * bh - interArea;
          const iou = unionArea > 0 ? interArea / unionArea : 0;
          const centerDist = Math.hypot((px + pw / 2) - (bx + bw / 2), (py + ph / 2) - (by + bh / 2));

          if (iou > 0.08 || centerDist < 0.10) {
            matchedBikeIdx = bIdx;
            isMoped = bDet.class === 'motorcycle' || (bw / bh > 0.60);
            break;
          }
        }

        if (matchedBikeIdx !== null) {
          usedIndices.add(pIdx);
          usedIndices.add(matchedBikeIdx);
          const bDet = validDetections[matchedBikeIdx];
          const bx = bDet.bbox[0] / 640;
          const by = bDet.bbox[1] / 360;
          const bw = bDet.bbox[2] / 640;
          const bh = bDet.bbox[3] / 360;

          const ux = Math.min(px, bx);
          const uy = Math.min(py, by);
          const uw = Math.max(px + pw, bx + bw) - ux;
          const uh = Math.max(py + ph, by + bh) - uy;

          fusedDetections.push({
            bbox: [ux, uy, uw, uh],
            class: isMoped ? 'motorcycle' : 'bicycle',
            labelRu: isMoped ? '🛵 КУРЬЕР / СКУТЕР' : '🚴 ВЕЛОСИПЕДИСТ',
            color: isMoped ? '#06b6d4' : '#10b981',
            score: Math.max(pDet.score, bDet.score)
          });
        }
      }

      // Add remaining detections
      validDetections.forEach((det, idx) => {
        if (usedIndices.has(idx)) return;

        const nx = det.bbox[0] / 640;
        const ny = det.bbox[1] / 360;
        const nw = det.bbox[2] / 640;
        const nh = det.bbox[3] / 360;
        const aspect = nw / nh;

        let detClass = det.class;
        let labelRu = '🚗 АВТОМОБИЛЬ';
        let color = '#38bdf8';

        if (det.class === 'person') {
          if (aspect > 0.58 && nw > 0.035 && nh > 0.07) {
            detClass = 'motorcycle';
            labelRu = '🛵 КУРЬЕР / СКУТЕР';
            color = '#06b6d4';
          } else {
            labelRu = '🚶 ПЕШЕХОД';
            color = '#10b981';
          }
        } else if (det.class === 'bicycle') {
          labelRu = '🚴 ВЕЛОСИПЕДИСТ';
          color = '#10b981';
        } else if (det.class === 'motorcycle') {
          labelRu = '🛵 КУРЬЕР / СКУТЕР';
          color = '#06b6d4';
        } else if (det.class === 'bus') {
          labelRu = '🚌 АВТОБУС';
          color = '#f59e0b';
        } else if (det.class === 'truck') {
          labelRu = '🚛 ГРУЗОВИК';
          color = '#f97316';
        } else {
          labelRu = '🚗 АВТОМОБИЛЬ';
          color = '#38bdf8';
        }

        fusedDetections.push({
          bbox: [nx, ny, nw, nh],
          class: detClass,
          labelRu,
          color,
          score: det.score
        });
      });

      // 4. Track Association & Adaptive Matching
      const matchedTrackIds = new Set<number>();

      fusedDetections.forEach(det => {
        const [nx, ny, nw, nh] = det.bbox;

        let bestScore = 0;
        let bestTrackId: number | null = null;

        for (const [id, track] of this.activeTracks.entries()) {
          if (matchedTrackIds.has(id)) continue;

          // IoU
          const xA = Math.max(nx, track.x);
          const yA = Math.max(ny, track.y);
          const xB = Math.min(nx + nw, track.x + track.w);
          const yB = Math.min(ny + nh, track.y + track.h);

          const interW = Math.max(0, xB - xA);
          const interH = Math.max(0, yB - yA);
          const interArea = interW * interH;
          const unionArea = nw * nh + track.w * track.h - interArea;
          const iou = unionArea > 0 ? interArea / unionArea : 0;

          const centerDist = Math.hypot((nx + nw / 2) - (track.x + track.w / 2), (ny + nh / 2) - (track.y + track.h / 2));
          const isClassCompatible = track.class === det.class || 
            (track.class === 'person' && det.class === 'motorcycle') ||
            (track.class === 'motorcycle' && det.class === 'person') ||
            (track.class.includes('bike') && det.class.includes('bike'));

          let score = 0;
          if (isClassCompatible) {
            score = iou * 0.65 + Math.max(0, 1.0 - centerDist / 0.15) * 0.35;
          } else {
            score = iou * 0.35;
          }

          if (score > bestScore && (iou > 0.08 || (centerDist < 0.09 && isClassCompatible))) {
            bestScore = score;
            bestTrackId = id;
          }
        }

        if (bestTrackId !== null) {
          matchedTrackIds.add(bestTrackId);
          const track = this.activeTracks.get(bestTrackId)!;

          // Compute accurate dt based on video time delta
          let dt = 0.08;
          if (currentVideoTime > 0 && track.lastVideoTime > 0 && currentVideoTime > track.lastVideoTime) {
            dt = Math.min(0.25, Math.max(0.02, currentVideoTime - track.lastVideoTime));
          } else {
            dt = Math.min(0.20, Math.max(0.04, (now - track.lastSeen) / 1000));
          }

          // EMA Bounding Box Smoothing: 80% previous + 20% new
          // Completely eliminates jittering and stabilizes speed computation
          track.targetX = track.targetX * 0.80 + nx * 0.20;
          track.targetY = track.targetY * 0.80 + ny * 0.20;
          track.targetW = track.targetW * 0.80 + nw * 0.20;
          track.targetH = track.targetH * 0.80 + nh * 0.20;

          // Class Voting / Majority Vote Filter (window size = 15)
          if (!track.classHistory) {
            track.classHistory = [];
          }
          track.classHistory.push(det.class);
          if (track.classHistory.length > 15) {
            track.classHistory.shift();
          }

          const voteCounts: Record<string, number> = {};
          track.classHistory.forEach(cls => {
            voteCounts[cls] = (voteCounts[cls] || 0) + 1;
          });

          let stableClass = det.class;
          let maxCount = -1;
          Object.entries(voteCounts).forEach(([cls, count]) => {
            if (count > maxCount) {
              maxCount = count;
              stableClass = cls;
            }
          });

          // Derive stable label & color based on majority vote
          let stableLabelRu = det.labelRu;
          let stableColor = det.color;
          if (stableClass === 'person') {
            stableLabelRu = '🚶 ПЕШЕХОД';
            stableColor = '#10b981';
          } else if (stableClass === 'motorcycle') {
            stableLabelRu = '🛵 КУРЬЕР / СКУТЕР';
            stableColor = '#06b6d4';
          } else if (stableClass === 'bicycle') {
            stableLabelRu = '🚴 ВЕЛОСИПЕДИСТ';
            stableColor = '#10b981';
          } else if (stableClass === 'bus') {
            stableLabelRu = '🚌 АВТОБУС';
            stableColor = '#f59e0b';
          } else if (stableClass === 'truck') {
            stableLabelRu = '🚛 ГРУЗОВИК';
            stableColor = '#f97316';
          } else if (stableClass === 'car') {
            stableLabelRu = '🚗 АВТОМОБИЛЬ';
            stableColor = '#38bdf8';
          }

          const smoothCenterX = track.targetX + track.targetW / 2;
          const smoothCenterY = track.targetY + track.targetH;

          // Transform 2D Image Contact Point -> Real-World Ground (X, Y) in meters
          const currentGround = projectImageToGround(smoothCenterX, smoothCenterY, this.calibration);

          // Append to history buffer for trajectory linear regression speed calculation
          if (!track.history) track.history = [];
          const timeStamp = currentVideoTime > 0 ? currentVideoTime : now / 1000;
          track.history.push({ gx: currentGround.gx, gy: currentGround.gy, t: timeStamp });
          if (track.history.length > 8) track.history.shift();

          const isPed = det.class === 'person';

          // Sliding Window Linear Velocity Calculation (Filters 100% of single-frame bounding box jitter)
          let calculatedSpeedKmh = 0.0;
          if (track.history.length >= 3) {
            const first = track.history[0];
            const last = track.history[track.history.length - 1];
            const deltaT = last.t - first.t;
            const deltaGX = last.gx - first.gx;
            const deltaGY = last.gy - first.gy;
            const totalDistM = Math.hypot(deltaGX, deltaGY);

            if (deltaT > 0.04) {
              const rawVelMps = totalDistM / deltaT;
              const rawSpeed = rawVelMps * 3.6;

              // If movement is below micro-displacement noise (e.g. stopped vehicle)
              if (totalDistM < (isPed ? 0.12 : 0.22)) {
                track.stillFrameCount = (track.stillFrameCount || 0) + 1;
              } else {
                track.stillFrameCount = 0;
              }

              if (track.stillFrameCount >= 2) {
                calculatedSpeedKmh = 0.0;
              } else {
                calculatedSpeedKmh = rawSpeed;
              }
            }
          }

          // Smooth speed EMA
          if (track.speedKmh > 0 && calculatedSpeedKmh > 0) {
            track.speedKmh = parseFloat((track.speedKmh * 0.72 + calculatedSpeedKmh * 0.28).toFixed(1));
          } else {
            track.speedKmh = parseFloat(calculatedSpeedKmh.toFixed(1));
          }

          const isReallyStopped = track.stillFrameCount >= 2 || track.speedKmh < 1.0;

          // Stopped vehicle timer (>10s rule)
          if (isReallyStopped && !isPed) {
            track.stoppedDurationSec = (track.stoppedDurationSec || 0) + dt;
          } else {
            track.stoppedDurationSec = Math.max(0, (track.stoppedDurationSec || 0) - dt * 0.5);
          }

          track.x = nx;
          track.y = ny;
          track.w = nw;
          track.h = nh;
          track.groundX = parseFloat(currentGround.gx.toFixed(2));
          track.groundY = parseFloat(currentGround.gy.toFixed(2));
          track.deltaDistanceM = parseFloat(Math.hypot(currentGround.gx - (track.groundX ?? currentGround.gx), currentGround.gy - (track.groundY ?? currentGround.gy)).toFixed(3));
          track.class = stableClass;
          track.labelRu = stableLabelRu;
          track.color = stableColor;
          track.score = det.score;
          track.isMoving = !isReallyStopped;
          track.lastSeen = now;
          track.lastVideoTime = currentVideoTime;
          track.missedFrames = 0;

          // Wheel contact point for line crossing & trajectories
          const wheelPoint = { x: track.renderX + track.renderW / 2, y: track.renderY + track.renderH };

          // Solid line crossing detection
          if (track.isMoving && track.trail.length > 1) {
            const prevWheel = track.trail[track.trail.length - 1];
            const activeDividers = this.getSolidDividers();
            for (const divider of activeDividers) {
              const intersected = doSegmentsIntersect(
                prevWheel,
                wheelPoint,
                { x: divider.x1, y: divider.y1 },
                { x: divider.x2, y: divider.y2 }
              );
              if (intersected && !track.hasCrossedSolidLine) {
                track.hasCrossedSolidLine = true;
                this.addRawEvent({
                  id: `solid_${track.id}_${Math.round(currentVideoTime * 10)}`,
                  start_sec: Math.max(0, currentVideoTime - 0.5),
                  end_sec: currentVideoTime + 1.8,
                  label: 'solid_line_crossing',
                  confidence: 0.93,
                  description: `Транспорт #${track.id} (${track.labelRu}) пересек ${divider.name}`,
                  involvedObjects: [`#${track.id} ${track.labelRu}`]
                });
              }
            }
          }

          // Stopped vehicle rule (>10s)
          if (track.stoppedDurationSec >= 10.0 && !track.hasTriggeredStoppedVehicle && this.trafficLightState !== 'RED') {
            track.hasTriggeredStoppedVehicle = true;
            this.addRawEvent({
              id: `stop_${track.id}_${Math.round(currentVideoTime)}`,
              start_sec: Math.max(0, currentVideoTime - 10.0),
              end_sec: currentVideoTime + 3.0,
              label: 'stopped_vehicle',
              confidence: 0.95,
              description: `Остановка на проезжей части > 10с (Транспорт #${track.id})`,
              involvedObjects: [`#${track.id} ${track.labelRu}`]
            });
          }

          // Status determination
          if (track.hasCrossedSolidLine) {
            track.status = 'СПЛОШНАЯ';
          } else if (track.stoppedDurationSec >= 10.0) {
            track.status = 'СТОИТ >10с';
          } else if (isReallyStopped) {
            track.status = isPed ? 'СТОИТ' : 'ОСТАНОВКА';
          } else if (isPed) {
            track.status = 'ПЕРЕХОД';
          } else if (track.speedKmh > 65) {
            track.status = 'ПРЕВЫШЕНИЕ';
          } else {
            track.status = 'ДВИЖЕНИЕ';
          }

          if (track.isMoving) {
            track.trail.push(wheelPoint);
            if (track.trail.length > 14) track.trail.shift();
          }
        } else {
          // Initialize New Track with pure dynamic kinematics
          const newId = this.nextTrackId++;
          const ground = projectImageToGround(nx + nw / 2, ny + nh, this.calibration);

          const newTrack: LiveDetectedObject = {
            id: newId,
            class: det.class,
            labelRu: det.labelRu,
            score: det.score,
            x: nx,
            y: ny,
            w: nw,
            h: nh,
            targetX: nx,
            targetY: ny,
            targetW: nw,
            targetH: nh,
            vx: 0,
            vy: 0,
            renderX: nx,
            renderY: ny,
            renderW: nw,
            renderH: nh,
            groundX: parseFloat(ground.gx.toFixed(2)),
            groundY: parseFloat(ground.gy.toFixed(2)),
            deltaDistanceM: 0,
            history: [{ gx: ground.gx, gy: ground.gy, t: currentVideoTime > 0 ? currentVideoTime : now / 1000 }],
            speedKmh: 0.0,
            speedHistory: [],
            isMoving: false,
            stillFrameCount: 0,
            status: det.class === 'person' ? 'ПЕРЕХОД' : 'ДВИЖЕНИЕ',
            color: det.color,
            trail: [{ x: nx + nw / 2, y: ny + nh }],
            lastSeen: now,
            lastVideoTime: currentVideoTime,
            missedFrames: 0,
            stoppedDurationSec: 0,
            hasTriggeredStoppedVehicle: false,
            hasCrossedSolidLine: false
          };

          this.activeTracks.set(newId, newTrack);
        }
      });

      // Age unmatched tracks & clean up lost tracks
      for (const [id, track] of this.activeTracks.entries()) {
        if (!matchedTrackIds.has(id)) {
          track.missedFrames++;
          if (track.missedFrames > 12 || (now - track.lastSeen > 1200)) {
            this.activeTracks.delete(id);
          }
        }
      }

      // Optical Smoke & Fire Analysis
      if (this.inferCtx) {
        this.opticalSmokeResult = analyzeOpticalSmokeFire(this.inferCtx, 640, 360);
      }

      // Pairwise Collision Proximity & TTC Alert Engine
      this.evaluateCollisionProximities(currentVideoTime, now);

    } catch (err) {
      console.error('Inference error:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  private evaluateCollisionProximities(videoTime: number, wallClockNow: number): void {
    const tracks = Array.from(this.activeTracks.values());
    const entities: TrackedTrafficEntity[] = tracks.map(t => ({
      id: t.id,
      class: t.class,
      x: t.renderX + t.renderW / 2,
      y: t.renderY + t.renderH * 0.85,
      w: t.renderW,
      h: t.renderH,
      renderX: t.renderX,
      renderY: t.renderY,
      renderW: t.renderW,
      renderH: t.renderH,
      speedKmh: t.speedKmh
    }));

    const risks = evaluatePairwiseCollisionRisks(entities);

    // Reset risk flags
    tracks.forEach(t => {
      t.collisionRisk = false;
      t.conflictWithId = undefined;
      t.distanceMeters = undefined;
      t.ttcSeconds = undefined;
    });

    risks.forEach(r => {
      const t1 = this.activeTracks.get(r.sourceId);
      const t2 = this.activeTracks.get(r.targetId);
      if (t1 && t2) {
        t1.collisionRisk = true;
        t1.conflictWithId = t2.id;
        t1.distanceMeters = r.distanceMeters;
        t1.ttcSeconds = r.ttcSeconds;

        t2.collisionRisk = true;
        t2.conflictWithId = t1.id;
        t2.distanceMeters = r.distanceMeters;
        t2.ttcSeconds = r.ttcSeconds;

        const pairKey = `${Math.min(t1.id, t2.id)}_${Math.max(t1.id, t2.id)}`;
        const count = (this.pairConflictFrames.get(pairKey) || 0) + 1;
        this.pairConflictFrames.set(pairKey, count);

        if (count >= 3 && wallClockNow - this.lastAlertTime > 2500) {
          this.lastAlertTime = wallClockNow;
          const timeFormatted = `${Math.floor(videoTime / 60)}:${(Math.floor(videoTime) % 60).toString().padStart(2, '0')}`;
          
          this.collisionLog.unshift({
            id: `alert_${Date.now()}`,
            timestamp: videoTime,
            timeFormatted,
            sourceId: t1.id,
            sourceLabel: t1.labelRu,
            targetId: t2.id,
            targetLabel: t2.labelRu,
            distanceMeters: r.distanceMeters,
            ttcSeconds: r.ttcSeconds,
            severity: r.ttcSeconds < 1.2 ? 'CRITICAL' : 'WARNING'
          });

          if (this.collisionLog.length > 20) this.collisionLog.pop();

          this.addRawEvent({
            id: `collision_risk_${t1.id}_${t2.id}_${Math.round(videoTime)}`,
            start_sec: Math.max(0, videoTime - 0.5),
            end_sec: videoTime + 2.0,
            label: 'accident',
            confidence: 0.91,
            description: `Опасное сближение: #${t1.id} и #${t2.id} (TTC = ${r.ttcSeconds}с, дист = ${r.distanceMeters}м)`,
            involvedObjects: [`#${t1.id} ${t1.labelRu}`, `#${t2.id} ${t2.labelRu}`]
          });
        }
      }
    });
  }

  public getSolidDividers(): SolidLaneDivider[] {
    return this.customDividers.length > 0 ? this.customDividers : DEFAULT_SOLID_DIVIDERS;
  }

  public setSolidDividers(dividers: SolidLaneDivider[]): void {
    this.customDividers = [...dividers];
  }

  public autoDetectLanesFromFrame(video: HTMLVideoElement): SolidLaneDivider[] {
    if (this.inferCtx && video.readyState >= 2) {
      this.inferCtx.drawImage(video, 0, 0, 640, 360);
      try {
        const imgData = this.inferCtx.getImageData(0, 100, 640, 240);
        const data = imgData.data;
        const width = 640;
        const height = 240;

        let leftWhiteSum = 0, leftWhiteCount = 0;
        let rightWhiteSum = 0, rightWhiteCount = 0;

        for (let y = 0; y < height; y += 4) {
          const rowStart = y * width * 4;
          for (let x = 40; x < width - 40; x += 4) {
            const idx = rowStart + x * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3;

            if (brightness > 195 && Math.abs(r - g) < 20 && Math.abs(r - b) < 25) {
              if (x < width * 0.48) {
                leftWhiteSum += x;
                leftWhiteCount++;
              } else if (x > width * 0.52) {
                rightWhiteSum += x;
                rightWhiteCount++;
              }
            }
          }
        }

        if (leftWhiteCount > 20 && rightWhiteCount > 20) {
          const avgLeftX = (leftWhiteSum / leftWhiteCount) / width;
          const avgRightX = (rightWhiteSum / rightWhiteCount) / width;

          const updated: SolidLaneDivider[] = [
            {
              id: 'solid_1',
              name: 'Сплошная #1 (Левая)',
              x1: Math.max(0.20, Math.min(0.48, parseFloat((avgLeftX + 0.05).toFixed(3)))),
              y1: 0.28,
              x2: Math.max(0.12, Math.min(0.42, parseFloat((avgLeftX - 0.08).toFixed(3)))),
              y2: 0.94
            },
            {
              id: 'solid_2',
              name: 'Сплошная #2 (Правая)',
              x1: Math.max(0.52, Math.min(0.80, parseFloat((avgRightX - 0.05).toFixed(3)))),
              y1: 0.28,
              x2: Math.max(0.58, Math.min(0.88, parseFloat((avgRightX + 0.08).toFixed(3)))),
              y2: 0.94
            }
          ];
          this.customDividers = updated;
          return updated;
        }
      } catch (err) {
        console.warn('Auto lane detection fallback:', err);
      }
    }
    return this.getSolidDividers();
  }

  public getOpticalSmokeResult(): OpticalSmokeFireResult {
    return this.opticalSmokeResult;
  }

  public getSceneAnalysis(): TrafficSceneAnalysis {
    const tracks = Array.from(this.activeTracks.values());
    const entities: TrackedTrafficEntity[] = tracks.map(t => ({
      id: t.id,
      class: t.class,
      x: t.renderX + t.renderW / 2,
      y: t.renderY + t.renderH * 0.85,
      w: t.renderW,
      h: t.renderH,
      renderX: t.renderX,
      renderY: t.renderY,
      renderW: t.renderW,
      renderH: t.renderH,
      speedKmh: t.speedKmh
    }));

    const vehicles = tracks.filter(t => t.class !== 'person');
    const peds = tracks.filter(t => t.class === 'person');

    const avgSpeed = vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + v.speedKmh, 0) / vehicles.length
      : 0;

    const densityMetrics: TrafficDensityMetrics = calculateTrafficDensityAndLOS(entities);

    const tlState = this.intersectionPhase.mainPhase;
    const tlLabel = tlState === 'RED'
      ? '🔴 КРАСНЫЙ (Движение закрыто)'
      : tlState === 'YELLOW'
      ? '🟡 ЖЕЛТЫЙ (Внимание / Очистка)'
      : '🟢 ЗЕЛЕНЫЙ (Движение разрешено)';

    return {
      trafficLightState: tlState,
      trafficLightLabel: tlLabel,
      trafficLights: this.detectedTrafficLights,
      intersectionPhase: this.intersectionPhase,
      congestionScore: densityMetrics.congestionScore,
      congestionLevel: densityMetrics.congestionLevel,
      levelOfService: densityMetrics.levelOfService,
      roadOccupancyPct: densityMetrics.roadOccupancyPct,
      vehicleDensityPerKm: densityMetrics.vehicleDensityPerKm,
      vehicleCount: vehicles.length,
      pedestrianCount: peds.length,
      averageSpeedKmh: parseFloat(avgSpeed.toFixed(1)),
      activeCollisions: this.collisionLog.slice(0, 5),
      densityDescriptionRu: densityMetrics.densityDescriptionRu
    };
  }

  public addRawEvent(event: TrafficEvent): void {
    const isDuplicate = this.rawEvents.some(
      e => e.label === event.label && Math.abs(e.start_sec - event.start_sec) < 2.0
    );
    if (!isDuplicate) {
      this.rawEvents.push(event);
    }
  }

  public getRawEvents(): TrafficEvent[] {
    return [...this.rawEvents];
  }

  public getSmoothedEvents(): TrafficEvent[] {
    return smoothAndDebounceEvents(this.rawEvents);
  }

  public reset(): void {
    this.activeTracks.clear();
    this.nextTrackId = 1;
    this.collisionLog = [];
    this.rawEvents = [];
    this.pairConflictFrames.clear();
  }
}

export const realtimeNeuralVision = new RealtimeNeuralVisionEngine();
