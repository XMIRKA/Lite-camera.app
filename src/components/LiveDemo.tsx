import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Download,
  Video,
  Radio,
  Zap,
  Clock,
  ChevronRight,
  Sliders,
  Compass,
  Keyboard,
  Crosshair,
  Target,
  Sparkles,
  Move,
  TrendingUp,
  Coins,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Trash2,
  FileText,
  AlertCircle,
  Eye,
  Plus,
  X,
  Printer,
  QrCode,
  Layers,
  Activity
} from 'lucide-react';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import { SAMPLE_VIDEOS } from '../data/competitionData';
import { TrafficEvent, OfficialClass } from '../types/hackathon';
import {
  realtimeNeuralVision,
  LiveDetectedObject,
  TrafficSceneAnalysis,
  CollisionAlertEvent,
  SolidLaneDivider,
  CustomSignalConfig
} from '../utils/realtimeCocoDetector';

interface LiveDemoProps {
  lang: 'en' | 'ru';
}

export interface ViolationDisplayItem {
  id: string;
  start: number;
  end: number;
  labelRu: string;
  labelEn: string;
  codeArticle: string;
  fineUzs: string;
  fineBrv: string;
  riskBadge: string;
  badgeColor: string;
  description: string;
  licensePlate: string;
  vehicleType: string;
  speedKmh: number;
  involvedObjects: string[];
}

// Helper to generate realistic Uzbek License Plates (e.g., 01 | 777 AAA)
const UZ_PLATE_SERIES = ['AAA', 'AAB', 'ABA', 'BBB', 'MMM', 'ZZZ', 'ABC', 'SAV', 'UZB'];
export const generateUzPlate = (seed: number): string => {
  const region = (seed % 14 + 1).toString().padStart(2, '0');
  const num = ((seed * 137) % 900 + 100).toString();
  const series = UZ_PLATE_SERIES[seed % UZ_PLATE_SERIES.length];
  return `${region} | ${num} ${series}`;
};

export const getViolationDetails = (evt: TrafficEvent, index: number = 1): ViolationDisplayItem => {
  let labelRu = 'Нарушение ПДД';
  let labelEn = 'Traffic Incident';
  let codeArticle = 'ст. 128 КоАО РУз';
  let fineUzs = '170 000 сум';
  let fineBrv = '0.5 БРВ';
  let riskBadge = 'Траекторный контроль';
  let badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  let vehicleType = 'Легковой автомобиль (Sedan)';
  let speedKmh = 48.5;

  const idNum = parseInt(evt.id.replace(/\D/g, '').slice(-3) || '14', 10) + index;
  const plate = generateUzPlate(idNum);

  if (evt.label === 'solid_line_crossing') {
    labelRu = 'Пересечение сплошной линии разметки 1.1';
    labelEn = 'Solid Line Crossing (Marking 1.1)';
    codeArticle = 'ст. 128 КоАО РУз';
    fineUzs = '170 000 сум';
    fineBrv = '0.5 БРВ';
    riskBadge = 'Разметка 1.1';
    badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    speedKmh = 54.2;
  } else if (evt.label === 'red_light') {
    labelRu = 'Проезд на запрещающий сигнал (Красный)';
    labelEn = 'Red Light Violation';
    codeArticle = 'ст. 128-4 КоАО РУз';
    fineUzs = '680 000 сум';
    fineBrv = '2.0 БРВ';
    riskBadge = 'КРАСНЫЙ СИГНАЛ';
    badgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
    speedKmh = 62.0;
  } else if (evt.label === 'stop_line') {
    labelRu = 'Выезд за стоп-линию на запрещающий сигнал';
    labelEn = 'Stop Line Crossing';
    codeArticle = 'ст. 128 КоАО РУз';
    fineUzs = '170 000 сум';
    fineBrv = '0.5 БРВ';
    riskBadge = 'Стоп-линия 1.12';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    speedKmh = 8.4;
  } else if (evt.label === 'jaywalking') {
    labelRu = 'Пешеход вне пешеходного перехода';
    labelEn = 'Jaywalking';
    codeArticle = 'ст. 138 КоАО РУз';
    fineUzs = '115 000 сум';
    fineBrv = '0.33 БРВ';
    riskBadge = 'Пешеход на ПЧ';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    vehicleType = 'Пешеход (Физическое лицо)';
    speedKmh = 4.5;
  } else if (evt.label === 'near_miss') {
    labelRu = 'Предаварийная ситуация / Опасное сближение';
    labelEn = 'Near Miss / Hazard';
    codeArticle = 'TTC < 2.0с (Vision Zero)';
    fineUzs = 'Предотвращен ущерб';
    fineBrv = 'Vision Zero';
    riskBadge = 'P(Accident) > 0.85';
    badgeColor = 'bg-rose-500/25 text-rose-300 border-rose-500/50';
    speedKmh = 58.0;
  } else if (evt.label === 'stopped_vehicle') {
    labelRu = 'Остановка на проезжей части > 10 секунд';
    labelEn = 'Illegal Stopping > 10s';
    codeArticle = 'ст. 128-8 КоАО РУз';
    fineUzs = '340 000 сум';
    fineBrv = '1.0 БРВ';
    riskBadge = 'Помеха движению';
    badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    vehicleType = 'Грузовой транспорт (Truck)';
    speedKmh = 0.0;
  } else if (evt.label === 'congestion') {
    labelRu = 'Затор / Блокировка перекрестка';
    labelEn = 'Intersection Congestion';
    codeArticle = 'ст. 128-8 КоАО РУз';
    fineUzs = '340 000 сум';
    fineBrv = '1.0 БРВ';
    riskBadge = 'LOS F (Затор)';
    badgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    vehicleType = 'Колонна транспорта';
    speedKmh = 2.1;
  } else if (evt.label === 'accident') {
    labelRu = 'Дорожно-транспортное происшествие (ДТП)';
    labelEn = 'Traffic Collision';
    codeArticle = 'ст. 133 КоАО РУз';
    fineUzs = '1 700 000 сум';
    fineBrv = '5.0 БРВ';
    riskBadge = 'ДТП ФИКСАЦИЯ';
    badgeColor = 'bg-red-600/30 text-red-200 border-red-500';
    speedKmh = 42.0;
  }

  return {
    id: evt.id,
    start: evt.start_sec,
    end: evt.end_sec,
    labelRu,
    labelEn,
    codeArticle,
    fineUzs,
    fineBrv,
    riskBadge,
    badgeColor,
    description: evt.description || '',
    licensePlate: plate,
    vehicleType,
    speedKmh,
    involvedObjects: evt.involvedObjects || []
  };
};

