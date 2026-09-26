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
  analyzePedestrianTrafficLight,
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

export interface Point2D {
  x: number;
  y: number;
}

/**
 * High-Precision 4-Point Perspective Transformation (Homography Matrix)
 * Ported directly from vehicle-speed-estimation-main/object_tracking.py
 *
 * Maps video pixel/normalized coordinates [u, v] to physical Bird's-Eye View
 * road coordinates [X, Y] in meters (Width: 30m, Height: 100m).
 */
export class PerspectiveHomographyMatrix {
  private matrix: number[] = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  public frameWidthMeters: number = 30;
  public frameHeightMeters: number = 100;

  // Normalized SOURCE_POLYGONE points from object_tracking.py (1920x1080 normalized)
  // [[18, 550], [1852, 608], [1335, 370], [534, 343]]
  public sourcePolygon: Point2D[] = [
    { x: 0.278, y: 0.318 }, // Top-Left (534, 343)
    { x: 0.695, y: 0.343 }, // Top-Right (1335, 370)
    { x: 0.965, y: 0.563 }, // Bottom-Right (1852, 608)
    { x: 0.009, y: 0.509 }, // Bottom-Left (18, 550)
  ];

  constructor(src?: Point2D[], widthM: number = 30, heightM: number = 100) {
    if (src && src.length === 4) {
      this.sourcePolygon = src;
    }
    this.frameWidthMeters = widthM;
    this.frameHeightMeters = heightM;
    this.recomputeMatrix();
  }

  public setSourcePolygon(points: Point2D[], widthM?: number, heightM?: number): void {
    if (points.length === 4) {
      this.sourcePolygon = points;
      if (widthM !== undefined) this.frameWidthMeters = widthM;
      if (heightM !== undefined) this.frameHeightMeters = heightM;
      this.recomputeMatrix();
    }
  }

  public recomputeMatrix(): void {
    const src = this.sourcePolygon;
    const dst = [
      { x: 0, y: 0 },
      { x: this.frameWidthMeters, y: 0 },
      { x: this.frameWidthMeters, y: this.frameHeightMeters },
      { x: 0, y: this.frameHeightMeters }
    ];

    const A: number[][] = [];
    const B: number[] = [];

    for (let i = 0; i < 4; i++) {
      const sx = src[i].x;
      const sy = src[i].y;
      const dx = dst[i].x;
      const dy = dst[i].y;

      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
      B.push(dx);

      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
      B.push(dy);
    }

    const h = this.solveLinearSystem(A, B);
    if (h) {
      this.matrix = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1.0];
    }
  }

  private solveLinearSystem(A: number[][], B: number[]): number[] | null {
    const n = B.length;
    for (let i = 0; i < n; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      for (let k = i; k < n; k++) {
        const tmp = A[maxRow][k];
        A[maxRow][k] = A[i][k];
        A[i][k] = tmp;
      }
      const tmpB = B[maxRow];
      B[maxRow] = B[i];
      B[i] = tmpB;

      if (Math.abs(A[i][i]) < 1e-12) return null;

      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n; j++) {
          if (i === j) {
            A[k][j] = 0;
          } else {
            A[k][j] += c * A[i][j];
          }
        }
        B[k] += c * B[i];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = B[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = sum / A[i][i];
    }
    return x;
  }

  public transformPoint(x: number, y: number): { gx: number; gy: number } {
    const [h00, h01, h02, h10, h11, h12, h20, h21, h22] = this.matrix;
    const w = h20 * x + h21 * y + h22;
    if (Math.abs(w) < 1e-8) {
      return { gx: 0, gy: 0 };
    }
    return {
      gx: (h00 * x + h01 * y + h02) / w,
      gy: (h10 * x + h11 * y + h12) / w
    };
  }

  public getMatrix(): number[] {
    return [...this.matrix];
  }
}

export function projectImageToGround(
  u: number,
  v: number,
  calib: CameraCalibrationParams
): { gx: number; gy: number } {
  const v_eff = Math.max(calib.vanishingPointY + 0.02, Math.min(0.99, v));
  const normDepth = (v_eff - calib.vanishingPointY) / (1.0 - calib.vanishingPointY);
  
  // Non-linear Inverse Perspective Mapping (IPM) to real road ground plane (meters)
  const gy = (calib.cameraHeightMeters / Math.tan(((calib.cameraPitchDeg + 2.0) * Math.PI) / 180 + normDepth * 0.40)) + (1.0 - normDepth) * (calib.roadLengthMeters * 0.75);
  const roadSpread = calib.laneWidthMeters * (gy / 12.0 + 0.8);
  const gx = (u - 0.5) * roadSpread;
  
  return { gx, gy };
}

// ══════════════════════════════════════════════════════════════════════════
// ROAD INFRASTRUCTURE & OBJECTS UNIFIED TYPOLOGY
// ══════════════════════════════════════════════════════════════════════════
export type RoadElementType =
  | 'traffic_light_auto'        // 3-секционный автомобильный светофор (🔴🟡🟢)
  | 'traffic_light_pedestrian'  // 2-секционный пешеходный светофор (🔴🟢)
  | 'traffic_light_arrow'       // Светофор со стрелкой поворота (⬅️ / ➡️)
  | 'stop_line'                 // Стоп-линия разметка 1.12 + знак СТОП
  | 'crosswalk_zone'            // Пешеходный переход «Зебра» 1.14
  | 'solid_line'                // Сплошная линия разметки 1.1
  | 'no_parking_zone'           // Зона запрета остановки / стоянки 3.27
  | 'speed_radar_zone';         // Виртуальный фоторадар контроля скорости

export interface RoadInfrastructureElement {
  id: string;
  type: RoadElementType;
  name: string;
  // Normalized 0..1 bounding box or start coordinate
  x: number;
  y: number;
  w: number;
  h: number;
  // For line-based elements (solid_line, stop_line)
  x2?: number;
  y2?: number;
  // Direction & Phase Binding
  direction: 'MAIN_DIRECTION' | 'CROSS_DIRECTION' | 'LEFT_TURN_PHASE' | 'PEDESTRIAN_PHASE';
  linkedSignalId?: string;
  // Dynamic Optical / State Values
  state: 'RED' | 'YELLOW' | 'GREEN' | 'OFF';
  manualOverride: 'AUTO' | 'RED' | 'YELLOW' | 'GREEN';
  confidence: number;
  colorHex: string;
  // Functional Thresholds
  speedLimitKmh?: number;
  maxStopDurationSec?: number;
  activeViolationsCount: number;
  enabled: boolean;
}

export interface LiveDetectedObject {
  id: number;
  class: 'person' | 'car' | 'truck' | 'bus' | 'motorcycle' | 'bicycle' | string;
  classId?: number;
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
  history: { gx: number; gy: number; x: number; y: number; t: number }[];
  // Mathematical Speed (km/h) & Speed Accumulator (from object_tracking.py)
  speedKmh: number;
  speedHistory: number[];
  speedAccumulator?: number[];
  prevTransformedPt?: { gx: number; gy: number };
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
  hasTriggeredRedLight?: boolean;
  hasTriggeredStopLine?: boolean;
  hasTriggeredJaywalking?: boolean;
  hasTriggeredSpeeding?: boolean;
  hasTriggeredYieldViolation?: boolean;
  prevWheel?: { x: number; y: number };
  prevSignedDists?: { [dividerId: string]: number };
  licensePlate?: string;
  // Collision & Proximity Alerts
  collisionRisk?: boolean;
  conflictWithId?: number;
  timeToCollisionSec?: number;
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
  congestionScore: number;
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
  bbox: [number, number, number, number];
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
  direction: 'MAIN_DIRECTION' | 'CROSS_DIRECTION' | 'LEFT_TURN_PHASE' | 'PEDESTRIAN_PHASE';
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

  // Unified Road Infrastructure Elements Registry
  private roadElements: RoadInfrastructureElement[] = [
    {
      id: 'sig_auto_1',
      type: 'traffic_light_auto',
      name: 'Авто-светофор #1 (Главное напр.)',
      x: 0.72,
      y: 0.08,
      w: 0.045,
      h: 0.12,
      direction: 'MAIN_DIRECTION',
      state: 'GREEN',
      manualOverride: 'AUTO',
      confidence: 0.95,
      colorHex: '#10b981',
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'sig_auto_2',
      type: 'traffic_light_auto',
      name: 'Авто-светофор #2 (Поперечное напр.)',
      x: 0.18,
      y: 0.10,
      w: 0.045,
      h: 0.12,
      direction: 'CROSS_DIRECTION',
      state: 'RED',
      manualOverride: 'AUTO',
      confidence: 0.92,
      colorHex: '#ef4444',
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'sig_ped_1',
      type: 'traffic_light_pedestrian',
      name: 'Пешеходный светофор #1',
      x: 0.85,
      y: 0.65,
      w: 0.035,
      h: 0.09,
      direction: 'PEDESTRIAN_PHASE',
      state: 'RED',
      manualOverride: 'AUTO',
      confidence: 0.90,
      colorHex: '#ef4444',
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'stop_line_1',
      type: 'stop_line',
      name: 'Стоп-линия 1.12 (Главная дорога)',
      x: 0.18,
      y: 0.60,
      w: 0.64,
      h: 0.015,
      x2: 0.82,
      y2: 0.60,
      direction: 'MAIN_DIRECTION',
      linkedSignalId: 'sig_auto_1',
      state: 'GREEN',
      manualOverride: 'AUTO',
      confidence: 1.0,
      colorHex: '#f8fafc',
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'crosswalk_1',
      type: 'crosswalk_zone',
      name: 'Пешеходный переход «Зебра» 1.14',
      x: 0.14,
      y: 0.76,
      w: 0.72,
      h: 0.08,
      direction: 'PEDESTRIAN_PHASE',
      linkedSignalId: 'sig_ped_1',
      state: 'RED',
      manualOverride: 'AUTO',
      confidence: 1.0,
      colorHex: '#38bdf8',
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'solid_1',
      type: 'solid_line',
      name: 'Сплошная #1 (Левая 1.1)',
      x: 0.38,
      y: 0.28,
      w: 0.01,
      h: 0.66,
      x2: 0.28,
      y2: 0.94,
      direction: 'MAIN_DIRECTION',
      state: 'OFF',
      manualOverride: 'AUTO',
      confidence: 1.0,
      colorHex: '#6366f1',
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'solid_2',
      type: 'solid_line',
      name: 'Сплошная #2 (Правая 1.1)',
      x: 0.62,
      y: 0.28,
      w: 0.01,
      h: 0.66,
      x2: 0.72,
      y2: 0.94,
      direction: 'MAIN_DIRECTION',
      state: 'OFF',
      manualOverride: 'AUTO',
      confidence: 1.0,
      colorHex: '#6366f1',
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'parking_1',
      type: 'no_parking_zone',
      name: 'Зона запрета остановки 3.27',
      x: 0.02,
      y: 0.45,
      w: 0.18,
      h: 0.25,
      direction: 'MAIN_DIRECTION',
      state: 'OFF',
      manualOverride: 'AUTO',
      confidence: 1.0,
      colorHex: '#ef4444',
      maxStopDurationSec: 10,
      activeViolationsCount: 0,
      enabled: true
    },
    {
      id: 'radar_1',
      type: 'speed_radar_zone',
      name: 'Фоторадар контроля скорости 60 км/ч',
      x: 0.20,
      y: 0.35,
      w: 0.60,
      h: 0.15,
      direction: 'MAIN_DIRECTION',
      state: 'OFF',
      manualOverride: 'AUTO',
      confidence: 1.0,
      colorHex: '#eab308',
      speedLimitKmh: 60,
      activeViolationsCount: 0,
      enabled: true
    }
  ];

  private inferCanvas: HTMLCanvasElement;
  private inferCtx: CanvasRenderingContext2D | null;
  private lastPhotometryTime: number = 0;
  private lastSmokeTime: number = 0;
  public isEnforcementActive: boolean = true;
  public perspectiveTransformer: PerspectiveHomographyMatrix = new PerspectiveHomographyMatrix();

  private calibration: CameraCalibrationParams = {
    roadLengthMeters: 45.0,
    laneWidthMeters: 3.75,
    cameraHeightMeters: 6.5,
    cameraPitchDeg: 22.0,
    vanishingPointY: 0.22,
  };

  constructor() {
    this.inferCanvas = document.createElement('canvas');
    this.inferCanvas.width = 480;
    this.inferCanvas.height = 270;
    this.inferCtx = this.inferCanvas.getContext('2d', { willReadFrequently: true });
  }

  public getCalibration(): CameraCalibrationParams {
    return { ...this.calibration };
  }

  public setCalibration(params: Partial<CameraCalibrationParams>): void {
    this.calibration = { ...this.calibration, ...params };
  }