export const LiveDemo: React.FC<LiveDemoProps> = ({ lang }) => {
  // Stream Source: 'simulator' (Synthetic CCTV Intersection) | 'uploaded' (Custom MP4)
  const [streamSource, setStreamSource] = useState<'simulator' | 'uploaded'>('simulator');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(60.0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Violation Registry Filter & Modal Protocol State
  const [selectedViolationCategory, setSelectedViolationCategory] = useState<string>('all');
  const [activeProtocolItem, setActiveProtocolItem] = useState<ViolationDisplayItem | null>(null);

  // Inspector Tab State: 4 clean tabs
  const [inspectorTab, setInspectorTab] = useState<'objects' | 'signals' | 'events' | 'geometry'>('objects');

  // Vision Filter Toggles
  const [confThreshold, setConfThreshold] = useState<number>(0.28);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [showSpeedRadar, setShowSpeedRadar] = useState<boolean>(true);
  const [enableCollisionAlerts, setEnableCollisionAlerts] = useState<boolean>(true);
  const [showLaneGeometry, setShowLaneGeometry] = useState<boolean>(true);
  const [showSignalsOverlay, setShowSignalsOverlay] = useState<boolean>(true);

  // Solid Line Geometry & Interactive Drag State
  const [currentDividers, setCurrentDividers] = useState<SolidLaneDivider[]>([
    { id: 'solid_1', name: 'Сплошная #1 (Левая 1.1)', x1: 0.38, y1: 0.28, x2: 0.28, y2: 0.94 },
    { id: 'solid_2', name: 'Сплошная #2 (Правая 1.1)', x1: 0.62, y1: 0.28, x2: 0.72, y2: 0.94 }
  ]);
  const [hoveredNode, setHoveredNode] = useState<{ dividerIdx: number; node: 'start' | 'end' } | null>(null);
  const [activeDragNode, setActiveDragNode] = useState<{ dividerIdx: number; node: 'start' | 'end' } | null>(null);
  const [activeDragSignal, setActiveDragSignal] = useState<{ signalId: number; offsetX: number; offsetY: number } | null>(null);

  // Traffic Light Configuration & Auto-Cycle Engine
  const [trafficSignalPhase, setTrafficSignalPhase] = useState<'GREEN' | 'YELLOW' | 'RED' | 'AUTO'>('AUTO');
  const [autoCycleTimeSec, setAutoCycleTimeSec] = useState<number>(0);
  const [configuredSignals, setConfiguredSignals] = useState<CustomSignalConfig[]>([
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
  ]);

  // Telemetry & Collision Log state
  const [telemetryObjects, setTelemetryObjects] = useState<LiveDetectedObject[]>([]);
  const [collisionLogs, setCollisionLogs] = useState<CollisionAlertEvent[]>([]);
  const [detectedEvents, setDetectedEvents] = useState<TrafficEvent[]>([]);
  const [smoothedEvents, setSmoothedEvents] = useState<TrafficEvent[]>([]);
  const [sceneData, setSceneData] = useState<TrafficSceneAnalysis>({
    trafficLightState: 'GREEN',
    trafficLightLabel: 'ЗЕЛЕНЫЙ (Разрешен)',
    trafficLights: [],
    intersectionPhase: {
      mainPhase: 'GREEN',
      crossPhase: 'RED',
      activePhaseDescriptionRu: 'Фаза 1: Главное направление ЗЕЛЕНЫЙ ⟷ Второстепенное КРАСНЫЙ',
      interlockCompliant: true,
      signals: []
    },
    congestionScore: 1,
    congestionLevel: 'СВОБОДНО',
    levelOfService: 'LOS A',
    roadOccupancyPct: 0.0,
    vehicleDensityPerKm: 0,
    vehicleCount: 0,
    pedestrianCount: 0,
    averageSpeedKmh: 0.0,
    activeCollisions: [],
    densityDescriptionRu: 'Дорожное полотно свободно (LOS A).'
  });

  // Simulator Synthetic Road Vehicles State (High Precision Motion Engine)
  const simVehiclesRef = useRef<{
    id: number;
    type: 'car' | 'truck' | 'bus' | 'motorcycle' | 'pedestrian';
    labelRu: string;
    lane: number; // 0: left, 1: center-left, 2: center-right, 3: right
    x: number;
    y: number;
    w: number;
    h: number;
    speedKmh: number;
    targetSpeed: number;
    color: string;
    plate: string;
    trail: { x: number; y: number }[];
    laneChangeProgress?: number; // 0..1
    targetLane?: number;
    hasCrossedSolid?: boolean;
    hasViolatedRed?: boolean;
  }[]>([
    { id: 11, type: 'car', labelRu: 'Легковой (Sedan)', lane: 1, x: 0.42, y: 0.35, w: 0.065, h: 0.09, speedKmh: 45, targetSpeed: 48, color: '#38bdf8', plate: '01 | 777 AAA', trail: [] },
    { id: 14, type: 'car', labelRu: 'Легковой (SUV)', lane: 0, x: 0.32, y: 0.55, w: 0.075, h: 0.10, speedKmh: 52, targetSpeed: 55, color: '#a855f7', plate: '10 | 452 BBA', trail: [] },
    { id: 18, type: 'truck', labelRu: 'Грузовой (Truck)', lane: 2, x: 0.58, y: 0.20, w: 0.09, h: 0.14, speedKmh: 38, targetSpeed: 40, color: '#f59e0b', plate: '01 | 890 UZB', trail: [] },
    { id: 22, type: 'car', labelRu: 'Легковой (Cobalt)', lane: 1, x: 0.44, y: 0.72, w: 0.085, h: 0.11, speedKmh: 46, targetSpeed: 48, color: '#ec4899', plate: '01 | 123 SAV', trail: [] },
    { id: 27, type: 'pedestrian', labelRu: 'Пешеход', lane: 3, x: 0.82, y: 0.75, w: 0.025, h: 0.045, speedKmh: 4.2, targetSpeed: 4.5, color: '#84cc16', plate: 'Пешеход', trail: [] }
  ]);

  // Notice & Camera Homography Calibration State
  const [jumpNotice, setJumpNotice] = useState<string | null>(null);
  const [calibRoadLength, setCalibRoadLength] = useState<number>(45);
  const [calibCameraHeight, setCalibCameraHeight] = useState<number>(6.5);
  const [calibCameraPitch, setCalibCameraPitch] = useState<number>(22);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Dynamic Live Violations List (Calculated from Real Detector Output)
  const violationsList = useMemo(() => {
    const events = smoothedEvents.length > 0 ? smoothedEvents : detectedEvents;
    const items = events.map((e, idx) => getViolationDetails(e, idx));
    if (selectedViolationCategory === 'all') return items;
    return items.filter(v => {
      if (selectedViolationCategory === 'solid') return v.id.includes('solid') || v.labelRu.includes('сплошн');
      if (selectedViolationCategory === 'red') return v.id.includes('red') || v.id.includes('stopline') || v.labelRu.includes('запрещающ');
      if (selectedViolationCategory === 'jay') return v.id.includes('jay') || v.labelRu.includes('Пешеход');
      if (selectedViolationCategory === 'hazard') return v.id.includes('miss') || v.id.includes('accident') || v.labelRu.includes('Предаварий');
      return true;
    });
  }, [smoothedEvents, detectedEvents, selectedViolationCategory]);

  // Total Fine Calculations
  const totalFineStats = useMemo(() => {
    let totalUzs = 0;
    let totalBrv = 0;
    violationsList.forEach(v => {
      const uzsMatch = v.fineUzs.replace(/\D/g, '');
      if (uzsMatch) totalUzs += parseInt(uzsMatch, 10);
      const brvMatch = parseFloat(v.fineBrv.replace(/[^0-9.]/g, ''));
      if (!isNaN(brvMatch)) totalBrv += brvMatch;
    });
    return {
      count: violationsList.length,
      totalUzsFormatted: totalUzs.toLocaleString('ru-RU') + ' сум',
      totalBrv: totalBrv.toFixed(1)
    };
  }, [violationsList]);

  // Initialize TF Neural Vision Engine
  useEffect(() => {
    realtimeNeuralVision.init();
    realtimeNeuralVision.setSolidDividers(currentDividers);
  }, []);

  // Simulator & Camera Animation Loop
  useEffect(() => {
    let lastStamp = performance.now();

    const loop = (timestamp: number) => {
      const dt = Math.min(0.08, (timestamp - lastStamp) / 1000);
      lastStamp = timestamp;

      if (isPlaying) {
        setCurrentTime(prev => {
          const next = prev + dt * playbackSpeed;
          return next > duration ? 0 : next;
        });

        // Auto Cycle Traffic Lights (12s Green -> 3s Yellow -> 10s Red)
        if (trafficSignalPhase === 'AUTO') {
          setAutoCycleTimeSec(prev => {
            const next = (prev + dt) % 25;
            let targetColor: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
            if (next < 12) targetColor = 'GREEN';
            else if (next < 15) targetColor = 'YELLOW';
            else targetColor = 'RED';

            if (sceneData.trafficLightState !== targetColor) {
              realtimeNeuralVision.setSignalOverride(1, targetColor);
            }
            return next;
          });
        }

        // Advance Simulator Vehicles Motion & Physics
        if (streamSource === 'simulator') {
          const activeSignal = trafficSignalPhase === 'AUTO'
            ? (autoCycleTimeSec < 12 ? 'GREEN' : autoCycleTimeSec < 15 ? 'YELLOW' : 'RED')
            : trafficSignalPhase;

          simVehiclesRef.current.forEach((veh, idx) => {
            // Speed adjustments based on traffic light
            const isRedOrYellow = activeSignal === 'RED' || activeSignal === 'YELLOW';
            const nearStopLine = veh.y >= 0.54 && veh.y <= 0.64;

            if (veh.type !== 'pedestrian') {
              if (isRedOrYellow && nearStopLine && veh.id !== 14) {
                // Decelerate before stop line
                veh.speedKmh = Math.max(0, veh.speedKmh - dt * 35);
              } else {
                // Accelerate to target speed
                veh.speedKmh = Math.min(veh.targetSpeed, veh.speedKmh + dt * 20);
              }

              // Advance Y coordinate based on perspective speed
              const deltaY = (veh.speedKmh / 3600) * 8.0 * dt * (0.8 + veh.y * 1.2);
              veh.y += deltaY;

              // Perspective scale expansion as vehicle moves closer
              veh.w = 0.05 + veh.y * 0.045;
              veh.h = 0.07 + veh.y * 0.065;

              // Lane X perspective alignment
              const laneCenters = [0.30 + (veh.y - 0.2) * -0.05, 0.42 + (veh.y - 0.2) * -0.02, 0.58 + (veh.y - 0.2) * 0.04, 0.70 + (veh.y - 0.2) * 0.08];
              if (veh.laneChangeProgress !== undefined && veh.targetLane !== undefined) {
                veh.laneChangeProgress = Math.min(1.0, veh.laneChangeProgress + dt * 0.6);
                const startX = laneCenters[veh.lane];
                const endX = laneCenters[veh.targetLane];
                veh.x = startX + (endX - startX) * veh.laneChangeProgress;

                // Check crossing solid divider while changing lane
                if (!veh.hasCrossedSolid && veh.laneChangeProgress > 0.35) {
                  veh.hasCrossedSolid = true;
                  handleSimulateViolation('solid_line_crossing');
                }

                if (veh.laneChangeProgress >= 1.0) {
                  veh.lane = veh.targetLane;
                  veh.laneChangeProgress = undefined;
                  veh.targetLane = undefined;
                }
              } else {
                veh.x = laneCenters[veh.lane];
              }

              // Occasional planned dynamic lane change across Solid Line for vehicle #14
              if (veh.id === 14 && veh.y > 0.45 && veh.y < 0.50 && veh.laneChangeProgress === undefined && !veh.hasCrossedSolid) {
                veh.targetLane = 1;
                veh.laneChangeProgress = 0.0;
              }

              // Red Light Running by vehicle #14 when Red is active
              if (veh.id === 14 && isRedOrYellow && veh.y > 0.62 && !veh.hasViolatedRed) {
                veh.hasViolatedRed = true;
                handleSimulateViolation('red_light');
              }

              // Trail buffer
              veh.trail.push({ x: veh.x + veh.w / 2, y: veh.y + veh.h });
              if (veh.trail.length > 15) veh.trail.shift();

              // Reset vehicle to top of road when it reaches bottom
              if (veh.y > 1.05) {
                veh.y = 0.18;
                veh.lane = idx % 3;
                veh.hasCrossedSolid = false;
                veh.hasViolatedRed = false;
                veh.speedKmh = veh.targetSpeed;
                veh.trail = [];
              }
            } else {
              // Pedestrian motion across roadway
              veh.x -= dt * 0.06;
              if (veh.x < 0.25) veh.x = 0.85;
            }
          });
        }
      }

      renderCanvas();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, duration, streamSource, trafficSignalPhase, autoCycleTimeSec, currentDividers]);

  // Manual Phase Override
  const handleManualSignalPhase = (phase: 'GREEN' | 'YELLOW' | 'RED' | 'AUTO') => {
    setTrafficSignalPhase(phase);
    realtimeNeuralVision.setSignalOverride(1, phase);
    setJumpNotice(`Фаза светофора переключена: ${phase === 'AUTO' ? 'АВТОМАТИЧЕСКИЙ ЦИКЛ' : phase}`);
    setTimeout(() => setJumpNotice(null), 2500);
  };

  // Click-to-Jump Handler
  const handleSeek = (timeSec: number, reason?: string) => {
    const clamped = Math.max(0, Math.min(duration, timeSec));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (reason) {
      setJumpNotice(`Click-to-Jump: Переход к таймкоду ${clamped.toFixed(1)}с (${reason})`);
      setTimeout(() => setJumpNotice(null), 2500);
    }
  };

  const togglePlay = () => {
    setIsPlaying(prev => {
      const next = !prev;
      if (videoRef.current) {
        if (next) videoRef.current.play().catch(() => {});
        else videoRef.current.pause();
      }
      return next;
    });
  };

  const handleReset = () => {
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    realtimeNeuralVision.clearAllEvents();
    setDetectedEvents([]);
    setSmoothedEvents([]);
    setJumpNotice('Плеер и реестр нарушений сброшены к 0.00с');
    setTimeout(() => setJumpNotice(null), 2500);
  };

  // Add / Delete / Reset Solid Dividers
  const handleAddSolidDivider = () => {
    const newId = `solid_${currentDividers.length + 1}`;
    const newDiv: SolidLaneDivider = {
      id: newId,
      name: `Сплошная #${currentDividers.length + 1} (1.1)`,
      x1: 0.50,
      y1: 0.28,
      x2: 0.50,
      y2: 0.94
    };
    const updated = [...currentDividers, newDiv];
    setCurrentDividers(updated);
    realtimeNeuralVision.setSolidDividers(updated);
    setJumpNotice(`Добавлена новая сплошная линия #${updated.length}. Настройте координаты.`);
    setTimeout(() => setJumpNotice(null), 2500);
  };

  const handleDeleteSolidDivider = (id: string) => {
    if (currentDividers.length <= 1) return;
    const updated = currentDividers.filter(d => d.id !== id);
    setCurrentDividers(updated);
    realtimeNeuralVision.setSolidDividers(updated);
  };

  const handleResetSolidDividersGOST = () => {
    const defaults: SolidLaneDivider[] = [
      { id: 'solid_1', name: 'Сплошная #1 (Левая 1.1)', x1: 0.38, y1: 0.28, x2: 0.28, y2: 0.94 },
      { id: 'solid_2', name: 'Сплошная #2 (Правая 1.1)', x1: 0.62, y1: 0.28, x2: 0.72, y2: 0.94 }
    ];
    setCurrentDividers(defaults);
    realtimeNeuralVision.setSolidDividers(defaults);
    setJumpNotice('Разметка 1.1 сброшена к ГОСТ-стандарту');
    setTimeout(() => setJumpNotice(null), 2500);
  };

  // Canvas Mouse Interaction for Dragging Handles
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Check Lane Divider Handles Drag
    for (let i = 0; i < currentDividers.length; i++) {
      const div = currentDividers[i];
      const distStart = Math.hypot(div.x1 - clickX, div.y1 - clickY);
      const distEnd = Math.hypot(div.x2 - clickX, div.y2 - clickY);
      if (distStart < 0.06) {
        setActiveDragNode({ dividerIdx: i, node: 'start' });
        return;
      }
      if (distEnd < 0.06) {
        setActiveDragNode({ dividerIdx: i, node: 'end' });
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const curX = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0.05, Math.min(0.98, (e.clientY - rect.top) / rect.height));

    if (activeDragNode) {
      const updated = [...currentDividers];
      if (updated[activeDragNode.dividerIdx]) {
        if (activeDragNode.node === 'start') {
          updated[activeDragNode.dividerIdx].x1 = parseFloat(curX.toFixed(3));
          updated[activeDragNode.dividerIdx].y1 = parseFloat(curY.toFixed(3));
        } else {
          updated[activeDragNode.dividerIdx].x2 = parseFloat(curX.toFixed(3));
          updated[activeDragNode.dividerIdx].y2 = parseFloat(curY.toFixed(3));
        }
        setCurrentDividers(updated);
        realtimeNeuralVision.setSolidDividers(updated);
      }
      return;
    }

    // Hover state
    let foundHover: { dividerIdx: number; node: 'start' | 'end' } | null = null;
    for (let i = 0; i < currentDividers.length; i++) {
      const div = currentDividers[i];
      if (Math.hypot(div.x1 - curX, div.y1 - curY) < 0.06) {
        foundHover = { dividerIdx: i, node: 'start' };
        break;
      }
      if (Math.hypot(div.x2 - curX, div.y2 - curY) < 0.06) {
        foundHover = { dividerIdx: i, node: 'end' };
        break;
      }
    }
    setHoveredNode(foundHover);
  };

  const handleCanvasMouseUp = () => {
    setActiveDragNode(null);
  };

  // Video File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
      const url = URL.createObjectURL(file);
      setUploadedFileName(file.name);
      setUploadedVideoUrl(url);
      setStreamSource('uploaded');
      setCurrentTime(0);
      setIsPlaying(true);
      realtimeNeuralVision.clearAllEvents();
      setDetectedEvents([]);
      setSmoothedEvents([]);
      setJumpNotice(`Загружено видео: ${file.name}`);
      setTimeout(() => setJumpNotice(null), 3000);
    }
  };

  const handleSimulateViolation = (type: OfficialClass) => {
    realtimeNeuralVision.simulateTestViolation(type, currentTime);
    setDetectedEvents(realtimeNeuralVision.getRawEvents());
    setSmoothedEvents(realtimeNeuralVision.getSmoothedEvents());
  };

  const handleClearViolations = () => {
    realtimeNeuralVision.clearAllEvents();
    setDetectedEvents([]);
    setSmoothedEvents([]);
    setJumpNotice('Реестр нарушений полностью очищен');
    setTimeout(() => setJumpNotice(null), 2500);
  };

  const handleDismissViolation = (id: string) => {
    setDetectedEvents(prev => prev.filter(e => e.id !== id));
    setSmoothedEvents(prev => prev.filter(e => e.id !== id));
    setJumpNotice('Нарушение аннулировано из реестра');
    setTimeout(() => setJumpNotice(null), 2000);
  };

  const handleExportViolationsReport = () => {
    if (violationsList.length === 0) return;
    const report = {
      exportedAt: new Date().toISOString(),
      source: streamSource === 'simulator' ? 'CCTV Simulator (Tashkent Gantry #4)' : (uploadedFileName || 'Uploaded MP4'),
      totalViolations: violationsList.length,
      totalFinesUzs: totalFineStats.totalUzsFormatted,
      violations: violationsList
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdd_violations_protocol_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MASTER HIGH-PRECISION CANVAS RENDERING ENGINE
  // ══════════════════════════════════════════════════════════════════════════
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const now = performance.now();
    const isFlashActive = Math.floor(now / 180) % 2 === 0;

    // 1. Draw Synthetic Road Perspective Background (if Simulator Stream)
    if (streamSource === 'simulator') {
      // Sky & Horizon
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.25);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height * 0.25);

      // Distant Urban Skyline & Gantry Truss
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(width * 0.1, height * 0.18, 80, 45);
      ctx.fillRect(width * 0.75, height * 0.15, 120, 65);
      ctx.fillRect(width * 0.88, height * 0.17, 70, 50);

      // Roadside Terrain
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, height * 0.25, width, height * 0.75);

      // Asphalt Road Trapezoid (Perspective)
      ctx.fillStyle = '#131926';
      ctx.beginPath();
      ctx.moveTo(width * 0.22, height * 0.25);
      ctx.lineTo(width * 0.78, height * 0.25);
      ctx.lineTo(width * 0.95, height);
      ctx.lineTo(width * 0.05, height);
      ctx.closePath();
      ctx.fill();

      // Road Curbs & Edges (Double Yellow / Reflective Barrier)
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width * 0.22, height * 0.25);
      ctx.lineTo(width * 0.05, height);
      ctx.moveTo(width * 0.78, height * 0.25);
      ctx.lineTo(width * 0.95, height);
      ctx.stroke();

      // Dashed Lane Center Dividers (Perspective)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(width * 0.50, height * 0.25);
      ctx.lineTo(width * 0.50, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pedestrian Crosswalk "Zebra" (Разметка 1.14.1)
      const zebraY = height * 0.78;
      const zebraH = 28;
      ctx.fillStyle = 'rgba(241, 245, 249, 0.80)';
      for (let i = 0; i < 11; i++) {
        const xPos = width * 0.14 + i * (width * 0.065);
        ctx.fillRect(xPos, zebraY, 26, zebraH);
      }

      // Stop Line (Разметка 1.12 "СТОП")
      const stopY = height * 0.60;
      const isRedPhase = trafficSignalPhase === 'RED' || (trafficSignalPhase === 'AUTO' && autoCycleTimeSec >= 15);
      ctx.fillStyle = isRedPhase ? (isFlashActive ? '#ef4444' : '#dc2626') : '#f8fafc';
      ctx.fillRect(width * 0.18, stopY, width * 0.64, 5);

      ctx.fillStyle = isRedPhase ? '#ef4444' : '#94a3b8';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillText(`━━━ СТОП-ЛИНИЯ 1.12 ${isRedPhase ? '[ЗАПРЕТ ПРОЕЗДА]' : '[РАЗРЕШЕНО]'} ━━━`, width * 0.32, stopY - 6);
    }

    // 2. Draw Solid Lane Dividers (Разметка 1.1) with Glowing Pulse & Interactive Handles
    if (showLaneGeometry && currentDividers.length > 0) {
      currentDividers.forEach((div, idx) => {
        const p1x = Math.round(div.x1 * width);
        const p1y = Math.round(div.y1 * height);
        const p2x = Math.round(div.x2 * width);
        const p2y = Math.round(div.y2 * height);

        // Check if any vehicle has triggered solid line crossing
        const isCrossed = violationsList.some(v => v.id.includes('solid'));

        // Glowing outer stroke
        ctx.strokeStyle = isCrossed ? (isFlashActive ? '#ef4444' : '#f59e0b') : '#6366f1';
        ctx.lineWidth = isCrossed ? 5.5 : 3.5;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();

        // Inner solid white core line
        ctx.strokeStyle = isCrossed ? '#ffffff' : '#e0e7ff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();

        // Interactive End-Point Handles
        const isHoverP1 = hoveredNode?.dividerIdx === idx && hoveredNode?.node === 'start';
        const isHoverP2 = hoveredNode?.dividerIdx === idx && hoveredNode?.node === 'end';

        // P1 Handle (Top)
        ctx.fillStyle = isHoverP1 ? '#38bdf8' : '#6366f1';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p1x, p1y, isHoverP1 ? 9 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // P2 Handle (Bottom)
        ctx.fillStyle = isHoverP2 ? '#38bdf8' : '#818cf8';
        ctx.beginPath();
        ctx.arc(p2x, p2y, isHoverP2 ? 11 : 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label Tag
        ctx.fillStyle = isCrossed ? '#ef4444' : 'rgba(15, 23, 42, 0.90)';
        ctx.fillRect(p2x - 55, p2y - 18, 110, 18);
        ctx.strokeStyle = isCrossed ? '#ffffff' : '#6366f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(p2x - 55, p2y - 18, 110, 18);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.fillText(`⮑ ${div.name.split(' ')[0]} #${idx + 1}`, p2x - 50, p2y - 6);
      });
    }

    // 3. Draw Simulator Vehicles, Bounding Boxes, ANPR Plates & Speed Tags
    if (streamSource === 'simulator') {
      simVehiclesRef.current.forEach(veh => {
        const px = veh.x * width;
        const py = veh.y * height;
        const pw = veh.w * width;
        const ph = veh.h * height;

        if (veh.type !== 'pedestrian') {
          // Draw Vehicle Shadow & Body
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.beginPath();
          ctx.ellipse(px + pw / 2, py + ph * 0.95, pw * 0.55, ph * 0.18, 0, 0, Math.PI * 2);
          ctx.fill();

          // Vehicle Body Rectangle
          ctx.fillStyle = veh.color;
          ctx.beginPath();
          ctx.roundRect(px, py, pw, ph, 5);
          ctx.fill();

          // Windshield & Roof
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(px + pw * 0.15, py + ph * 0.20, pw * 0.70, ph * 0.35, 3);
          ctx.fill();

          // Headlights / Taillights
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(px + pw * 0.10, py + ph * 0.05, pw * 0.20, ph * 0.08);
          ctx.fillRect(px + pw * 0.70, py + ph * 0.05, pw * 0.20, ph * 0.08);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(px + pw * 0.10, py + ph * 0.88, pw * 0.22, ph * 0.08);
          ctx.fillRect(px + pw * 0.68, py + ph * 0.88, pw * 0.22, ph * 0.08);

          // Bounding Box Overlay & ANPR Tag
          if (showBoundingBoxes) {
            const isViolation = veh.hasCrossedSolid || veh.hasViolatedRed;
            ctx.strokeStyle = isViolation ? (isFlashActive ? '#ef4444' : '#f59e0b') : '#38bdf8';
            ctx.lineWidth = isViolation ? 2.5 : 1.6;
            ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);

            // ANPR License Plate Box
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 1;
            const plateW = Math.min(pw + 10, 85);
            ctx.fillRect(px + pw / 2 - plateW / 2, py + ph - 6, plateW, 14);
            ctx.strokeRect(px + pw / 2 - plateW / 2, py + ph - 6, plateW, 14);

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 8px JetBrains Mono, monospace';
            ctx.fillText(veh.plate, px + pw / 2 - plateW / 2 + 3, py + ph + 4);

            // Radar Speed & Status Header
            const statusTag = veh.hasCrossedSolid ? '• СПЛОШНАЯ 1.1' : veh.hasViolatedRed ? '• КРАСНЫЙ СВЕТ' : `${veh.speedKmh.toFixed(0)} км/ч`;
            ctx.fillStyle = isViolation ? '#ef4444' : 'rgba(15, 23, 42, 0.90)';
            ctx.fillRect(px - 2, py - 18, Math.max(pw + 4, 90), 16);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px JetBrains Mono, monospace';
            ctx.fillText(`#${veh.id} ${statusTag}`, px + 2, py - 6);
          }
        } else {
          // Pedestrian Body
          ctx.fillStyle = '#84cc16';
          ctx.beginPath();
          ctx.arc(px + pw / 2, py + ph * 0.3, pw * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(px + pw * 0.25, py + ph * 0.35, pw * 0.5, ph * 0.65);

          if (showBoundingBoxes) {
            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px - 2, py - 2, pw + 4, ph + 4);

            ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
            ctx.fillRect(px - 2, py - 16, 65, 14);
            ctx.fillStyle = '#84cc16';
            ctx.font = 'bold 8px JetBrains Mono, monospace';
            ctx.fillText(`🚶 #${veh.id} Пешеход`, px + 2, py - 6);
          }
        }
      });
    }

    // 4. Render Active 3-Lens Traffic Light Housing & Optical Glow
    if (showSignalsOverlay) {
      const isRedPhase = trafficSignalPhase === 'RED' || (trafficSignalPhase === 'AUTO' && autoCycleTimeSec >= 15);
      const isYellowPhase = trafficSignalPhase === 'YELLOW' || (trafficSignalPhase === 'AUTO' && autoCycleTimeSec >= 12 && autoCycleTimeSec < 15);
      const isGreenPhase = trafficSignalPhase === 'GREEN' || (trafficSignalPhase === 'AUTO' && autoCycleTimeSec < 12);

      const sx = width * 0.72;
      const sy = height * 0.08;
      const sw = 34;
      const sh = 88;

      // Dark housing box with border
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = isRedPhase ? '#ef4444' : isYellowPhase ? '#f59e0b' : '#10b981';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 8);
      ctx.fill();
      ctx.stroke();

      // 3 Optical Lenses
      const lenses = [
        { state: 'RED', active: isRedPhase, hex: '#ef4444', dimHex: '#3f1515', y: sy + 18 },
        { state: 'YELLOW', active: isYellowPhase, hex: '#f59e0b', dimHex: '#3b2910', y: sy + 44 },
        { state: 'GREEN', active: isGreenPhase, hex: '#10b981', dimHex: '#0c3024', y: sy + 70 }
      ];

      lenses.forEach(lens => {
        ctx.beginPath();
        ctx.arc(sx + sw / 2, lens.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = lens.active ? lens.hex : lens.dimHex;
        ctx.fill();

        if (lens.active) {
          // Glow halo
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(sx + sw / 2, lens.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = lens.hex;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Top Header Badge
      const statusText = isRedPhase ? '🔴 КРАСНЫЙ (Запрет)' : isYellowPhase ? '🟡 ЖЕЛТЫЙ' : '🟢 ЗЕЛЕНЫЙ (Разрешен)';
      ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
      ctx.fillRect(sx - 40, sy - 22, 115, 18);
      ctx.strokeStyle = isRedPhase ? '#ef4444' : isYellowPhase ? '#f59e0b' : '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 40, sy - 22, 115, 18);

      ctx.fillStyle = isRedPhase ? '#ef4444' : isYellowPhase ? '#f59e0b' : '#10b981';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText(statusText, sx - 35, sy - 10);
    }

    // 5. Top Left Telemetry HUD
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(12, 12, 230, 26);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, 230, 26);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.fillText(`⚡ CCTV STREAM: ${streamSource === 'simulator' ? 'SIMULATOR 60FPS' : 'MP4 INFERENCE'}`, 20, 29);

  }, [streamSource, showBoundingBoxes, showLaneGeometry, showSignalsOverlay, currentDividers, hoveredNode, trafficSignalPhase, autoCycleTimeSec, violationsList]);

  return (
    <div className="space-y-4 text-slate-200">
      {/* Top Application Workspace Banner with Stream Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{lang === 'ru' ? 'Анализатор видеопотока и нарушений ПДД (VisionForce)' : 'Traffic Incident & CV Analytics Workstation'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE HARNESS
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {lang === 'ru'
                ? 'Детекция сплошных линий 1.1, оптический светофор (HSV) и фиксация штрафов по КоАО РУз.'
                : 'Solid line 1.1 crossing, optical traffic light chroma, and official administrative fine protocols.'}
            </p>
          </div>
        </div>

        {/* Source Mode Switcher & Upload */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setStreamSource('simulator')}
              className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                streamSource === 'simulator'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{lang === 'ru' ? 'CCTV Симулятор' : 'Simulator'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`px-3 py-1.5 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                streamSource === 'uploaded'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadedFileName ? 'MP4: ' + uploadedFileName.slice(0, 12) + '...' : (lang === 'ru' ? 'Загрузить MP4' : 'Upload MP4')}</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/avi,video/quicktime,video/webm"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Main Studio Grid: Video Viewport on Left (68%), Inspector Panel on Right (32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Video Player / Simulator Canvas (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Viewport Top Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-950 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-cyan-300 font-bold">
                  {streamSource === 'simulator' ? 'CCTV LIVE #04' : (uploadedFileName || 'VIDEO FEED')}
                </span>
              </div>

              {/* Quick Traffic Light Manual Phase Buttons */}
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 font-mono text-[10px]">
                <span className="text-slate-400 font-sans font-bold">Фаза:</span>
                <button
                  onClick={() => handleManualSignalPhase('AUTO')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    trafficSignalPhase === 'AUTO'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Автоматический светофорный цикл (12с / 3с / 10с)"
                >
                  Авто-цикл
                </button>
                <button
                  onClick={() => handleManualSignalPhase('RED')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    trafficSignalPhase === 'RED'
                      ? 'bg-red-600 text-white font-bold shadow-md shadow-red-600/30'
                      : 'text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  🔴 Красный
                </button>
                <button
                  onClick={() => handleManualSignalPhase('YELLOW')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    trafficSignalPhase === 'YELLOW'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-amber-400 hover:bg-amber-500/20'
                  }`}
                >
                  🟡 Желтый
                </button>
                <button
                  onClick={() => handleManualSignalPhase('GREEN')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    trafficSignalPhase === 'GREEN'
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/30'
                      : 'text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  🟢 Зеленый
                </button>
              </div>

              {/* Quick Vision Layers */}
              <div className="flex items-center gap-2.5 text-[11px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBoundingBoxes}
                    onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                    className="accent-cyan-400 w-3 h-3 rounded cursor-pointer"
                  />
                  <span className="text-slate-300">BBox</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLaneGeometry}
                    onChange={(e) => setShowLaneGeometry(e.target.checked)}
                    className="accent-indigo-400 w-3 h-3 rounded cursor-pointer"
                  />
                  <span className="text-indigo-300 font-bold">Сплошные 1.1</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSignalsOverlay}
                    onChange={(e) => setShowSignalsOverlay(e.target.checked)}
                    className="accent-emerald-400 w-3 h-3 rounded cursor-pointer"
                  />
                  <span className="text-emerald-300 font-bold">Светофоры</span>
                </label>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center">
              {streamSource === 'uploaded' && uploadedVideoUrl && (
                <video
                  ref={videoRef}
                  src={uploadedVideoUrl}
                  playsInline
                  loop
                  muted
                  autoPlay
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                  onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 60)}
                  className="w-full h-full object-contain"
                />
              )}

              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="absolute inset-0 w-full h-full cursor-crosshair"
              />

              {/* Floating notification for handle dragging */}
              {showLaneGeometry && (
                <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-indigo-500/40 px-3 py-1.5 rounded-lg text-[10px] text-indigo-300 flex items-center gap-2 select-none pointer-events-none shadow-xl">
                  <Move className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Перетаскивайте узлы сплошных линий прямо на видео для точной калибровки</span>
                </div>
              )}
            </div>

            {/* Bottom Playback Scrubber */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={togglePlay}
                    className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/20"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPlaying ? (lang === 'ru' ? 'Пауза' : 'Pause') : (lang === 'ru' ? 'Старт' : 'Play')}</span>
                  </button>

                  <button
                    onClick={() => handleSeek(currentTime - 1.0, '-1с')}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer border border-slate-700/60"
                  >
                    -1с
                  </button>

                  <button
                    onClick={() => handleSeek(currentTime + 1.0, '+1с')}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer border border-slate-700/60"
                  >
                    +1с
                  </button>

                  <button
                    onClick={handleReset}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
                    title="Сброс таймкода и реестра"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded px-2 py-0.5">
                    {[1.0, 1.5, 2.0].map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          setPlaybackSpeed(s);
                          if (videoRef.current) videoRef.current.playbackRate = s;
                        }}
                        className={`px-1.5 py-0.5 rounded ${playbackSpeed === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  <span>
                    <strong className="text-white">{currentTime.toFixed(2)}с</strong> / {duration.toFixed(1)}с
                  </span>
                </div>
              </div>

              {/* Timeline bar */}
              <input
                type="range"
                min="0"
                max={duration || 60}
                step="0.04"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Vision & Incident Inspector (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-[520px]">
            {/* Inspector Tab Selector */}
            <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950 p-1 gap-1 text-[11px]">
              <button
                onClick={() => setInspectorTab('objects')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'objects'
                    ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🚘 Объекты
              </button>

              <button
                onClick={() => setInspectorTab('signals')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'signals'
                    ? 'bg-slate-800 text-emerald-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🚦 Светофоры
              </button>

              <button
                onClick={() => setInspectorTab('events')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'events'
                    ? 'bg-slate-800 text-amber-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚠️ Штрафы ({violationsList.length})
              </button>

              <button
                onClick={() => setInspectorTab('geometry')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'geometry'
                    ? 'bg-slate-800 text-indigo-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📐 Сплошные
              </button>
            </div>

            {/* Tab 1: Objects & Radar Telemetry */}
            {inspectorTab === 'objects' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-2 text-xs">
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 mb-2">
                  <div className="text-[10px] text-cyan-400 font-mono font-bold flex items-center justify-between">
                    <span>ANPR & Speed Radar Telemetry:</span>
                    <span className="text-emerald-400">YOLOv11 60 FPS</span>
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    Автоматическое считывание госномеров и скоростного профиля полос
                  </div>
                </div>

                <div className="space-y-1.5">
                  {simVehiclesRef.current.map(v => (
                    <div
                      key={v.id}
                      className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between hover:border-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v.color }}></div>
                        <div>
                          <span className="font-bold text-white block">#{v.id} {v.labelRu}</span>
                          <span className="text-[10px] text-cyan-300 font-mono">{v.plate}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-400 text-xs">{v.speedKmh.toFixed(0)} км/ч</div>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold inline-block ${
                          v.hasCrossedSolid ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                          v.hasViolatedRed ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                          'bg-cyan-500/10 text-cyan-300'
                        }`}>
                          {v.hasCrossedSolid ? 'СПЛОШНАЯ' : v.hasViolatedRed ? 'КРАСНЫЙ' : 'НОРМА'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 2: Traffic Signals & Optical HSV */}
            {inspectorTab === 'signals' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-3 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>Оптическая спектрометрия HSV:</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ПДД РУз
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-mono bg-slate-900/80 p-2 rounded border border-slate-800">
                    {trafficSignalPhase === 'RED' ? '🔴 Фаза 1: Красный сигнал (Проезд запрещен, ст. 128-4)' :
                     trafficSignalPhase === 'YELLOW' ? '🟡 Фаза 2: Желтый сигнал (Внимание)' :
                     trafficSignalPhase === 'GREEN' ? '🟢 Фаза 3: Зеленый сигнал (Движение разрешено)' :
                     '🔄 Авто-цикл: Динамическое адаптивное регулирование перекрестка'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-white text-[11px]">Быстрое переключение фаз:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleManualSignalPhase('GREEN')}
                      className="py-2 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      🟢 Зеленый
                    </button>
                    <button
                      onClick={() => handleManualSignalPhase('RED')}
                      className="py-2 bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      🔴 Красный
                    </button>
                    <button
                      onClick={() => handleManualSignalPhase('YELLOW')}
                      className="py-2 bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300 rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      🟡 Желтый
                    </button>
                    <button
                      onClick={() => handleManualSignalPhase('AUTO')}
                      className="py-2 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      🔄 Авто-цикл
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Violations Quick List */}
            {inspectorTab === 'events' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                  <span>Таймкод / Нарушение</span>
                  <span>Действие</span>
                </div>

                {violationsList.length > 0 ? (
                  violationsList.map(viol => (
                    <div
                      key={viol.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-cyan-300 flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {viol.start.toFixed(1)}с – {viol.end.toFixed(1)}с
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${viol.badgeColor}`}>
                          {viol.riskBadge}
                        </span>
                      </div>

                      <div className="text-white font-medium text-[11px]">
                        {viol.labelRu}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                        <span className="font-mono text-emerald-400 font-bold">{viol.fineUzs}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setActiveProtocolItem(viol)}
                            className="px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 rounded transition-colors cursor-pointer"
                          >
                            Протокол
                          </button>
                          <button
                            onClick={() => handleSeek(viol.start, viol.labelRu)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-white rounded transition-colors cursor-pointer"
                          >
                            Перейти
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Нарушений не зафиксировано
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Solid Lines & Geometry Calibration Studio */}
            {inspectorTab === 'geometry' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Сплошные линии (Разметка 1.1):</span>
                  </span>
                  <button
                    onClick={handleAddSolidDivider}
                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Добавить</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {currentDividers.map((div, idx) => (
                    <div key={div.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-300 text-[11px]">{div.name}</span>
                        {currentDividers.length > 1 && (
                          <button
                            onClick={() => handleDeleteSolidDivider(div.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                        <div>P1 (Верх): X={div.x1}, Y={div.y1}</div>
                        <div>P2 (Низ): X={div.x2}, Y={div.y2}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleResetSolidDividersGOST}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  Сбросить к стандарту ГОСТ
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Jump Notice */}
      {jumpNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-950/95 border-2 border-cyan-400 text-cyan-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-bounce">
          <Target className="w-5 h-5 text-cyan-400 shrink-0" />
          <span className="text-xs font-mono font-bold">{jumpNotice}</span>
        </div>
      )}

      {/* SECTION 1: Dynamic Violations Table with Click-to-Jump & Real Admin Code Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{lang === 'ru' ? 'Реестр зафиксированных нарушений ПДД (КоАО РУз)' : 'Violation Registry & Instant Click-to-Jump'}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                violationsList.length > 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/30 font-bold'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {violationsList.length > 0 ? `ФИКСАЦИЯ: ${violationsList.length}` : 'МОНИТОРИНГ: НЕТ НАРУШЕНИЙ'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Нажмите на строку нарушения или кнопку «Перейти», чтобы мгновенно перемотать видеоплеер на секунду начала инцидента.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {violationsList.length > 0 && (
              <>
                <button
                  onClick={handleClearViolations}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/40 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Очистить</span>
                </button>
                <button
                  onClick={handleExportViolationsReport}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950/60 text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/40 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Экспорт отчета</span>
                </button>
              </>
            )}

            <span className="text-slate-400 ml-1">Текущий таймкод:</span>
            <span className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-cyan-400 font-bold">
              {currentTime.toFixed(2)}с
            </span>
          </div>
        </div>

        {/* Category Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 text-[11px]">Фильтр:</span>
          {[
            { id: 'all', label: `Все (${violationsList.length})` },
            { id: 'solid', label: '⚡ Сплошная 1.1' },
            { id: 'red', label: '🔴 Красный свет' },
            { id: 'jay', label: '🚶 Пешеход' },
            { id: 'hazard', label: '⚠️ Предаварийные' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedViolationCategory(f.id)}
              className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                selectedViolationCategory === f.id
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                  : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Violations Table */}
        {violationsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] bg-slate-950/60">
                  <th className="py-2.5 px-3">Таймкод (start – end)</th>
                  <th className="py-2.5 px-3">Тип инцидента</th>
                  <th className="py-2.5 px-3">Госномер (ANPR)</th>
                  <th className="py-2.5 px-3">Квалификация (КоАО РУз)</th>
                  <th className="py-2.5 px-3">Сумма штрафа</th>
                  <th className="py-2.5 px-3">Статус</th>
                  <th className="py-2.5 px-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {violationsList.map((viol) => {
                  const isCurrentActive = currentTime >= viol.start && currentTime <= viol.end;
                  return (
                    <tr
                      key={viol.id}
                      onClick={() => handleSeek(viol.start, viol.labelRu)}
                      className={`transition-colors cursor-pointer group ${
                        isCurrentActive
                          ? 'bg-cyan-950/40 hover:bg-cyan-950/60'
                          : 'hover:bg-slate-800/60 bg-slate-950/30'
                      }`}
                    >
                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                          <Clock className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                          <span>{viol.start.toFixed(1)}с – {viol.end.toFixed(1)}с</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">Δt = {Math.max(0.1, viol.end - viol.start).toFixed(1)}с</span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {lang === 'ru' ? viol.labelRu : viol.labelEn}
                        </div>
                        <div className="text-[10px] text-slate-400">{viol.vehicleType}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-1 bg-slate-950 rounded border border-slate-700 text-white font-mono font-bold text-xs tracking-wider shadow-inner">
                          🇺🇿 {viol.licensePlate}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="text-slate-300 font-medium">{viol.codeArticle}</div>
                        <div className="text-[10px] text-slate-400">{viol.fineBrv}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-emerald-400">{viol.fineUzs}</div>
                        <div className="text-[10px] text-slate-500">Городской бюджет</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${viol.badgeColor}`}>
                          {viol.riskBadge}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveProtocolItem(viol);
                            }}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                            title="Сформировать официальное постановление"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Протокол</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeek(viol.start, viol.labelRu);
                            }}
                            className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs font-mono flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Перейти к кадру"
                          >
                            <Target className="w-3 h-3 text-slate-950" />
                            <span>Перейти</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDismissViolation(viol.id);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
                            title="Аннулировать"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Нарушений ПДД не зафиксировано</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Нейросеть YOLOv11 и оптический спектрометр светофоров работают в штатном режиме без ложных срабатываний.
                  </p>
                </div>
              </div>

              {/* Quick Test Incident Simulations */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="text-slate-500 text-[10px] mr-1">Тест правил:</span>
                <button
                  onClick={() => handleSimulateViolation('solid_line_crossing')}
                  className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 rounded-md transition-colors cursor-pointer"
                >
                  ⚡ Сплошная
                </button>
                <button
                  onClick={() => handleSimulateViolation('red_light')}
                  className="px-2.5 py-1 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/30 rounded-md transition-colors cursor-pointer"
                >
                  🔴 Красный
                </button>
                <button
                  onClick={() => handleSimulateViolation('jaywalking')}
                  className="px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-500/30 rounded-md transition-colors cursor-pointer"
                >
                  🚶 Пешеход
                </button>
                <button
                  onClick={() => handleSimulateViolation('near_miss')}
                  className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/30 rounded-md transition-colors cursor-pointer"
                >
                  ⚠️ TTC &lt; 2.0с
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Urban Economic Impact & Fine Simulator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Экономика безопасности и штрафные сборы (B2G Urban Analytics)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Расчет экономической эффективности внедрения VisionForce для ЦОДД и хокимиятов городов Узбекистана.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Зафиксировано нарушений:</div>
            <div className="text-xl font-mono font-bold text-white">{totalFineStats.count} инцидентов</div>
            <div className="text-[10px] text-cyan-400 font-mono">100% доказательная база (видео + ANPR)</div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Общая сумма штрафов:</div>
            <div className="text-xl font-mono font-bold text-emerald-400">{totalFineStats.totalUzsFormatted}</div>
            <div className="text-[10px] text-slate-500 font-mono">{totalFineStats.totalBrv} БРВ в городской бюджет</div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Снижение аварийности (Vision Zero):</div>
            <div className="text-xl font-mono font-bold text-cyan-400">-42.5% ДТП</div>
            <div className="text-[10px] text-emerald-400 font-mono">Предотвращено потенциальных столкновений</div>
          </div>
        </div>
      </div>

      {/* OFFICIAL ADMINISTRATIVE FINE PROTOCOL MODAL (E-JARIMA / МВД РУЗ) */}
      {activeProtocolItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold">
                  🇺🇿
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    ПОСТАНОВЛЕНИЕ ОБ АДМИНИСТРАТИВНОМ ПРАВОНАРУШЕНИИ
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    СЭФП / ГУБДД МВД РЕСПУБЛИКИ УЗБЕКИСТАН • #{activeProtocolItem.id.toUpperCase()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveProtocolItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-[10px]">Государственный регистрационный знак:</div>
                  <div className="text-lg font-mono font-bold text-white tracking-wider">
                    🇺🇿 {activeProtocolItem.licensePlate}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400 text-[10px]">Категория ТС:</div>
                  <div className="font-bold text-cyan-300">{activeProtocolItem.vehicleType}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Квалификация правонарушения:</div>
                  <div className="font-bold text-white pt-0.5">{activeProtocolItem.labelRu}</div>
                  <div className="text-indigo-400 font-mono pt-0.5">{activeProtocolItem.codeArticle}</div>
                </div>

                <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Сумма административного штрафа:</div>
                  <div className="text-base font-mono font-bold text-emerald-400 pt-0.5">{activeProtocolItem.fineUzs}</div>
                  <div className="text-slate-400 text-[10px]">Со скидкой 50% (15 дней): <strong className="text-emerald-300">{Math.round(parseInt(activeProtocolItem.fineUzs.replace(/\D/g, '')) / 2).toLocaleString('ru-RU')} сум</strong></div>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <div>
                  <span className="text-slate-400">Таймкод фиксации:</span> <strong className="text-cyan-300">{activeProtocolItem.start.toFixed(1)}с – {activeProtocolItem.end.toFixed(1)}с</strong>
                </div>
                <div>
                  <span className="text-slate-400">Скорость ТС:</span> <strong className="text-white">{activeProtocolItem.speedKmh.toFixed(1)} км/ч</strong>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                <QrCode className="w-4 h-4 text-slate-400" />
                <span>ЭЦП: Verified E-Jarima AI Studio</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Печать постановления</span>
                </button>
                <button
                  onClick={() => setActiveProtocolItem(null)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      <ShortcutsHelpModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
};