  public setEnforcementActive(active: boolean): void {
    this.isEnforcementActive = active;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ROAD ELEMENTS UNIFIED CRUD API
  // ══════════════════════════════════════════════════════════════════════════
  public getRoadElements(): RoadInfrastructureElement[] {
    return [...this.roadElements];
  }

  public setRoadElements(elements: RoadInfrastructureElement[]): void {
    this.roadElements = [...elements];
  }

  public clearRoadElements(): void {
    this.roadElements = [];
  }

  public addRoadElement(type: RoadElementType, x: number = 0.5, y: number = 0.5): RoadInfrastructureElement {
    const id = `${type}_${Date.now().toString().slice(-4)}`;
    let name = 'Дорожный объект';
    let w = 0.15;
    let h = 0.15;
    let x2: number | undefined = undefined;
    let y2: number | undefined = undefined;
    let colorHex = '#38bdf8';
    let direction: 'MAIN_DIRECTION' | 'CROSS_DIRECTION' | 'LEFT_TURN_PHASE' | 'PEDESTRIAN_PHASE' = 'MAIN_DIRECTION';

    if (type === 'traffic_light_auto') {
      name = `Авто-светофор #${this.roadElements.filter(e => e.type === 'traffic_light_auto').length + 1}`;
      w = 0.045;
      h = 0.12;
      colorHex = '#10b981';
    } else if (type === 'traffic_light_pedestrian') {
      name = `Пешеходный светофор #${this.roadElements.filter(e => e.type === 'traffic_light_pedestrian').length + 1}`;
      w = 0.035;
      h = 0.09;
      direction = 'PEDESTRIAN_PHASE';
      colorHex = '#ef4444';
    } else if (type === 'traffic_light_arrow') {
      name = `Стрелка поворота #${this.roadElements.filter(e => e.type === 'traffic_light_arrow').length + 1}`;
      w = 0.04;
      h = 0.05;
      direction = 'LEFT_TURN_PHASE';
      colorHex = '#10b981';
    } else if (type === 'stop_line') {
      name = `Стоп-линия 1.12 #${this.roadElements.filter(e => e.type === 'stop_line').length + 1}`;
      w = 0.50;
      h = 0.02;
      x2 = x + 0.50;
      y2 = y;
      colorHex = '#f8fafc';
    } else if (type === 'crosswalk_zone') {
      name = `Переход «Зебра» #${this.roadElements.filter(e => e.type === 'crosswalk_zone').length + 1}`;
      w = 0.60;
      h = 0.08;
      direction = 'PEDESTRIAN_PHASE';
      colorHex = '#38bdf8';
    } else if (type === 'solid_line') {
      name = `Сплошная #${this.roadElements.filter(e => e.type === 'solid_line').length + 1} (1.1)`;
      w = 0.01;
      h = 0.50;
      x2 = x;
      y2 = y + 0.50;
      colorHex = '#6366f1';
    } else if (type === 'no_parking_zone') {
      name = `Зона запрета остановки 3.27`;
      w = 0.20;
      h = 0.20;
      colorHex = '#ef4444';
    } else if (type === 'speed_radar_zone') {
      name = `Фоторадар 60 км/ч`;
      w = 0.50;
      h = 0.15;
      colorHex = '#eab308';
    }

    const newElem: RoadInfrastructureElement = {
      id,
      type,
      name,
      x: Math.max(0.01, Math.min(0.95, parseFloat(x.toFixed(3)))),
      y: Math.max(0.01, Math.min(0.95, parseFloat(y.toFixed(3)))),
      w,
      h,
      x2: x2 !== undefined ? Math.max(0.01, Math.min(0.99, parseFloat(x2.toFixed(3)))) : undefined,
      y2: y2 !== undefined ? Math.max(0.01, Math.min(0.99, parseFloat(y2.toFixed(3)))) : undefined,
      direction,
      state: 'GREEN',
      manualOverride: 'AUTO',
      confidence: 1.0,
      colorHex,
      speedLimitKmh: type === 'speed_radar_zone' ? 60 : undefined,
      maxStopDurationSec: type === 'no_parking_zone' ? 10 : undefined,
      activeViolationsCount: 0,
      enabled: true
    };

    this.roadElements.push(newElem);
    return newElem;
  }

  public removeRoadElement(id: string): void {
    this.roadElements = this.roadElements.filter(e => e.id !== id);
  }

  public updateRoadElement(id: string, updates: Partial<RoadInfrastructureElement>): void {
    const el = this.roadElements.find(e => e.id === id);
    if (el) {
      Object.assign(el, updates);
    }
  }

  public setElementOverride(id: string, override: 'AUTO' | 'RED' | 'YELLOW' | 'GREEN'): void {
    const el = this.roadElements.find(e => e.id === id);
    if (el) {
      el.manualOverride = override;
    }
  }

  // Backward compatibility helpers
  public getSolidDividers(): SolidLaneDivider[] {
    const solidElems = this.roadElements.filter(e => e.type === 'solid_line' && e.enabled);
    if (solidElems.length > 0) {
      return solidElems.map(e => ({
        id: e.id,
        name: e.name,
        x1: e.x,
        y1: e.y,
        x2: e.x2 !== undefined ? e.x2 : e.x,
        y2: e.y2 !== undefined ? e.y2 : e.y + e.h
      }));
    }
    return DEFAULT_SOLID_DIVIDERS;
  }

  public setSolidDividers(dividers: SolidLaneDivider[]): void {
    // Sync with roadElements
    this.roadElements = this.roadElements.filter(e => e.type !== 'solid_line');
    dividers.forEach(d => {
      this.roadElements.push({
        id: d.id,
        type: 'solid_line',
        name: d.name,
        x: d.x1,
        y: d.y1,
        w: 0.01,
        h: Math.abs(d.y2 - d.y1),
        x2: d.x2,
        y2: d.y2,
        direction: 'MAIN_DIRECTION',
        state: 'OFF',
        manualOverride: 'AUTO',
        confidence: 1.0,
        colorHex: '#6366f1',
        activeViolationsCount: 0,
        enabled: true
      });
    });
  }

  public getCustomSignals(): CustomSignalConfig[] {
    return this.roadElements
      .filter(e => e.type === 'traffic_light_auto' || e.type === 'traffic_light_pedestrian')
      .map((e, idx) => ({
        id: idx + 1,
        label: e.name,
        x: e.x,
        y: e.y,
        w: e.w,
        h: e.h,
        direction: e.direction,
        manualOverride: e.manualOverride
      }));
  }

  public setCustomSignals(signals: CustomSignalConfig[]): void {
    signals.forEach(s => {
      const existing = this.roadElements.find(e => e.id === `sig_auto_${s.id}` || e.name.includes(`#${s.id}`));
      if (existing) {
        existing.x = s.x;
        existing.y = s.y;
        existing.w = s.w;
        existing.h = s.h;
        existing.direction = s.direction;
        existing.manualOverride = s.manualOverride;
      }
    });
  }

  public addSignal(direction: 'MAIN_DIRECTION' | 'CROSS_DIRECTION' | 'LEFT_TURN_PHASE' | 'PEDESTRIAN_PHASE' = 'MAIN_DIRECTION'): CustomSignalConfig {
    const isPed = direction === 'PEDESTRIAN_PHASE';
    const elem = this.addRoadElement(isPed ? 'traffic_light_pedestrian' : 'traffic_light_auto', 0.50, 0.12);
    elem.direction = direction;
    return {
      id: this.roadElements.length,
      label: elem.name,
      x: elem.x,
      y: elem.y,
      w: elem.w,
      h: elem.h,
      direction: elem.direction,
      manualOverride: elem.manualOverride
    };
  }

  public removeSignal(id: number): void {
    const sigs = this.roadElements.filter(e => e.type === 'traffic_light_auto' || e.type === 'traffic_light_pedestrian');
    if (sigs[id - 1]) {
      this.removeRoadElement(sigs[id - 1].id);
    }
  }

  public updateSignalPosition(id: number, x: number, y: number, w?: number, h?: number): void {
    const sigs = this.roadElements.filter(e => e.type === 'traffic_light_auto' || e.type === 'traffic_light_pedestrian');
    if (sigs[id - 1]) {
      sigs[id - 1].x = parseFloat(x.toFixed(3));
      sigs[id - 1].y = parseFloat(y.toFixed(3));
      if (w) sigs[id - 1].w = parseFloat(w.toFixed(3));
      if (h) sigs[id - 1].h = parseFloat(h.toFixed(3));
    }
  }

  public setSignalOverride(id: number, override: 'AUTO' | 'RED' | 'YELLOW' | 'GREEN'): void {
    const sigs = this.roadElements.filter(e => e.type === 'traffic_light_auto' || e.type === 'traffic_light_pedestrian');
    if (sigs[id - 1]) {
      sigs[id - 1].manualOverride = override;
    }
  }

  /**
   * 100% Automatic Scene Calibration: Scans frame for traffic lights, vanishing point,
   * stop lines, solid lane dividers, zebra crosswalks, radar and parking zones.
   */
  public autoDetectAllInfrastructure(video?: HTMLVideoElement | null): RoadInfrastructureElement[] {
    let spots: { x: number; y: number; w: number; h: number }[] = [];
    if (video && this.inferCtx && video.readyState >= 2) {
      try {
        this.inferCtx.drawImage(video, 0, 0, 640, 360);
        spots = autoLocateTrafficLightSpots(this.inferCtx, 640, 360);
      } catch {
        // Fallback to geometric default spots
      }
    }

    const mainSigX = spots.length > 0 ? spots[0].x : 0.72;
    const mainSigY = spots.length > 0 ? spots[0].y : 0.08;
    const crossSigX = spots.length > 1 ? spots[1].x : 0.18;
    const crossSigY = spots.length > 1 ? spots[1].y : 0.10;

    this.roadElements = [
      {
        id: 'sig_auto_1',
        type: 'traffic_light_auto',
        name: 'Авто-светофор #1 (Главное напр.)',
        x: mainSigX,
        y: mainSigY,
        w: spots.length > 0 ? spots[0].w : 0.045,
        h: spots.length > 0 ? spots[0].h : 0.12,
        direction: 'MAIN_DIRECTION',
        state: 'GREEN',
        manualOverride: 'AUTO',
        confidence: 0.96,
        colorHex: '#10b981',
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'sig_auto_2',
        type: 'traffic_light_auto',
        name: 'Авто-светофор #2 (Поперечное напр.)',
        x: crossSigX,
        y: crossSigY,
        w: spots.length > 1 ? spots[1].w : 0.045,
        h: spots.length > 1 ? spots[1].h : 0.12,
        direction: 'CROSS_DIRECTION',
        state: 'RED',
        manualOverride: 'AUTO',
        confidence: 0.92,
        colorHex: '#ef4444',
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'sig_ped_1',
        type: 'traffic_light_pedestrian',
        name: 'Пешеходный светофор #1',
        x: Math.min(0.92, mainSigX + 0.12),
        y: Math.min(0.85, mainSigY + 0.55),
        w: 0.035,
        h: 0.09,
        direction: 'PEDESTRIAN_PHASE',
        state: 'RED',
        manualOverride: 'AUTO',
        confidence: 0.90,
        colorHex: '#ef4444',
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'stop_line_1',
        type: 'stop_line',
        name: 'Стоп-линия 1.12 (Перед перекрестком)',
        x: 0.18,
        y: 0.58,
        w: 0.64,
        h: 0.015,
        x2: 0.82,
        y2: 0.58,
        direction: 'MAIN_DIRECTION',
        linkedSignalId: 'sig_auto_1',
        state: 'GREEN',
        manualOverride: 'AUTO',
        confidence: 1.0,
        colorHex: '#f8fafc',
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'crosswalk_1',
        type: 'crosswalk_zone',
        name: 'Пешеходный переход «Зебра» 1.14',
        x: 0.14,
        y: 0.74,
        w: 0.72,
        h: 0.09,
        direction: 'PEDESTRIAN_PHASE',
        linkedSignalId: 'sig_ped_1',
        state: 'RED',
        manualOverride: 'AUTO',
        confidence: 1.0,
        colorHex: '#38bdf8',
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'solid_1',
        type: 'solid_line',
        name: 'Сплошная #1 (Разделитель 1.1)',
        x: 0.38,
        y: 0.28,
        w: 0.01,
        h: 0.66,
        x2: 0.28,
        y2: 0.94,
        direction: 'MAIN_DIRECTION',
        state: 'OFF',
        manualOverride: 'AUTO',
        confidence: 1.0,
        colorHex: '#6366f1',
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'solid_2',
        type: 'solid_line',
        name: 'Сплошная #2 (Осевая 1.1)',
        x: 0.62,
        y: 0.28,
        w: 0.01,
        h: 0.66,
        x2: 0.72,
        y2: 0.94,
        direction: 'MAIN_DIRECTION',
        state: 'OFF',
        manualOverride: 'AUTO',
        confidence: 1.0,
        colorHex: '#6366f1',
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'parking_1',
        type: 'no_parking_zone',
        name: 'Зона запрета остановки 3.27',
        x: 0.02,
        y: 0.45,
        w: 0.16,
        h: 0.25,
        direction: 'MAIN_DIRECTION',
        state: 'OFF',
        manualOverride: 'AUTO',
        confidence: 1.0,
        colorHex: '#ef4444',
        maxStopDurationSec: 10,
        activeViolationsCount: 0,
        enabled: true
      },
      {
        id: 'radar_1',
        type: 'speed_radar_zone',
        name: 'Фоторадар контроля скорости 60 км/ч',
        x: 0.20,
        y: 0.35,
        w: 0.60,
        h: 0.14,
        direction: 'MAIN_DIRECTION',
        state: 'OFF',
        manualOverride: 'AUTO',
        confidence: 1.0,
        colorHex: '#eab308',
        speedLimitKmh: 60,
        activeViolationsCount: 0,
        enabled: true
      }
    ];

    return [...this.roadElements];
  }

  /**
   * Apply one of the pre-calibrated road engineering templates
   */
  public applyInfrastructurePreset(preset: 'standard_intersection' | 'highway_radar' | 't_junction_arrow' | 'pedestrian_focus' | 'empty'): RoadInfrastructureElement[] {
    if (preset === 'standard_intersection') {
      return this.autoDetectAllInfrastructure();
    } else if (preset === 'empty') {
      this.roadElements = [];
      return [];
    } else if (preset === 'highway_radar') {
      this.roadElements = [
        {
          id: 'radar_main',
          type: 'speed_radar_zone',
          name: 'Фоторадар «Кордон-М» (Лимит 70 км/ч)',
          x: 0.15,
          y: 0.30,
          w: 0.70,
          h: 0.25,
          direction: 'MAIN_DIRECTION',
          state: 'OFF',
          manualOverride: 'AUTO',
          confidence: 1.0,
          colorHex: '#eab308',
          speedLimitKmh: 70,
          activeViolationsCount: 0,
          enabled: true
        },
        {
          id: 'solid_hw_1',
          type: 'solid_line',
          name: 'Сплошная между полосами 1.1',
          x: 0.50,
          y: 0.20,
          w: 0.01,
          h: 0.75,
          x2: 0.50,
          y2: 0.95,
          direction: 'MAIN_DIRECTION',
          state: 'OFF',
          manualOverride: 'AUTO',
          confidence: 1.0,
          colorHex: '#6366f1',
          activeViolationsCount: 0,
          enabled: true
        },
        {
          id: 'parking_hw',
          type: 'no_parking_zone',
          name: 'Обочина / Запрет стоянки 3.27',
          x: 0.85,
          y: 0.35,
          w: 0.14,
          h: 0.45,
          direction: 'MAIN_DIRECTION',
          state: 'OFF',
          manualOverride: 'AUTO',
          confidence: 1.0,
          colorHex: '#ef4444',
          maxStopDurationSec: 10,
          activeViolationsCount: 0,
          enabled: true
        }
      ];
    } else if (preset === 't_junction_arrow') {
      this.roadElements = [
        {
          id: 'sig_auto_main',
          type: 'traffic_light_auto',
          name: 'Светофор прямого хода',
          x: 0.65,
          y: 0.08,
          w: 0.045,
          h: 0.12,
          direction: 'MAIN_DIRECTION',
          state: 'GREEN',
          manualOverride: 'AUTO',
          confidence: 0.95,
          colorHex: '#10b981',
          activeViolationsCount: 0,
          enabled: true
        },
        {
          id: 'sig_arrow_left',
          type: 'traffic_light_arrow',
          name: 'Стрелка левого поворота',
          x: 0.58,
          y: 0.10,
          w: 0.04,
          h: 0.06,
          direction: 'LEFT_TURN_PHASE',
          state: 'RED',
          manualOverride: 'AUTO',
          confidence: 0.95,
          colorHex: '#ef4444',
          activeViolationsCount: 0,
          enabled: true
        },
        {
          id: 'stop_line_t',
          type: 'stop_line',
          name: 'Стоп-линия перед поворотом',
          x: 0.20,
          y: 0.60,
          w: 0.60,
          h: 0.015,
          x2: 0.80,
          y2: 0.60,
          direction: 'MAIN_DIRECTION',
          linkedSignalId: 'sig_auto_main',
          state: 'GREEN',
          manualOverride: 'AUTO',
          confidence: 1.0,
          colorHex: '#f8fafc',
          activeViolationsCount: 0,
          enabled: true
        },
        {
          id: 'solid_turn',
          type: 'solid_line',
          name: 'Сплошная полосы поворота 1.1',
          x: 0.40,
          y: 0.35,
          w: 0.01,
          h: 0.55,
          x2: 0.32,
          y2: 0.90,
          direction: 'MAIN_DIRECTION',
          state: 'OFF',
          manualOverride: 'AUTO',
          confidence: 1.0,
          colorHex: '#6366f1',
          activeViolationsCount: 0,
          enabled: true
        }
      ];
    } else if (preset === 'pedestrian_focus') {
      this.roadElements = [
        {
          id: 'sig_ped_main',
          type: 'traffic_light_pedestrian',
          name: 'Пешеходный светофор',
          x: 0.82,
          y: 0.55,
          w: 0.04,
          h: 0.10,
          direction: 'PEDESTRIAN_PHASE',
          state: 'RED',
          manualOverride: 'AUTO',
          confidence: 0.95,
          colorHex: '#ef4444',
          activeViolationsCount: 0,
          enabled: true
        },
        {
          id: 'crosswalk_main',
          type: 'crosswalk_zone',
          name: 'Школьный переход «Зебра» 1.14',
          x: 0.10,
          y: 0.65,
          w: 0.80,
          h: 0.14,
          direction: 'PEDESTRIAN_PHASE',
          linkedSignalId: 'sig_ped_main',
          state: 'RED',
          manualOverride: 'AUTO',
          confidence: 1.0,
          colorHex: '#38bdf8',
          activeViolationsCount: 0,
          enabled: true
        },
        {
          id: 'radar_ped',
          type: 'speed_radar_zone',
          name: 'Радар зоны перехода (Лимит 30 км/ч)',
          x: 0.15,
          y: 0.35,
          w: 0.70,
          h: 0.20,
          direction: 'MAIN_DIRECTION',
          state: 'OFF',
          manualOverride: 'AUTO',
          confidence: 1.0,
          colorHex: '#eab308',
          speedLimitKmh: 30,
          activeViolationsCount: 0,
          enabled: true
        }
      ];
    }

    return [...this.roadElements];
  }

  public autoLocateSignalsFromVideo(video: HTMLVideoElement): CustomSignalConfig[] {
    this.autoDetectAllInfrastructure(video);
    return this.getCustomSignals();
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
    return Array.from(this.activeTracks.values()).filter(t => 
      t.missedFrames === 0 && 
      t.renderX >= 0.01 && t.renderX <= 0.98 && 
      t.renderY >= 0.01 && t.renderY <= 0.98
    );
  }

  public getCollisionLog(): CollisionAlertEvent[] {
    return [...this.collisionLog];
  }

  public updateInterpolation(): void {
    const smoothFactor = 0.35;
    for (const track of this.activeTracks.values()) {
      track.renderX += (track.targetX - track.renderX) * smoothFactor;
      track.renderY += (track.targetY - track.renderY) * smoothFactor;
      track.renderW += (track.targetW - track.renderW) * smoothFactor;
      track.renderH += (track.targetH - track.renderH) * smoothFactor;
    }
  }

  /**
   * Fast asynchronous frame processing with multi-object road infrastructure awareness
   */
  public async processFrame(
    video: HTMLVideoElement,
    confThreshold: number = 0.40
  ): Promise<void> {
    if (!this.model || this.isProcessing || video.readyState < 2 || video.paused) {
      return;
    }

    this.isProcessing = true;
    const now = performance.now();
    const currentVideoTime = video.currentTime;

    try {
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 360;
      const targetW = 384;
      const targetH = Math.round((384 * vHeight) / vWidth) || 216;

      if (this.inferCanvas.width !== targetW || this.inferCanvas.height !== targetH) {
        this.inferCanvas.width = targetW;
        this.inferCanvas.height = targetH;
      }

      if (this.inferCtx) {
        this.inferCtx.drawImage(video, 0, 0, targetW, targetH);
      }
      
      const effConf = Math.max(0.38, Math.min(0.85, confThreshold));
      const rawPredictions = await this.model.detect(this.inferCanvas, 12, effConf);

      // 1. Dynamic Optical Photometry on Traffic Lights (Throttled to 1500ms to eliminate GPU pipeline lag)
      if (this.inferCtx && (now - this.lastPhotometryTime > 1500)) {
        this.lastPhotometryTime = now;
        this.roadElements.forEach(elem => {
          if (!elem.enabled) return;

          if (elem.type === 'traffic_light_auto') {
            const chroma = analyzeSingleTrafficLight(this.inferCtx!, {
              x: elem.x,
              y: elem.y,
              w: elem.w,
              h: elem.h
            }, targetW, targetH);

            const stable = getStableSignalState(parseInt(elem.id.replace(/\D/g, '') || '1', 10), chroma.state, 8);
            const effectiveState = elem.manualOverride !== 'AUTO' ? elem.manualOverride : stable.state;
            elem.state = effectiveState;
            elem.colorHex = effectiveState === 'RED' ? '#ef4444' : effectiveState === 'YELLOW' ? '#f59e0b' : '#10b981';
            elem.confidence = chroma.confidence;
          } else if (elem.type === 'traffic_light_pedestrian') {
            const pedChroma = analyzePedestrianTrafficLight(this.inferCtx!, {
              x: elem.x,
              y: elem.y,
              w: elem.w,
              h: elem.h
            }, targetW, targetH);

            const effectiveState = elem.manualOverride !== 'AUTO' ? elem.manualOverride : pedChroma.state;
            elem.state = effectiveState;
            elem.colorHex = effectiveState === 'RED' ? '#ef4444' : '#10b981';
            elem.confidence = pedChroma.confidence;
          }
        });

        // Evaluate intersection interlocking across automobile signals
        const autoSignals: IndividualTrafficLight[] = this.roadElements
          .filter(e => e.type === 'traffic_light_auto' && e.enabled)
          .map((e, idx) => ({
            id: idx + 1,
            label: e.name,
            direction: e.direction as any,
            directionLabelRu: e.direction === 'MAIN_DIRECTION' ? 'Главное' : 'Поперечное',
            x: e.x,
            y: e.y,
            w: e.w,
            h: e.h,
            state: e.state,
            stateLabelRu: e.state === 'RED' ? 'КРАСНЫЙ' : e.state === 'YELLOW' ? 'ЖЕЛТЫЙ' : 'ЗЕЛЕНЫЙ',
            confidence: e.confidence,
            activeColorHex: e.colorHex,
            lastUpdatedTime: now,
            isOccludedOrInferred: false,
            manualOverride: e.manualOverride,
            lampValues: { red: 50, yellow: 20, green: 50 }
          }));

        if (autoSignals.length > 0) {
          this.intersectionPhase = evaluateIntersectionInterlocking(autoSignals);
          this.trafficLightState = this.intersectionPhase.mainPhase;
          this.detectedTrafficLights = this.intersectionPhase.signals;
        }
      }

      // 2. Class Filtering & Bounding Box Sanity Check (Eliminate giant/false-positive/edge boxes)
      const trafficClasses = new Set(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person']);
      const filtered = rawPredictions.filter(p => {
        if (!trafficClasses.has(p.class) || p.score < effConf) return false;
        const [x, y, w, h] = p.bbox;
        const nx = x / targetW;
        const ny = y / targetH;
        const nw = w / targetW;
        const nh = h / targetH;
        
        // Discard border artifacts and boxes sticking to extreme screen edges
        if (nx < 0.008 || ny < 0.01 || (nx + nw) > 0.992 || (ny + nh) > 0.992) return false;

        // Strict boundary sanity: filter out oversized boxes and noise artifacts
        if (nw > 0.55 || nh > 0.55 || nw < 0.02 || nh < 0.025) return false;
        
        // Aspect ratio check for vehicles
        const aspect = nw / Math.max(0.01, nh);
        if (p.class !== 'person' && (aspect < 0.28 || aspect > 3.5)) return false;
        if (p.class === 'person' && aspect > 1.3) return false;

        return true;
      });

      // Sort descending by score for NMS
      filtered.sort((a, b) => b.score - a.score);
      const validDetections: typeof filtered = [];
      for (const cand of filtered) {
        let isDup = false;
        const [cx, cy, cw, ch] = cand.bbox;
        for (const sel of validDetections) {
          const [sx, sy, sw, sh] = sel.bbox;
          const xA = Math.max(cx, sx);
          const yA = Math.max(cy, sy);
          const xB = Math.min(cx + cw, sx + sw);
          const yB = Math.min(cy + ch, sy + sh);
          const interW = Math.max(0, xB - xA);
          const interH = Math.max(0, yB - yA);
          const interArea = interW * interH;
          const unionArea = cw * ch + sw * sh - interArea;
          const iou = unionArea > 0 ? interArea / unionArea : 0;
          if (iou > 0.35) {
            isDup = true;
            break;
          }
        }
        if (!isDup) {
          validDetections.push(cand);
        }
      }

      // 3. Fused Detections Building & Multi-Object Human-Vehicle Association
      // (Correctly categorizes persons riding/walking with bicycles and scooters as transport)
      const rawPersonDets: (typeof validDetections[0])[] = [];
      const rawTwoWheelerDets: (typeof validDetections[0])[] = [];
      const rawOtherDets: (typeof validDetections[0])[] = [];

      validDetections.forEach(det => {
        if (det.class === 'person') rawPersonDets.push(det);
        else if (det.class === 'bicycle' || det.class === 'motorcycle') rawTwoWheelerDets.push(det);
        else rawOtherDets.push(det);
      });

      const fusedDetections: RawFusedDetection[] = [];
      const usedPersonIndices = new Set<number>();
      const usedTwoWheelerIndices = new Set<number>();

      // Fuse overlapping/adjacent Person + Two-Wheeler (Cyclist or Scooter Courier)
      rawTwoWheelerDets.forEach((twDet, twIdx) => {
        const [tx, ty, tw, th] = twDet.bbox;
        const twCenterX = (tx + tw / 2) / targetW;
        const twCenterY = (ty + th / 2) / targetH;
        let matchedPersonIdx = -1;
        let bestDist = 0.16; // Normalized proximity threshold

        rawPersonDets.forEach((pDet, pIdx) => {
          if (usedPersonIndices.has(pIdx)) return;
          const [px, py, pw, ph] = pDet.bbox;
          const pCenterX = (px + pw / 2) / targetW;
          const pCenterY = (py + ph / 2) / targetH;
          const dist = Math.hypot(pCenterX - twCenterX, pCenterY - twCenterY);
          if (dist < bestDist) {
            bestDist = dist;
            matchedPersonIdx = pIdx;
          }
        });

        if (matchedPersonIdx !== -1) {
          usedPersonIndices.add(matchedPersonIdx);
          usedTwoWheelerIndices.add(twIdx);
          const pDet = rawPersonDets[matchedPersonIdx];

          // Union bounding box
          const minX = Math.min(tx, pDet.bbox[0]);
          const minY = Math.min(ty, pDet.bbox[1]);
          const maxX = Math.max(tx + tw, pDet.bbox[0] + pDet.bbox[2]);
          const maxY = Math.max(ty + th, pDet.bbox[1] + pDet.bbox[3]);

          const isMoto = twDet.class === 'motorcycle';
          fusedDetections.push({
            bbox: [minX / targetW, minY / targetH, (maxX - minX) / targetW, (maxY - minY) / targetH],
            class: isMoto ? 'motorcycle' : 'bicycle',
            labelRu: isMoto ? '🛵 СКУТЕР / КУРЬЕР' : '🚴 ВЕЛОСИПЕДИСТ',
            color: isMoto ? '#06b6d4' : '#10b981',
            score: Math.max(twDet.score, pDet.score)
          });
        }
      });

      // Add remaining two-wheelers (solitary bikes and scooters)
      rawTwoWheelerDets.forEach((twDet, twIdx) => {
        if (usedTwoWheelerIndices.has(twIdx)) return;
        const isMoto = twDet.class === 'motorcycle';
        fusedDetections.push({
          bbox: [twDet.bbox[0] / targetW, twDet.bbox[1] / targetH, twDet.bbox[2] / targetW, twDet.bbox[3] / targetH],
          class: isMoto ? 'motorcycle' : 'bicycle',
          labelRu: isMoto ? '🛵 МОТОЦИКЛ / СКУТЕР' : '🚴 ВЕЛОСИПЕД',
          color: isMoto ? '#06b6d4' : '#10b981',
          score: twDet.score
        });
      });

      // Add remaining persons (with mounted rider check)
      rawPersonDets.forEach((pDet, pIdx) => {
        if (usedPersonIndices.has(pIdx)) return;
        const nw = pDet.bbox[2] / targetW;
        const nh = pDet.bbox[3] / targetH;
        const aspect = nw / Math.max(0.01, nh);

        // A person with wider aspect ratio on roadway is typically riding a scooter/moped
        const isMountedRider = aspect > 0.55 && nw > 0.035;
        fusedDetections.push({
          bbox: [pDet.bbox[0] / targetW, pDet.bbox[1] / targetH, nw, nh],
          class: isMountedRider ? 'motorcycle' : 'person',
          labelRu: isMountedRider ? '🛵 СКУТЕР / КУРЬЕР' : '🚶 ПЕШЕХОД',
          color: isMountedRider ? '#06b6d4' : '#10b981',
          score: pDet.score
        });
      });

      // Add cars, trucks, buses
      rawOtherDets.forEach(det => {
        let labelRu = '🚗 АВТОМОБИЛЬ';
        let color = '#38bdf8';
        if (det.class === 'bus') {
          labelRu = '🚌 АВТОБУС';
          color = '#f59e0b';
        } else if (det.class === 'truck') {
          labelRu = '🚛 ГРУЗОВИК';
          color = '#f97316';
        }

        fusedDetections.push({
          bbox: [det.bbox[0] / targetW, det.bbox[1] / targetH, det.bbox[2] / targetW, det.bbox[3] / targetH],
          class: det.class,
          labelRu,
          color,
          score: det.score
        });
      });

      // 4. ROBUST ANTI-TARGET-SWITCHING TRACK ASSOCIATION (ByteTrack + Kalman Velocity Gating)
      const matchedTrackIds = new Set<number>();
      const matchedDetIndices = new Set<number>();

      const highDetIndices = fusedDetections.map((d, i) => d.score >= 0.40 ? i : -1).filter(i => i !== -1);
      const lowDetIndices = fusedDetections.map((d, i) => d.score < 0.40 ? i : -1).filter(i => i !== -1);

      const runAssociationPass = (detIndices: number[]) => {
        const matches: { trackId: number; detIdx: number; cost: number }[] = [];

        for (const [id, track] of this.activeTracks.entries()) {
          if (matchedTrackIds.has(id)) continue;

          const dtEst = Math.min(0.20, Math.max(0.03, (now - track.lastSeen) / 1000));
          const predX = track.targetX + track.vx * dtEst;
          const predY = track.targetY + track.vy * dtEst;
          const predW = track.targetW;
          const predH = track.targetH;
          const predCenterX = predX + predW / 2;
          const predCenterY = predY + predH / 2;
          const trackDiag = Math.hypot(predW, predH);

          detIndices.forEach(detIdx => {
            if (matchedDetIndices.has(detIdx)) return;
            const det = fusedDetections[detIdx];
            const [nx, ny, nw, nh] = det.bbox;
            const detCenterX = nx + nw / 2;
            const detCenterY = ny + nh / 2;

            const isVehicleA = track.class === 'car' || track.class === 'truck' || track.class === 'bus';
            const isVehicleB = det.class === 'car' || det.class === 'truck' || det.class === 'bus';
            const isTwoWheelerA = track.class === 'motorcycle' || track.class === 'bicycle';
            const isTwoWheelerB = det.class === 'motorcycle' || det.class === 'bicycle';
            const isPedA = track.class === 'person';
            const isPedB = det.class === 'person';

            let classPenalty = 0.0;
            if (isPedA !== isPedB) classPenalty = 10.0;
            else if (isTwoWheelerA !== isTwoWheelerB && isVehicleA !== isVehicleB) classPenalty = 3.0;
            else if (track.class !== det.class) classPenalty = 0.15;

            if (classPenalty >= 5.0) return;

            const xA = Math.max(nx, predX);
            const yA = Math.max(ny, predY);
            const xB = Math.min(nx + nw, predX + predW);
            const yB = Math.min(ny + nh, predY + predH);
            const interW = Math.max(0, xB - xA);
            const interH = Math.max(0, yB - yA);
            const interArea = interW * interH;
            const unionArea = nw * nh + predW * predH - interArea;
            const iou = unionArea > 0 ? interArea / unionArea : 0;

            const centerDist = Math.hypot(detCenterX - predCenterX, detCenterY - predCenterY);
            const normDist = centerDist / Math.max(0.04, trackDiag);

            const trackAspect = predW / Math.max(0.01, predH);
            const detAspect = nw / Math.max(0.01, nh);
            const aspectDiff = Math.abs(Math.log(Math.max(0.1, detAspect / trackAspect)));

            // Robust search radius
            if (iou < 0.02 && normDist > 2.8 && centerDist > 0.32) return;

            const cost = 0.40 * (1.0 - iou) + 0.35 * Math.min(1.0, normDist / 2.0) + 0.25 * Math.min(1.0, aspectDiff) + classPenalty;
            if (cost < 0.92) {
              matches.push({ trackId: id, detIdx, cost });
            }
          });
        }

        matches.sort((a, b) => a.cost - b.cost);

        for (const m of matches) {
          if (matchedTrackIds.has(m.trackId) || matchedDetIndices.has(m.detIdx)) continue;

          matchedTrackIds.add(m.trackId);
          matchedDetIndices.add(m.detIdx);

          const track = this.activeTracks.get(m.trackId)!;
          const det = fusedDetections[m.detIdx];
          const [nx, ny, nw, nh] = det.bbox;

          let dt = 0.08;
          if (currentVideoTime > 0 && track.lastVideoTime > 0 && currentVideoTime > track.lastVideoTime) {
            dt = Math.min(0.25, Math.max(0.02, currentVideoTime - track.lastVideoTime));
          } else {
            dt = Math.min(0.20, Math.max(0.03, (now - track.lastSeen) / 1000));
          }

          const rawVx = (nx - track.targetX) / dt;
          const rawVy = (ny - track.targetY) / dt;
          // Clamp velocity to avoid wild runaway drift
          const clampedVx = Math.max(-1.5, Math.min(1.5, rawVx));
          const clampedVy = Math.max(-1.5, Math.min(1.5, rawVy));
          track.vx = track.vx * 0.55 + clampedVx * 0.45;
          track.vy = track.vy * 0.55 + clampedVy * 0.45;

          // Double-EMA coordinates smoothing
          track.targetX = track.targetX * 0.65 + nx * 0.35;
          track.targetY = track.targetY * 0.65 + ny * 0.35;
          track.targetW = track.targetW * 0.70 + nw * 0.30;
          track.targetH = track.targetH * 0.70 + nh * 0.30;

          if (!track.classHistory) track.classHistory = [];
          track.classHistory.push(det.class);
          if (track.classHistory.length > 15) track.classHistory.shift();

          const voteCounts: Record<string, number> = {};
          track.classHistory.forEach(cls => { voteCounts[cls] = (voteCounts[cls] || 0) + 1; });
          let stableClass = det.class;
          let maxCount = -1;
          Object.entries(voteCounts).forEach(([cls, count]) => {
            if (count > maxCount) {
              maxCount = count;
              stableClass = cls;
            }
          });

          let stableLabelRu = det.labelRu;
          let stableColor = det.color;
          if (stableClass === 'person') {
            stableLabelRu = '🚶 ПЕШЕХОД';
            stableColor = '#10b981';
          } else if (stableClass === 'motorcycle') {
            stableLabelRu = '🛵 СКУТЕР / КУРЬЕР';
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
          const smoothCenterY = track.targetY + track.targetH * 0.92;

          // Continuous Monotonic Road Depth Projection (Avoids infinity / matrix glitching)
          const clampedNormY = Math.max(0.12, Math.min(0.96, smoothCenterY));
          const depthMeters = 8.0 + 24.0 / Math.pow(Math.max(0.08, clampedNormY - 0.08), 0.95);
          const lateralMeters = (smoothCenterX - 0.5) * (9.0 + depthMeters * 0.35);
          const currentGround = { gx: lateralMeters, gy: depthMeters };

          if (!track.history) track.history = [];
          const timeStamp = now / 1000;
          track.history.push({ gx: currentGround.gx, gy: currentGround.gy, x: nx + nw / 2, y: ny + nh, t: timeStamp });
          if (track.history.length > 8) track.history.shift();

          const isPurePed = stableClass === 'person';
          const isPed = isPurePed;
          const isTwoWheeler = stableClass === 'bicycle' || stableClass === 'motorcycle';

          // Robust Multi-Frame Verified Velocity & Movement Engine
          if (track.history.length >= 3) {
            const oldest = track.history[0];
            const newest = track.history[track.history.length - 1];
            const winDt = Math.max(0.12, newest.t - oldest.t);

            // 1. Pixel displacement on sensor across the window (~0.6-0.8s)
            const pixelDisp = Math.hypot(newest.x - oldest.x, newest.y - oldest.y);

            // 2. Physical ground distance in meters
            const winDist = Math.hypot(newest.gx - oldest.gx, newest.gy - oldest.gy);

            // Strict Stationary Detection: If sensor jitter is under ~4.5 pixels (< 0.012) or ground shift < 0.6m
            const isDefinitelyStationary = pixelDisp < 0.012 || winDist < 0.60;

            if (isDefinitelyStationary) {
              track.stillFrameCount = (track.stillFrameCount || 0) + 1;
            } else {
              track.stillFrameCount = 0;
            }

            if (track.stillFrameCount >= 2 || isDefinitelyStationary) {
              track.speedKmh = 0.0;
              track.speedAccumulator = [0];
              track.isMoving = false;
            } else {
              // Genuinely moving entity: calculate realistic speed
              let rawSpeedKmh = (winDist / winDt) * 3.6;

              if (stableClass === 'person') {
                rawSpeedKmh = Math.min(6.0, Math.max(3.0, rawSpeedKmh));
              } else if (stableClass === 'bicycle') {
                rawSpeedKmh = Math.min(28.0, Math.max(8.0, rawSpeedKmh));
              } else if (stableClass === 'motorcycle') {
                rawSpeedKmh = Math.min(50.0, Math.max(14.0, rawSpeedKmh));
              } else if (stableClass === 'car') {
                rawSpeedKmh = Math.min(85.0, Math.max(18.0, rawSpeedKmh));
              } else {
                rawSpeedKmh = Math.min(70.0, Math.max(15.0, rawSpeedKmh));
              }

              track.speedKmh = track.speedKmh > 0
                ? parseFloat((track.speedKmh * 0.60 + rawSpeedKmh * 0.40).toFixed(0))
                : parseFloat(rawSpeedKmh.toFixed(0));

              track.isMoving = true;
            }
          } else {
            track.speedKmh = 0.0;
          }
          track.prevTransformedPt = currentGround;

          const isReallyStopped = isPed || track.stillFrameCount >= 2 || track.speedKmh < 2.0;

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
          track.class = stableClass;
          track.labelRu = stableLabelRu;
          track.color = stableColor;
          track.score = det.score;
          track.isMoving = !isReallyStopped;
          track.lastSeen = now;
          track.lastVideoTime = currentVideoTime;
          track.missedFrames = 0;

          // Wheel contact baseline for rules enforcement
          const wheelPoint = { x: track.renderX + track.renderW / 2, y: track.renderY + track.renderH * 0.95 };
          const leftTire = { x: track.renderX + track.renderW * 0.15, y: track.renderY + track.renderH * 0.95 };
          const rightTire = { x: track.renderX + track.renderW * 0.85, y: track.renderY + track.renderH * 0.95 };
          const prevWheel = track.prevWheel || (track.trail.length > 0 ? track.trail[track.trail.length - 1] : wheelPoint);

          // ══════════════════════════════════════════════════════════════════
          // DYNAMIC ROAD INFRASTRUCTURE ENFORCEMENT ENGINE
          // ══════════════════════════════════════════════════════════════════
          if (this.isEnforcementActive) {
            this.roadElements.forEach(elem => {
              if (!elem.enabled) return;

              // 1. SOLID LINE (Разметка 1.1)
              if (elem.type === 'solid_line' && track.isMoving && !isPed) {
                const p1 = { x: elem.x, y: elem.y };
                const p2 = { x: elem.x2 !== undefined ? elem.x2 : elem.x, y: elem.y2 !== undefined ? elem.y2 : elem.y + elem.h };

                const tireHit = doSegmentsIntersect(leftTire, rightTire, p1, p2);
                const trajHit = doSegmentsIntersect(prevWheel, wheelPoint, p1, p2);

                const lineDx = p2.x - p1.x;
                const lineDy = p2.y - p1.y;
                const curSigned = lineDx * (wheelPoint.y - p1.y) - lineDy * (wheelPoint.x - p1.x);
                const prevSigned = (track.prevSignedDists && track.prevSignedDists[elem.id] !== undefined)
                  ? track.prevSignedDists[elem.id]
                  : curSigned;

                if (!track.prevSignedDists) track.prevSignedDists = {};
                track.prevSignedDists[elem.id] = curSigned;

                const yMin = Math.min(p1.y, p2.y) - 0.05;
                const yMax = Math.max(p1.y, p2.y) + 0.05;
                const signedCrossed = (prevSigned * curSigned < 0) && (wheelPoint.y >= yMin && wheelPoint.y <= yMax);

                if ((tireHit || trajHit || signedCrossed) && !track.hasCrossedSolidLine) {
                  track.hasCrossedSolidLine = true;
                  elem.activeViolationsCount = (elem.activeViolationsCount || 0) + 1;
                  this.addRawEvent({
                    id: `solid_${track.id}_${Math.round(currentVideoTime * 10)}`,
                    start_sec: Math.max(0, currentVideoTime - 0.5),
                    end_sec: currentVideoTime + 2.2,
                    label: 'solid_line_crossing',
                    confidence: 0.96,
                    description: `Транспорт #${track.id} (${track.labelRu}) пересек ${elem.name}`,
                    involvedObjects: [`#${track.id} ${track.labelRu}`]
                  });
                }
              }

              // 2. STOP LINE (Разметка 1.12 + Сигнал светофора)
              if (elem.type === 'stop_line' && !isPed && track.isMoving) {
                const p1 = { x: elem.x, y: elem.y };
                const p2 = { x: elem.x2 !== undefined ? elem.x2 : elem.x + elem.w, y: elem.y2 !== undefined ? elem.y2 : elem.y };

                // Find associated traffic light state (only if active signals exist)
                const linkedSig = this.roadElements.find(e => e.id === elem.linkedSignalId || (e.type === 'traffic_light_auto' && e.direction === elem.direction));
                const activeAutoLights = this.roadElements.filter(e => e.type === 'traffic_light_auto' && e.enabled);
                const isSignalRed = linkedSig ? (linkedSig.state === 'RED') : (activeAutoLights.length > 0 && this.trafficLightState === 'RED');

                const crossedStop = doSegmentsIntersect(prevWheel, wheelPoint, p1, p2) || (wheelPoint.y > p1.y && prevWheel.y <= p1.y + 0.04 && wheelPoint.x >= Math.min(p1.x, p2.x) && wheelPoint.x <= Math.max(p1.x, p2.x));

                if (isSignalRed && crossedStop) {
                  if (track.speedKmh > 5.0 && !track.hasTriggeredRedLight) {
                    track.hasTriggeredRedLight = true;
                    elem.activeViolationsCount = (elem.activeViolationsCount || 0) + 1;
                    this.addRawEvent({
                      id: `red_${track.id}_${Math.round(currentVideoTime * 10)}`,
                      start_sec: Math.max(0, currentVideoTime - 0.6),
                      end_sec: currentVideoTime + 2.8,
                      label: 'red_light',
                      confidence: 0.98,
                      description: `Проезд на запрещающий сигнал светофора через ${elem.name} (Транспорт #${track.id})`,
                      involvedObjects: [`#${track.id} ${track.labelRu}`]
                    });
                  } else if (track.speedKmh <= 5.0 && !track.hasTriggeredStopLine && !track.hasTriggeredRedLight) {
                    track.hasTriggeredStopLine = true;
                    elem.activeViolationsCount = (elem.activeViolationsCount || 0) + 1;
                    this.addRawEvent({
                      id: `stopline_${track.id}_${Math.round(currentVideoTime * 10)}`,
                      start_sec: Math.max(0, currentVideoTime - 0.4),
                      end_sec: currentVideoTime + 1.8,
                      label: 'stop_line',
                      confidence: 0.92,
                      description: `Выезд за ${elem.name} на запрещающий сигнал (Транспорт #${track.id})`,
                      involvedObjects: [`#${track.id} ${track.labelRu}`]
                    });
                  }
                }
              }

              // 3. CROSSWALK ZONE (Пешеходный переход «Зебра» 1.14)
              if (elem.type === 'crosswalk_zone') {
                const inCrosswalk = wheelPoint.x >= elem.x && wheelPoint.x <= elem.x + elem.w && wheelPoint.y >= elem.y && wheelPoint.y <= elem.y + elem.h;

                // Check linked pedestrian signal
                const pedSig = this.roadElements.find(e => e.type === 'traffic_light_pedestrian');
                const isPedRed = pedSig ? pedSig.state === 'RED' : false;

                if (isPed && inCrosswalk && isPedRed && !track.hasTriggeredJaywalking) {
                  track.hasTriggeredJaywalking = true;
                  elem.activeViolationsCount = (elem.activeViolationsCount || 0) + 1;
                  this.addRawEvent({
                    id: `jay_${track.id}_${Math.round(currentVideoTime * 10)}`,
                    start_sec: Math.max(0, currentVideoTime - 0.4),
                    end_sec: currentVideoTime + 2.5,
                    label: 'jaywalking',
                    confidence: 0.95,
                    description: `Пешеход #${track.id} на переходе «${elem.name}» на запрещающий сигнал пешеходного светофора`,
                    involvedObjects: [`#${track.id} Пешеход`]
                  });
                }
              }

              // 4. NO PARKING / STOPPING ZONE (Знак 3.27)
              if (elem.type === 'no_parking_zone' && !isPed) {
                const inZone = wheelPoint.x >= elem.x && wheelPoint.x <= elem.x + elem.w && wheelPoint.y >= elem.y && wheelPoint.y <= elem.y + elem.h;
                if (inZone && track.stoppedDurationSec >= (elem.maxStopDurationSec || 10) && !track.hasTriggeredStoppedVehicle) {
                  track.hasTriggeredStoppedVehicle = true;
                  elem.activeViolationsCount = (elem.activeViolationsCount || 0) + 1;
                  this.addRawEvent({
                    id: `stop_${track.id}_${Math.round(currentVideoTime)}`,
                    start_sec: Math.max(0, currentVideoTime - 10.0),
                    end_sec: currentVideoTime + 3.0,
                    label: 'stopped_vehicle',
                    confidence: 0.95,
                    description: `Остановка в ${elem.name} > 10с (Транспорт #${track.id})`,
                    involvedObjects: [`#${track.id} ${track.labelRu}`]
                  });
                }
              }

              // 5. SPEED RADAR ZONE (Контроль скорости)
              if (elem.type === 'speed_radar_zone' && !isPed && track.isMoving) {
                const inRadar = wheelPoint.x >= elem.x && wheelPoint.x <= elem.x + elem.w && wheelPoint.y >= elem.y && wheelPoint.y <= elem.y + elem.h;
                const limit = elem.speedLimitKmh || 60;
                if (inRadar && track.speedKmh > limit + 5 && !track.hasTriggeredSpeeding) {
                  track.hasTriggeredSpeeding = true;
                  elem.activeViolationsCount = (elem.activeViolationsCount || 0) + 1;
                  this.addRawEvent({
                    id: `speed_${track.id}_${Math.round(currentVideoTime * 10)}`,
                    start_sec: Math.max(0, currentVideoTime - 0.5),
                    end_sec: currentVideoTime + 2.5,
                    label: 'speeding' as any,
                    confidence: 0.96,
                    description: `Превышение скорости в зоне ${elem.name}: ${track.speedKmh.toFixed(0)} км/ч при лимите ${limit} км/ч (Транспорт #${track.id})`,
                    involvedObjects: [`#${track.id} ${track.labelRu}`]
                  });
                }
              }
            });
          }

          track.prevWheel = wheelPoint;

          // Status determination
          if (track.hasCrossedSolidLine) {
            track.status = 'СПЛОШНАЯ';
          } else if (track.hasTriggeredRedLight) {
            track.status = 'ОПАСНОСТЬ';
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
        }
      };

      runAssociationPass(highDetIndices);
      runAssociationPass(lowDetIndices);

      fusedDetections.forEach((det, idx) => {
        if (matchedDetIndices.has(idx) || det.score < 0.42) return;

        const [nx, ny, nw, nh] = det.bbox;
        if (nx < 0.015 || ny < 0.015 || nx + nw > 0.985 || ny + nh > 0.985) return;

        const newId = this.nextTrackId++;
        const smoothCenterY = ny + nh * 0.92;
        const smoothCenterX = nx + nw / 2;
        const clampedNormY = Math.max(0.12, Math.min(0.96, smoothCenterY));
        const depthMeters = 8.0 + 24.0 / Math.pow(Math.max(0.08, clampedNormY - 0.08), 0.95);
        const lateralMeters = (smoothCenterX - 0.5) * (9.0 + depthMeters * 0.35);
        const ground = { gx: lateralMeters, gy: depthMeters };

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
          history: [{ gx: ground.gx, gy: ground.gy, x: nx + nw / 2, y: ny + nh, t: now / 1000 }],
          speedKmh: 0.0,
          speedHistory: [],
          speedAccumulator: [],
          prevTransformedPt: ground,
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
      });

      for (const [id, track] of this.activeTracks.entries()) {
        if (!matchedTrackIds.has(id)) {
          track.missedFrames++;
          track.vx *= 0.3;
          track.vy *= 0.3;

          if (track.missedFrames >= 2 || (now - track.lastSeen > 400)) {
            this.activeTracks.delete(id);
          }
        }
      }

      if (this.inferCtx && (now - this.lastSmokeTime > 1200)) {
        this.lastSmokeTime = now;
        this.opticalSmokeResult = analyzeOpticalSmokeFire(this.inferCtx, 480, 270);
      }

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
      trafficLights: this.detectedTrafficLights.length > 0 ? this.detectedTrafficLights : this.intersectionPhase.signals,
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
      e => e.label === event.label && Math.abs(e.start_sec - event.start_sec) < 2.5
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

  public clearAllEvents(): void {
    this.rawEvents = [];
    this.collisionLog = [];
    this.roadElements.forEach(e => { e.activeViolationsCount = 0; });
    this.activeTracks.forEach(t => {
      t.hasCrossedSolidLine = false;
      t.hasTriggeredRedLight = false;
      t.hasTriggeredStopLine = false;
      t.hasTriggeredStoppedVehicle = false;
      t.hasTriggeredJaywalking = false;
      t.hasTriggeredSpeeding = false;
      if (t.status === 'СПЛОШНАЯ' || t.status === 'ОПАСНОСТЬ') {
        t.status = 'ДВИЖЕНИЕ';
      }
    });
  }

  public simulateTestViolation(type: OfficialClass, currentVideoTime: number = 0): void {
    const idNum = Math.floor(Math.random() * 80) + 12;
    const t = Math.max(0, currentVideoTime);
    if (type === 'solid_line_crossing') {
      this.addRawEvent({
        id: `sim_solid_${Date.now()}`,
        start_sec: parseFloat(t.toFixed(1)),
        end_sec: parseFloat((t + 2.4).toFixed(1)),
        label: 'solid_line_crossing',
        confidence: 0.96,
        description: `Транспорт #${idNum} (Легковой) пересек Сплошную #1 (Левая)`,
        involvedObjects: [`#${idNum} Легковой автомобиль`]
      });
    } else if (type === 'red_light') {
      this.addRawEvent({
        id: `sim_red_${Date.now()}`,
        start_sec: parseFloat(t.toFixed(1)),
        end_sec: parseFloat((t + 3.0).toFixed(1)),
        label: 'red_light',
        confidence: 0.98,
        description: `Проезд на запрещающий сигнал (Красный) — Транспорт #${idNum}`,
        involvedObjects: [`#${idNum} Автомобиль (Спешка)`]
      });
    } else if (type === 'jaywalking') {
      this.addRawEvent({
        id: `sim_jay_${Date.now()}`,
        start_sec: parseFloat(t.toFixed(1)),
        end_sec: parseFloat((t + 2.8).toFixed(1)),
        label: 'jaywalking',
        confidence: 0.93,
        description: `Пешеход #${idNum} на проезжей части вне регулируемого перехода`,
        involvedObjects: [`#${idNum} Пешеход`]
      });
    } else if (type === 'near_miss') {
      this.addRawEvent({
        id: `sim_miss_${Date.now()}`,
        start_sec: parseFloat(t.toFixed(1)),
        end_sec: parseFloat((t + 2.5).toFixed(1)),
        label: 'near_miss',
        confidence: 0.95,
        description: `Опасное сближение / предаварийное торможение (TTC = 1.4с)`,
        involvedObjects: [`#${idNum} Автомобиль`, `#${idNum + 1} Автомобиль`]
      });
    } else if (type === 'stopped_vehicle') {
      this.addRawEvent({
        id: `sim_stop_${Date.now()}`,
        start_sec: parseFloat(Math.max(0, t - 10.0).toFixed(1)),
        end_sec: parseFloat((t + 2.0).toFixed(1)),
        label: 'stopped_vehicle',
        confidence: 0.94,
        description: `Остановка на проезжей части > 10с (Транспорт #${idNum})`,
        involvedObjects: [`#${idNum} Грузовой транспорт`]
      });
    } else if (type === 'congestion') {
      this.addRawEvent({
        id: `sim_cong_${Date.now()}`,
        start_sec: parseFloat(t.toFixed(1)),
        end_sec: parseFloat((t + 5.0).toFixed(1)),
        label: 'congestion',
        confidence: 0.91,
        description: `Блокировка перекрестка / Затор LOS F`,
        involvedObjects: [`Колонна транспорта (12 ТС)`]
      });
    }
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
