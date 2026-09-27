import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Zap,
  Clock,
  Crosshair,
  Target,
  Move,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  FileText,
  Plus,
  Printer,
  Layers,
  Activity,
  Scan,
  Settings2,
  Sliders,
  Shield,
  Gauge,
  CircleDot,
  MousePointer,
  Copy,
  ChevronRight,
  Eye,
  Info,
  Sparkles,
  Wand2,
  SkipBack,
  SkipForward,
  FastForward,
  Rewind,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import { TrafficEvent, OfficialClass } from '../types/hackathon';
import {
  realtimeNeuralVision,
  LiveDetectedObject,
  TrafficSceneAnalysis,
  CollisionAlertEvent,
  RoadInfrastructureElement,
  RoadElementType
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

const UZ_PLATE_SERIES = ['AAA', 'AAB', 'ABA', 'BBB', 'MMM', 'ZZZ', 'ABC', 'SAV', 'UZB', 'SAM', 'FER'];
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
  } else if ((evt.label as string) === 'speeding') {
    labelRu = 'Превышение установленной скорости движения';
    labelEn = 'Speeding Violation';
    codeArticle = 'ст. 128-3 КоАО РУз';
    fineUzs = '340 000 сум';
    fineBrv = '1.0 БРВ';
    riskBadge = 'РАДАР ФИКСАЦИЯ';
    badgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    speedKmh = 74.0;
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

  // Road Elements Registry & Interactive Palette Selection
  const [roadElements, setRoadElements] = useState<RoadInfrastructureElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<string>('auto');

  // Dragging & Interaction State on Canvas
  const [activeDragElement, setActiveDragElement] = useState<{
    elementId: string;
    mode: 'move' | 'p1' | 'p2' | 'resize';
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // Vision Filter Toggles
  const [confThreshold, setConfThreshold] = useState<number>(0.35);
  const [isEnforcementActive, setIsEnforcementActive] = useState<boolean>(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState<boolean>(true);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(false);
  const [showSpeedRadar, setShowSpeedRadar] = useState<boolean>(true);
  const [showInfrastructureOverlay, setShowInfrastructureOverlay] = useState<boolean>(true);

  // Interactive Traffic Light ROI Drawing State
  const [isDrawingROI, setIsDrawingROI] = useState<boolean>(false);
  const [roiType, setRoiType] = useState<'traffic_light_auto' | 'traffic_light_pedestrian'>('traffic_light_auto');
  const [roiStart, setRoiStart] = useState<{ x: number; y: number } | null>(null);
  const [roiCurrent, setRoiCurrent] = useState<{ x: number; y: number } | null>(null);

  // Traffic Light Global Controller
  const [trafficSignalPhase, setTrafficSignalPhase] = useState<'GREEN' | 'YELLOW' | 'RED' | 'AUTO'>('AUTO');
  const [autoCycleTimeSec, setAutoCycleTimeSec] = useState<number>(0);

  // Telemetry & Detector Output
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

  // Simulator Vehicles Physics Engine
  const simVehiclesRef = useRef<{
    id: number;
    type: 'car' | 'truck' | 'bus' | 'motorcycle' | 'pedestrian';
    labelRu: string;
    lane: number;
    x: number;
    y: number;
    w: number;
    h: number;
    speedKmh: number;
    targetSpeed: number;
    color: string;
    plate: string;
    trail: { x: number; y: number }[];
    laneChangeProgress?: number;
    targetLane?: number;
    hasCrossedSolid?: boolean;
    hasViolatedRed?: boolean;
  }[]>([
    { id: 11, type: 'car', labelRu: '🚗 Авто (Sedan)', lane: 1, x: 0.42, y: 0.35, w: 0.065, h: 0.09, speedKmh: 48, targetSpeed: 52, color: '#38bdf8', plate: '01 | 777 AAA', trail: [] },
    { id: 14, type: 'car', labelRu: '🚗 Авто (SUV)', lane: 0, x: 0.32, y: 0.55, w: 0.075, h: 0.10, speedKmh: 54, targetSpeed: 58, color: '#a855f7', plate: '10 | 452 BBA', trail: [] },
    { id: 18, type: 'bus', labelRu: '🚌 Автобус', lane: 2, x: 0.58, y: 0.20, w: 0.09, h: 0.14, speedKmh: 40, targetSpeed: 44, color: '#f59e0b', plate: '01 | 890 BUS', trail: [] },
    { id: 22, type: 'motorcycle', labelRu: '🛵 Скутер/Самокат', lane: 0, x: 0.26, y: 0.68, w: 0.038, h: 0.065, speedKmh: 32, targetSpeed: 35, color: '#06b6d4', plate: 'Электро-скутер', trail: [] },
    { id: 27, type: 'pedestrian', labelRu: '🚶 Пешеход', lane: 3, x: 0.82, y: 0.75, w: 0.025, h: 0.045, speedKmh: 4.2, targetSpeed: 4.5, color: '#84cc16', plate: 'Пешеход', trail: [] }
  ]);

  const [jumpNotice, setJumpNotice] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const lastUiUpdateRef = useRef<number>(0);

  // Performance-optimised mutable refs
  const isPlayingRef = useRef<boolean>(isPlaying);
  const currentTimeRef = useRef<number>(currentTime);
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  const streamSourceRef = useRef<'simulator' | 'uploaded'>(streamSource);
  const trafficSignalPhaseRef = useRef<'GREEN' | 'YELLOW' | 'RED' | 'AUTO'>(trafficSignalPhase);
  const confThresholdRef = useRef<number>(confThreshold);
  const autoCycleTimerRef = useRef<number>(0);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { playbackSpeedRef.current = playbackSpeed; }, [playbackSpeed]);
  useEffect(() => { streamSourceRef.current = streamSource; }, [streamSource]);
  useEffect(() => { trafficSignalPhaseRef.current = trafficSignalPhase; }, [trafficSignalPhase]);
  useEffect(() => { confThresholdRef.current = confThreshold; }, [confThreshold]);

  // Initialize Elements from Engine
  useEffect(() => {
    realtimeNeuralVision.init();
    setRoadElements(realtimeNeuralVision.getRoadElements());
  }, []);

  const violationsList = useMemo(() => {
    const events = smoothedEvents.length > 0 ? smoothedEvents : detectedEvents;
    const items = events.map((e, idx) => getViolationDetails(e, idx));
    if (selectedViolationCategory === 'all') return items;
    return items.filter(v => {
      if (selectedViolationCategory === 'solid') return v.id.includes('solid') || v.labelRu.includes('сплошн');
      if (selectedViolationCategory === 'red') return v.id.includes('red') || v.id.includes('stopline') || v.labelRu.includes('запрещающ');
      if (selectedViolationCategory === 'jay') return v.id.includes('jay') || v.labelRu.includes('Пешеход');
      if (selectedViolationCategory === 'speed') return v.id.includes('speed') || v.labelRu.includes('скорост');
      if (selectedViolationCategory === 'hazard') return v.id.includes('miss') || v.id.includes('accident') || v.labelRu.includes('Предаварий');
      return true;
    });
  }, [smoothedEvents, detectedEvents, selectedViolationCategory]);

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

  // ══════════════════════════════════════════════════════════════════════════
  // ZERO-LAG 60 FPS MAIN RENDER & PHYSICS LOOP
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let lastStamp = performance.now();

    const loop = (timestamp: number) => {
      const dt = Math.min(0.08, (timestamp - lastStamp) / 1000);
      lastStamp = timestamp;

      const playing = isPlayingRef.current;
      const speed = playbackSpeedRef.current;
      const source = streamSourceRef.current;
      const signalPhase = trafficSignalPhaseRef.current;
      const conf = confThresholdRef.current;

      if (playing) {
        if (source === 'uploaded' && videoRef.current) {
          currentTimeRef.current = videoRef.current.currentTime;
          if (videoRef.current.playbackRate !== speed) {
            videoRef.current.playbackRate = speed;
          }
        } else {
          currentTimeRef.current = (currentTimeRef.current + dt * speed) % (duration || 60);
        }

        // 1. Video Frame Neural Inference (Optimally throttled to ~9 FPS to eliminate frame drops)
        if (source === 'uploaded' && videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused) {
          const nowMs = performance.now();
          if (nowMs - lastInferenceTimeRef.current > 110) {
            lastInferenceTimeRef.current = nowMs;
            realtimeNeuralVision.processFrame(videoRef.current, conf).then(() => {
              // Non-blocking
            }).catch(() => {});
          }
        }

        // 2. Liquid Smooth 60 FPS Interpolation
        realtimeNeuralVision.updateInterpolation();

        // 3. Traffic Light Auto-Cycle Engine
        if (signalPhase === 'AUTO') {
          autoCycleTimerRef.current = (autoCycleTimerRef.current + dt) % 25;
          const cycleTime = autoCycleTimerRef.current;
          let targetColor: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
          if (cycleTime < 12) targetColor = 'GREEN';
          else if (cycleTime < 15) targetColor = 'YELLOW';
          else targetColor = 'RED';

          realtimeNeuralVision.setSignalOverride(1, targetColor);
        }

        // 4. Advance Simulator Vehicles Motion & Physics
        if (source === 'simulator') {
          const activeSignal = signalPhase === 'AUTO'
            ? (autoCycleTimerRef.current < 12 ? 'GREEN' : autoCycleTimerRef.current < 15 ? 'YELLOW' : 'RED')
            : signalPhase;

          simVehiclesRef.current.forEach((veh, idx) => {
            const isRedOrYellow = activeSignal === 'RED' || activeSignal === 'YELLOW';
            const nearStopLine = veh.y >= 0.54 && veh.y <= 0.64;

            if (veh.type !== 'pedestrian') {
              if (isRedOrYellow && nearStopLine && veh.id !== 14) {
                veh.speedKmh = Math.max(0, veh.speedKmh - dt * 35);
              } else {
                veh.speedKmh = Math.min(veh.targetSpeed, veh.speedKmh + dt * 20);
              }

              const deltaY = (veh.speedKmh / 3600) * 8.0 * dt * (0.8 + veh.y * 1.2);
              veh.y += deltaY;
              veh.w = 0.05 + veh.y * 0.045;
              veh.h = 0.07 + veh.y * 0.065;

              const laneCenters = [0.30 + (veh.y - 0.2) * -0.05, 0.42 + (veh.y - 0.2) * -0.02, 0.58 + (veh.y - 0.2) * 0.04, 0.70 + (veh.y - 0.2) * 0.08];
              if (veh.laneChangeProgress !== undefined && veh.targetLane !== undefined) {
                veh.laneChangeProgress = Math.min(1.0, veh.laneChangeProgress + dt * 0.6);
                const startX = laneCenters[veh.lane];
                const endX = laneCenters[veh.targetLane];
                veh.x = startX + (endX - startX) * veh.laneChangeProgress;

                if (!veh.hasCrossedSolid && veh.laneChangeProgress > 0.40) {
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

              if (veh.id === 14 && veh.y > 0.45 && veh.y < 0.50 && veh.laneChangeProgress === undefined && !veh.hasCrossedSolid) {
                veh.targetLane = 1;
                veh.laneChangeProgress = 0.0;
              }

              if (veh.id === 14 && isRedOrYellow && veh.y > 0.62 && !veh.hasViolatedRed) {
                veh.hasViolatedRed = true;
                handleSimulateViolation('red_light');
              }

              veh.trail.push({ x: veh.x + veh.w / 2, y: veh.y + veh.h });
              if (veh.trail.length > 15) veh.trail.shift();

              if (veh.y > 1.05) {
                veh.y = 0.18;
                veh.lane = idx % 3;
                veh.hasCrossedSolid = false;
                veh.hasViolatedRed = false;
                veh.speedKmh = veh.targetSpeed;
                veh.trail = [];
              }
            } else {
              veh.x -= dt * 0.06;
              if (veh.x < 0.25) veh.x = 0.85;
            }
          });
        }
      }

      // 5. Throttled UI State Dispatcher (Runs at ~5 FPS to prevent React render lag while canvas runs at 60 FPS)
      const now = performance.now();
      if (now - lastUiUpdateRef.current > 200) {
        lastUiUpdateRef.current = now;
        setCurrentTime(currentTimeRef.current);
        setAutoCycleTimeSec(autoCycleTimerRef.current);
        setTelemetryObjects(realtimeNeuralVision.getTracks());
        setSceneData(realtimeNeuralVision.getSceneAnalysis());
        setDetectedEvents(realtimeNeuralVision.getRawEvents());
        setSmoothedEvents(realtimeNeuralVision.getSmoothedEvents());
        setCollisionLogs(realtimeNeuralVision.getCollisionLog());
        setRoadElements(realtimeNeuralVision.getRoadElements());
      }

      renderCanvas();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [duration]);

  // ══════════════════════════════════════════════════════════════════════════
  // 100% AUTOMATIC SCENE & PRESET CALIBRATION ENGINE
  // ══════════════════════════════════════════════════════════════════════════
  const handleAutoCalibrateAll = () => {
    const updated = realtimeNeuralVision.autoDetectAllInfrastructure(videoRef.current);
    setRoadElements(updated);
    setActivePreset('auto');
    setJumpNotice('✨ CV-Автокалибровка: сцена просканирована');
    setTimeout(() => setJumpNotice(null), 3000);
  };

  const handleApplyPreset = (presetKey: 'standard_intersection' | 'highway_radar' | 't_junction_arrow' | 'pedestrian_focus' | 'empty', nameRu: string) => {
    const updated = realtimeNeuralVision.applyInfrastructurePreset(presetKey);
    setRoadElements(updated);
    setActivePreset(presetKey);
    setSelectedElementId(null);
    setJumpNotice(`Применен пресет: ${nameRu}`);
    setTimeout(() => setJumpNotice(null), 3000);
  };

  const handleClearAllRoadElements = () => {
    realtimeNeuralVision.clearRoadElements();
    setRoadElements([]);
    setSelectedElementId(null);
    setActivePreset('empty');
    setJumpNotice('Холст полностью очищен от всех дорожных объектов');
    setTimeout(() => setJumpNotice(null), 2500);
  };

  const toggleEnforcement = () => {
    setIsEnforcementActive(prev => {
      const next = !prev;
      realtimeNeuralVision.setEnforcementActive(next);
      setJumpNotice(next ? '⚡ Фиксация нарушений ПДД: ВКЛЮЧЕНА' : '⏸️ Фиксация нарушений ПДД: ВЫКЛЮЧЕНА');
      setTimeout(() => setJumpNotice(null), 2500);
      return next;
    });
  };

  // Road Infrastructure Palette Handlers
  const handleAddElementFromPalette = (type: RoadElementType) => {
    const newElem = realtimeNeuralVision.addRoadElement(type, 0.45, 0.45);
    const updated = realtimeNeuralVision.getRoadElements();
    setRoadElements(updated);
    setSelectedElementId(newElem.id);
    setJumpNotice(`Добавлен объект: ${newElem.name}. Перетащите его на нужную полосу.`);
    setTimeout(() => setJumpNotice(null), 2500);
  };

  const handleDeleteElement = (id: string) => {
    realtimeNeuralVision.removeRoadElement(id);
    setRoadElements(realtimeNeuralVision.getRoadElements());
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const handleDuplicateElement = (id: string) => {
    const existing = roadElements.find(e => e.id === id);
    if (existing) {
      const copy = realtimeNeuralVision.addRoadElement(existing.type, Math.min(0.9, existing.x + 0.05), Math.min(0.9, existing.y + 0.05));
      copy.name = `${existing.name} (Копия)`;
      copy.direction = existing.direction;
      copy.speedLimitKmh = existing.speedLimitKmh;
      const updated = realtimeNeuralVision.getRoadElements();
      setRoadElements(updated);
      setSelectedElementId(copy.id);
      setJumpNotice(`Создана копия объекта ${copy.name}`);
      setTimeout(() => setJumpNotice(null), 2500);
    }
  };

  // Canvas Mouse Dragging, Dropping & ROI Traffic Light Bounding
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const clickY = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

    // If User is in ROI Selection Mode: initiate drawing box
    if (isDrawingROI) {
      setRoiStart({ x: clickX, y: clickY });
      setRoiCurrent({ x: clickX, y: clickY });
      return;
    }

    // Check hit test against road elements (top-most first)
    for (let i = roadElements.length - 1; i >= 0; i--) {
      const el = roadElements[i];
      if (!el.enabled) continue;

      // Handle P1 and P2 for line elements
      if (el.type === 'solid_line' || el.type === 'stop_line') {
        const p1x = el.x;
        const p1y = el.y;
        const p2x = el.x2 !== undefined ? el.x2 : el.x + el.w;
        const p2y = el.y2 !== undefined ? el.y2 : el.y + el.h;

        if (Math.hypot(p1x - clickX, p1y - clickY) < 0.05) {
          setSelectedElementId(el.id);
          setActiveDragElement({ elementId: el.id, mode: 'p1', offsetX: 0, offsetY: 0 });
          return;
        }
        if (Math.hypot(p2x - clickX, p2y - clickY) < 0.05) {
          setSelectedElementId(el.id);
          setActiveDragElement({ elementId: el.id, mode: 'p2', offsetX: 0, offsetY: 0 });
          return;
        }
      }

      // Hit test for bounding box
      const minX = Math.min(el.x, el.x2 !== undefined ? el.x2 : el.x);
      const maxX = Math.max(el.x + el.w, el.x2 !== undefined ? el.x2 : el.x);
      const minY = Math.min(el.y, el.y2 !== undefined ? el.y2 : el.y);
      const maxY = Math.max(el.y + el.h, el.y2 !== undefined ? el.y2 : el.y);

      if (clickX >= minX - 0.03 && clickX <= maxX + 0.03 && clickY >= minY - 0.03 && clickY <= maxY + 0.03) {
        setSelectedElementId(el.id);
        setActiveDragElement({
          elementId: el.id,
          mode: 'move',
          offsetX: clickX - el.x,
          offsetY: clickY - el.y
        });
        return;
      }
    }

    setSelectedElementId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const curX = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

    if (isDrawingROI && roiStart) {
      setRoiCurrent({ x: curX, y: curY });
      return;
    }

    if (activeDragElement) {
      const el = roadElements.find(item => item.id === activeDragElement.elementId);
      if (el) {
        if (activeDragElement.mode === 'move') {
          const dx = curX - activeDragElement.offsetX - el.x;
          const dy = curY - activeDragElement.offsetY - el.y;
          el.x = parseFloat(Math.max(0.01, Math.min(0.95, el.x + dx)).toFixed(3));
          el.y = parseFloat(Math.max(0.01, Math.min(0.95, el.y + dy)).toFixed(3));
          if (el.x2 !== undefined) el.x2 = parseFloat(Math.max(0.01, Math.min(0.99, el.x2 + dx)).toFixed(3));
          if (el.y2 !== undefined) el.y2 = parseFloat(Math.max(0.01, Math.min(0.99, el.y2 + dy)).toFixed(3));
        } else if (activeDragElement.mode === 'p1') {
          el.x = parseFloat(curX.toFixed(3));
          el.y = parseFloat(curY.toFixed(3));
        } else if (activeDragElement.mode === 'p2') {
          el.x2 = parseFloat(curX.toFixed(3));
          el.y2 = parseFloat(curY.toFixed(3));
        }
        realtimeNeuralVision.updateRoadElement(el.id, el);
        setRoadElements([...realtimeNeuralVision.getRoadElements()]);
      }
      return;
    }

    // Hover detection
    let foundHover: string | null = null;
    for (const el of roadElements) {
      if (!el.enabled) continue;
      const minX = Math.min(el.x, el.x2 !== undefined ? el.x2 : el.x);
      const maxX = Math.max(el.x + el.w, el.x2 !== undefined ? el.x2 : el.x);
      const minY = Math.min(el.y, el.y2 !== undefined ? el.y2 : el.y);
      const maxY = Math.max(el.y + el.h, el.y2 !== undefined ? el.y2 : el.y);

      if (curX >= minX - 0.02 && curX <= maxX + 0.02 && curY >= minY - 0.02 && curY <= maxY + 0.02) {
        foundHover = el.id;
        break;
      }
    }
    setHoveredElementId(foundHover);
  };

  const handleCanvasMouseUp = () => {
    if (isDrawingROI && roiStart && roiCurrent) {
      const minX = Math.min(roiStart.x, roiCurrent.x);
      const minY = Math.min(roiStart.y, roiCurrent.y);
      const w = Math.abs(roiCurrent.x - roiStart.x);
      const h = Math.abs(roiCurrent.y - roiStart.y);

      if (w >= 0.015 && h >= 0.02) {
        const isPed = roiType === 'traffic_light_pedestrian';
        const newSig = realtimeNeuralVision.addCustomDrawnTrafficLight(
          { x: minX, y: minY, w, h },
          'MAIN_DIRECTION',
          isPed
        );
        const updated = realtimeNeuralVision.getRoadElements();
        setRoadElements(updated);
        setSelectedElementId(newSig.id);
        setJumpNotice(`🎯 Светофор обведен! Скрипт распознавания сфокусирован на этой зоне (ROI)`);
        setTimeout(() => setJumpNotice(null), 3500);
      }
      setIsDrawingROI(false);
      setRoiStart(null);
      setRoiCurrent(null);
      return;
    }

    setActiveDragElement(null);
  };

  // Drag-and-drop from HTML palette into Canvas
  const handleCanvasDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/road-element-type') as RoadElementType;
    if (type) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dropX = (e.clientX - rect.left) / rect.width;
      const dropY = (e.clientY - rect.top) / rect.height;

      const newElem = realtimeNeuralVision.addRoadElement(type, dropX, dropY);
      setRoadElements(realtimeNeuralVision.getRoadElements());
      setSelectedElementId(newElem.id);
      setJumpNotice(`Размещен объект: ${newElem.name}`);
      setTimeout(() => setJumpNotice(null), 2500);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  // Manual Signal & Phase Control
  const handleManualSignalPhase = (phase: 'GREEN' | 'YELLOW' | 'RED' | 'AUTO') => {
    setTrafficSignalPhase(phase);
    realtimeNeuralVision.setSignalOverride(1, phase);
    setJumpNotice(`Фаза светофоров: ${phase === 'AUTO' ? 'АВТО-ЦИКЛ (12с / 3с / 10с)' : phase}`);
    setTimeout(() => setJumpNotice(null), 2500);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HIGH-PRECISION FRAME-BY-FRAME SEEKING & SCRUBBING
  // ══════════════════════════════════════════════════════════════════════════
  const handleSeek = (timeSec: number, reason?: string) => {
    const clamped = Math.max(0, Math.min(duration || 60, timeSec));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    realtimeNeuralVision.handleSeekReset();
    renderCanvas();
    if (reason) {
      setJumpNotice(`Переход: ${clamped.toFixed(2)}с (${reason})`);
      setTimeout(() => setJumpNotice(null), 2000);
    }
  };

  const handleStepFrame = (stepFrames: number) => {
    // 1 frame = 0.04s @ 25fps
    const frameDt = 0.04;
    const targetTime = currentTimeRef.current + stepFrames * frameDt;
    if (isPlaying) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      realtimeNeuralVision.setPaused(true);
      if (videoRef.current) videoRef.current.pause();
    }
    handleSeek(targetTime, stepFrames > 0 ? `+${stepFrames} кадр` : `${stepFrames} кадр`);
  };

  const handleStepSeconds = (seconds: number) => {
    const targetTime = currentTimeRef.current + seconds;
    handleSeek(targetTime, seconds > 0 ? `+${seconds}с` : `${seconds}с`);
  };

  // Global Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (e.shiftKey) handleStepSeconds(-5);
        else handleStepSeconds(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (e.shiftKey) handleStepSeconds(5);
        else handleStepSeconds(1);
      } else if (e.code === 'Comma' || e.key === '<') {
        e.preventDefault();
        handleStepFrame(-1);
      } else if (e.code === 'Period' || e.key === '>') {
        e.preventDefault();
        handleStepFrame(1);
      } else if (e.code === 'Home') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration]);

  const togglePlay = () => {
    setIsPlaying(prev => {
      const next = !prev;
      isPlayingRef.current = next;
      realtimeNeuralVision.setPaused(!next);
      if (videoRef.current) {
        if (next) videoRef.current.play().catch(() => {});
        else videoRef.current.pause();
      }
      return next;
    });
  };

  const handleReset = () => {
    currentTimeRef.current = 0;
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    realtimeNeuralVision.handleSeekReset();
    realtimeNeuralVision.clearAllEvents();
    setDetectedEvents([]);
    setSmoothedEvents([]);
    renderCanvas();
    setJumpNotice('Плеер и реестр нарушений сброшены к 0.00с');
    setTimeout(() => setJumpNotice(null), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
      const url = URL.createObjectURL(file);
      setUploadedFileName(file.name);
      setUploadedVideoUrl(url);
      setStreamSource('uploaded');
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setIsPlaying(true);
      realtimeNeuralVision.clearAllEvents();
      realtimeNeuralVision.clearRoadElements();
      setRoadElements([]);
      setSelectedElementId(null);
      setDetectedEvents([]);
      setSmoothedEvents([]);
      setActivePreset('empty');

      setJumpNotice(`Загружено видео: ${file.name}. Холст очищен. Разместите объекты или нажмите «Авто-CV»`);
      setTimeout(() => setJumpNotice(null), 3500);
    }
  };

  const handleSimulateViolation = (type: OfficialClass) => {
    realtimeNeuralVision.simulateTestViolation(type, currentTimeRef.current);
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
  // MASTER HIGH-PRECISION CANVAS RENDERING WITH UNIFIED ROAD INFRASTRUCTURE
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

    // 1. Draw Background: Video Frame or Synthetic Perspective
    if (streamSource === 'uploaded' && videoRef.current && videoRef.current.readyState >= 2) {
      ctx.drawImage(videoRef.current, 0, 0, width, height);
    } else {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.25);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height * 0.25);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(width * 0.1, height * 0.18, 80, 45);
      ctx.fillRect(width * 0.75, height * 0.15, 120, 65);
      ctx.fillRect(width * 0.88, height * 0.17, 70, 50);

      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, height * 0.25, width, height * 0.75);

      ctx.fillStyle = '#131926';
      ctx.beginPath();
      ctx.moveTo(width * 0.22, height * 0.25);
      ctx.lineTo(width * 0.78, height * 0.25);
      ctx.lineTo(width * 0.95, height);
      ctx.lineTo(width * 0.05, height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width * 0.22, height * 0.25);
      ctx.lineTo(width * 0.05, height);
      ctx.moveTo(width * 0.78, height * 0.25);
      ctx.lineTo(width * 0.95, height);
      ctx.stroke();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(width * 0.50, height * 0.25);
      ctx.lineTo(width * 0.50, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Render ALL Configured Road Infrastructure Elements
    if (showInfrastructureOverlay) {
      roadElements.forEach(elem => {
        if (!elem.enabled) return;

        const isSelected = selectedElementId === elem.id;
        const isHovered = hoveredElementId === elem.id;
        const sx = Math.round(elem.x * width);
        const sy = Math.round(elem.y * height);
        const sw = Math.round(elem.w * width);
        const sh = Math.round(elem.h * height);

        // A. AUTOMOBILE TRAFFIC LIGHT (3-lens: Red, Yellow, Green)
        if (elem.type === 'traffic_light_auto') {
          const isRed = elem.state === 'RED';
          const isYellow = elem.state === 'YELLOW';
          const isGreen = elem.state === 'GREEN';
          const isAccent = !!elem.isAccent;

          // Glowing accent aura for user-drawn / accented signals
          if (isAccent) {
            ctx.strokeStyle = isRed ? 'rgba(239, 68, 68, 0.4)' : isYellow ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)';
            ctx.lineWidth = 8;
            ctx.strokeRect(sx - 4, sy - 4, sw + 8, sh + 8);
          }

          ctx.fillStyle = isSelected ? 'rgba(30, 41, 59, 0.98)' : 'rgba(15, 23, 42, 0.92)';
          ctx.strokeStyle = isSelected ? '#38bdf8' : isAccent ? (isRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981') : (isHovered ? '#818cf8' : (isRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981'));
          ctx.lineWidth = isAccent ? 3.0 : isSelected ? 2.5 : 1.8;
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, 6);
          ctx.fill();
          ctx.stroke();

          const lensRadius = Math.max(4, Math.min(sw * 0.35, sh * 0.12));
          const lensX = sx + sw / 2;
          const lenses = [
            { active: isRed, hex: '#ef4444', dimHex: '#3f1515', y: sy + sh * 0.22 },
            { active: isYellow, hex: '#f59e0b', dimHex: '#3b2910', y: sy + sh * 0.50 },
            { active: isGreen, hex: '#10b981', dimHex: '#0c3024', y: sy + sh * 0.78 }
          ];

          lenses.forEach(l => {
            ctx.beginPath();
            ctx.arc(lensX, l.y, lensRadius, 0, Math.PI * 2);
            ctx.fillStyle = l.active ? l.hex : l.dimHex;
            ctx.fill();
            if (l.active) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          });

          // Label badge above
          const badgeWidth = Math.max(sw + 40, isAccent ? 130 : 105);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
          ctx.fillRect(sx - 15, sy - 18, badgeWidth, 16);
          ctx.strokeStyle = isAccent ? '#38bdf8' : (isRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981');
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - 15, sy - 18, badgeWidth, 16);

          ctx.fillStyle = isRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981';
          ctx.font = 'bold 8px JetBrains Mono, monospace';
          const labelPrefix = isAccent ? '⭐ АКЦЕНТ-ROI' : '🚦 СВЕТОФОР';
          ctx.fillText(`${labelPrefix}: ${elem.state}`, sx - 10, sy - 7);
        }

        // B. PEDESTRIAN TRAFFIC LIGHT (2-lens: Red Man, Green Man)
        else if (elem.type === 'traffic_light_pedestrian') {
          const isRed = elem.state === 'RED';
          const isGreen = elem.state === 'GREEN';
          const isAccent = !!elem.isAccent;

          if (isAccent) {
            ctx.strokeStyle = isRed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)';
            ctx.lineWidth = 8;
            ctx.strokeRect(sx - 4, sy - 4, sw + 8, sh + 8);
          }

          ctx.fillStyle = isSelected ? 'rgba(30, 41, 59, 0.98)' : 'rgba(15, 23, 42, 0.92)';
          ctx.strokeStyle = isSelected ? '#38bdf8' : isAccent ? (isRed ? '#ef4444' : '#10b981') : (isHovered ? '#818cf8' : (isRed ? '#ef4444' : '#10b981'));
          ctx.lineWidth = isAccent ? 3.0 : isSelected ? 2.5 : 1.8;
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, 6);
          ctx.fill();
          ctx.stroke();

          const lensRadius = Math.max(4, Math.min(sw * 0.35, sh * 0.16));
          const lensX = sx + sw / 2;
          const lenses = [
            { active: isRed, hex: '#ef4444', dimHex: '#3f1515', y: sy + sh * 0.30, icon: '🛑' },
            { active: isGreen, hex: '#10b981', dimHex: '#0c3024', y: sy + sh * 0.70, icon: '🚶' }
          ];

          lenses.forEach(l => {
            ctx.beginPath();
            ctx.arc(lensX, l.y, lensRadius, 0, Math.PI * 2);
            ctx.fillStyle = l.active ? l.hex : l.dimHex;
            ctx.fill();
            if (l.active) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          });

          const badgeWidth = Math.max(sw + 40, isAccent ? 135 : 110);
          ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
          ctx.fillRect(sx - 15, sy - 18, badgeWidth, 16);
          ctx.strokeStyle = isAccent ? '#38bdf8' : (isRed ? '#ef4444' : '#10b981');
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - 15, sy - 18, badgeWidth, 16);

          ctx.fillStyle = isRed ? '#ef4444' : '#10b981';
          ctx.font = 'bold 8px JetBrains Mono, monospace';
          const labelPrefix = isAccent ? '⭐ ПЕШ-АКЦЕНТ' : '🚶 ПЕШ-СВЕТОФОР';
          ctx.fillText(`${labelPrefix}: ${isRed ? 'СТОЙ' : 'ИДИ'}`, sx - 10, sy - 7);
        }

        // C. STOP LINE (Разметка 1.12 + Знак СТОП)
        else if (elem.type === 'stop_line') {
          const p1x = Math.round(elem.x * width);
          const p1y = Math.round(elem.y * height);
          const p2x = Math.round((elem.x2 !== undefined ? elem.x2 : elem.x + elem.w) * width);
          const p2y = Math.round((elem.y2 !== undefined ? elem.y2 : elem.y) * height);

          const linkedSig = roadElements.find(e => e.id === elem.linkedSignalId || (e.type === 'traffic_light_auto' && e.direction === elem.direction));
          const isRed = (linkedSig && linkedSig.state === 'RED') || trafficSignalPhase === 'RED';

          ctx.strokeStyle = isRed ? (isFlashActive ? '#ef4444' : '#dc2626') : '#f8fafc';
          ctx.lineWidth = 5.0;
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.stroke();

          // Handles
          ctx.fillStyle = isSelected ? '#38bdf8' : '#ef4444';
          ctx.beginPath();
          ctx.arc(p1x, p1y, 7, 0, Math.PI * 2);
          ctx.arc(p2x, p2y, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = isRed ? '#ef4444' : '#94a3b8';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText(`🛑 СТОП-ЛИНИЯ 1.12 ${isRed ? '[ЗАПРЕТ ПРОЕЗДА]' : '[РАЗРЕШЕНО]'}`, p1x + 10, p1y - 8);
        }

        // D. CROSSWALK ZONE (Пешеходный переход «Зебра» 1.14)
        else if (elem.type === 'crosswalk_zone') {
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(241, 245, 249, 0.10)';
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#e2e8f0';
          ctx.lineWidth = 2.0;
          ctx.fillRect(sx, sy, sw, sh);
          ctx.strokeRect(sx, sy, sw, sh);

          // Draw zebra stripes
          const stripes = Math.floor(sw / 30);
          ctx.fillStyle = 'rgba(248, 250, 252, 0.75)';
          for (let s = 0; s < stripes; s++) {
            ctx.fillRect(sx + s * 30 + 5, sy + 4, 18, sh - 8);
          }

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillText(`🚶‍♂️ ${elem.name}`, sx + 6, sy + 16);
        }

        // E. SOLID LINE (Разметка 1.1)
        else if (elem.type === 'solid_line') {
          const p1x = Math.round(elem.x * width);
          const p1y = Math.round(elem.y * height);
          const p2x = Math.round((elem.x2 !== undefined ? elem.x2 : elem.x) * width);
          const p2y = Math.round((elem.y2 !== undefined ? elem.y2 : elem.y + elem.h) * height);

          ctx.strokeStyle = isSelected ? '#38bdf8' : '#6366f1';
          ctx.lineWidth = isSelected ? 5.0 : 3.5;
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.stroke();

          ctx.fillStyle = isSelected ? '#38bdf8' : '#818cf8';
          ctx.beginPath();
          ctx.arc(p1x, p1y, 7, 0, Math.PI * 2);
          ctx.arc(p2x, p2y, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px JetBrains Mono, monospace';
          ctx.fillText(`⮑ ${elem.name}`, p2x - 30, p2y - 6);
        }

        // F. NO PARKING / STOPPING ZONE (Знак 3.27)
        else if (elem.type === 'no_parking_zone') {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#ef4444';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([6, 4]);
          ctx.fillRect(sx, sy, sw, sh);
          ctx.strokeRect(sx, sy, sw, sh);
          ctx.setLineDash([]);

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillText(`🚫 ЗОНА 3.27 (СТОП >10с)`, sx + 6, sy + 16);
        }

        // G. SPEED RADAR ZONE (Фоторадар)
        else if (elem.type === 'speed_radar_zone') {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.10)';
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#eab308';
          ctx.lineWidth = 2.0;
          ctx.fillRect(sx, sy, sw, sh);
          ctx.strokeRect(sx, sy, sw, sh);

          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          ctx.fillText(`⚡ РАДАР: ЛИМИТ ${elem.speedLimitKmh || 60} КМ/Ч`, sx + 6, sy + 16);
        }
      });
    }

    // 3. Draw Tracked Objects (Clean Floating Badges with Anti-Overlap HUD & Precise Speed)
    if (showBoundingBoxes) {
      if (streamSource === 'uploaded') {
        const liveTracks = realtimeNeuralVision.getTracks();
        
        // Show badge for EVERY detected vehicle (cars, trucks, buses, motorcycles, bicycles)
        const visibleTracks = liveTracks.filter(t => t.class !== 'person');

        // Pre-compute badge dimensions & solve overlaps
        interface BadgeLayout {
          track: typeof liveTracks[0];
          centerX: number;
          baseY: number;
          rx: number;
          ry: number;
          rw: number;
          rh: number;
          badgeX: number;
          badgeY: number;
          badgeW: number;
          badgeH: number;
          fullLabel: string;
          themeColor: string;
          isViolation: boolean;
          opacity: number;
        }

        const layouts: BadgeLayout[] = visibleTracks.map(track => {
          const rx = track.renderX * width;
          const ry = track.renderY * height;
          const rw = track.renderW * width;
          const rh = track.renderH * height;

          const centerX = rx + rw / 2;
          const baseY = ry + rh;

          const isViolation = Boolean(track.hasCrossedSolidLine || track.hasTriggeredRedLight);
          const themeColor = isViolation ? '#ef4444' : (track.color || '#38bdf8');

          const speedFormatted = track.speedKmh <= 0.4 ? '0 км/ч' : `${Math.round(track.speedKmh)} км/ч`;
          const speedText = showSpeedRadar ? ` | ${speedFormatted}` : '';
          const statusText = track.hasCrossedSolidLine ? ' • СПЛОШНАЯ 1.1' : track.hasTriggeredRedLight ? ' • КРАСНЫЙ СВЕТ' : '';
          const fullLabel = `${track.labelRu} #${track.id}${speedText}${statusText}`;

          ctx.font = 'bold 10px JetBrains Mono, monospace';
          const textMetrics = ctx.measureText(fullLabel);
          const badgeW = textMetrics.width + 16;
          const badgeH = 20;
          let badgeX = Math.max(6, Math.min(width - badgeW - 6, centerX - badgeW / 2));
          let badgeY = ry > 24 ? ry - 14 : ry + rh + 8;

          const opacity = Math.max(0.65, 1.0 - (track.missedFrames / 25));

          return {
            track,
            centerX,
            baseY,
            rx,
            ry,
            rw,
            rh,
            badgeX,
            badgeY,
            badgeW,
            badgeH,
            fullLabel,
            themeColor,
            isViolation,
            opacity
          };
        });

        // Anti-collision adjustment for overlapping badges
        for (let i = 0; i < layouts.length; i++) {
          for (let j = i + 1; j < layouts.length; j++) {
            const b1 = layouts[i];
            const b2 = layouts[j];
            const overlapX = Math.abs(b1.badgeX - b2.badgeX) < (b1.badgeW / 2 + b2.badgeW / 2);
            const overlapY = Math.abs(b1.badgeY - b2.badgeY) < b1.badgeH + 4;
            if (overlapX && overlapY) {
              // Shift the higher one up or lower one down
              if (b1.badgeY <= b2.badgeY) {
                b1.badgeY = Math.max(6, b1.badgeY - (b1.badgeH + 4));
              } else {
                b2.badgeY = Math.max(6, b2.badgeY - (b2.badgeH + 4));
              }
            }
          }
        }

        // Render all resolved badges
        layouts.forEach(l => {
          ctx.save();
          ctx.globalAlpha = l.opacity;

          // A. Contact Ground Pinpoint (Anchor Marker at wheels / ground base)
          ctx.beginPath();
          ctx.arc(l.centerX, l.baseY, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = l.themeColor;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // B. Connector Line from anchor to badge
          ctx.beginPath();
          ctx.moveTo(l.centerX, l.baseY);
          ctx.lineTo(l.badgeX + l.badgeW / 2, l.badgeY + l.badgeH);
          ctx.strokeStyle = l.isViolation ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);

          // C. Dark Floating Pill Container
          ctx.fillStyle = l.isViolation ? (isFlashActive ? 'rgba(239, 68, 68, 0.95)' : 'rgba(185, 28, 28, 0.95)') : 'rgba(15, 23, 42, 0.94)';
          ctx.beginPath();
          ctx.roundRect(l.badgeX, l.badgeY, l.badgeW, l.badgeH, 4);
          ctx.fill();

          ctx.strokeStyle = l.isViolation ? '#ffffff' : l.themeColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // D. Text Render
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText(l.fullLabel, l.badgeX + 8, l.badgeY + 14);

          ctx.restore();
        });
      } else {
        simVehiclesRef.current.forEach(veh => {
          const px = veh.x * width;
          const py = veh.y * height;
          const pw = veh.w * width;
          const ph = veh.h * height;

          const centerX = px + pw / 2;
          const isViolation = veh.hasCrossedSolid || veh.hasViolatedRed;
          const themeColor = isViolation ? '#ef4444' : veh.color;

          if (veh.type !== 'pedestrian') {
            // Realistic Soft Ground Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
            ctx.beginPath();
            ctx.ellipse(centerX, py + ph * 0.95, pw * 0.55, ph * 0.18, 0, 0, Math.PI * 2);
            ctx.fill();

            // Vehicle Body Render (Graphic without enclosing box)
            ctx.fillStyle = veh.color;
            ctx.beginPath();
            ctx.roundRect(px, py, pw, ph, 5);
            ctx.fill();

            // Windshield & Lights
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.roundRect(px + pw * 0.15, py + ph * 0.20, pw * 0.70, ph * 0.35, 3);
            ctx.fill();

            ctx.fillStyle = '#fef08a';
            ctx.fillRect(px + pw * 0.10, py + ph * 0.05, pw * 0.20, ph * 0.08);
            ctx.fillRect(px + pw * 0.70, py + ph * 0.05, pw * 0.20, ph * 0.08);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px + pw * 0.10, py + ph * 0.88, pw * 0.22, ph * 0.08);
            ctx.fillRect(px + pw * 0.68, py + ph * 0.88, pw * 0.22, ph * 0.08);

            // Clean Floating Label Above Vehicle (No BBox)
            const speedFormatted = veh.speedKmh <= 0.4 ? '0 км/ч (СТОИТ)' : `${Math.round(veh.speedKmh)} км/ч`;
            const statusTag = veh.hasCrossedSolid ? '• СПЛОШНАЯ 1.1' : veh.hasViolatedRed ? '• КРАСНЫЙ СВЕТ' : speedFormatted;
            const fullTag = `${veh.labelRu} #${veh.id} | ${statusTag}`;

            ctx.font = 'bold 9px JetBrains Mono, monospace';
            const metrics = ctx.measureText(fullTag);
            const tagW = metrics.width + 14;
            const tagH = 18;
            const tagX = Math.max(6, Math.min(width - tagW - 6, centerX - tagW / 2));
            const tagY = Math.max(6, py - 12);

            ctx.fillStyle = isViolation ? (isFlashActive ? '#ef4444' : '#b91c1c') : 'rgba(15, 23, 42, 0.94)';
            ctx.beginPath();
            ctx.roundRect(tagX, tagY, tagW, tagH, 4);
            ctx.fill();

            ctx.strokeStyle = isViolation ? '#ffffff' : themeColor;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.fillText(fullTag, tagX + 7, tagY + 12);
          } else {
            // Pedestrian Graphic (Clean visual without floating speed tag)
            ctx.fillStyle = '#84cc16';
            ctx.beginPath();
            ctx.arc(centerX, py + ph * 0.3, pw * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(px + pw * 0.25, py + ph * 0.35, pw * 0.5, ph * 0.65);
          }
        });
      }
    }

    // 4. Draw Interactive ROI Selection Rectangle (When User is Drawing Traffic Light)
    if (isDrawingROI && roiStart && roiCurrent) {
      const rx1 = Math.min(roiStart.x, roiCurrent.x) * width;
      const ry1 = Math.min(roiStart.y, roiCurrent.y) * height;
      const rw = Math.abs(roiCurrent.x - roiStart.x) * width;
      const rh = Math.abs(roiCurrent.y - roiStart.y) * height;

      // Semi-transparent selection fill
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.fillRect(rx1, ry1, rw, rh);

      // Glowing animated dashed stroke
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(rx1, ry1, rw, rh);
      ctx.setLineDash([]);

      // Corner reticles
      const cornerLen = Math.min(12, Math.min(rw / 2, rh / 2));
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(rx1, ry1 + cornerLen);
      ctx.lineTo(rx1, ry1);
      ctx.lineTo(rx1 + cornerLen, ry1);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(rx1 + rw - cornerLen, ry1);
      ctx.lineTo(rx1 + rw, ry1);
      ctx.lineTo(rx1 + rw, ry1 + cornerLen);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(rx1 + rw, ry1 + rh - cornerLen);
      ctx.lineTo(rx1 + rw, ry1 + rh);
      ctx.lineTo(rx1 + rw - cornerLen, ry1 + rh);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(rx1 + cornerLen, ry1 + rh);
      ctx.lineTo(rx1, ry1 + rh);
      ctx.lineTo(rx1, ry1 + rh - cornerLen);
      ctx.stroke();

      // Tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(rx1, Math.max(4, ry1 - 22), 190, 20);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx1, Math.max(4, ry1 - 22), 190, 20);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText('🎯 ВЫДЕЛЕНИЕ СВЕТОФОРА (ROI)', rx1 + 6, Math.max(4, ry1 - 22) + 14);
    }

    // 5. Telemetry Header
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.fillRect(12, 12, 310, 26);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, 310, 26);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    const accentSignalsCount = roadElements.filter(e => e.isAccent && e.enabled).length;
    const accentInfo = accentSignalsCount > 0 ? ` [${accentSignalsCount} АКЦЕНТ-ROI]` : '';
    ctx.fillText(`⚡ VISIONFORCE: ${roadElements.length} ОБЪЕКТОВ${accentInfo}`, 20, 29);

  }, [streamSource, showBoundingBoxes, showTrajectories, showSpeedRadar, showInfrastructureOverlay, roadElements, selectedElementId, hoveredElementId, trafficSignalPhase, autoCycleTimeSec, violationsList, isDrawingROI, roiStart, roiCurrent]);

  const selectedElement = useMemo(() => {
    return roadElements.find(e => e.id === selectedElementId) || null;
  }, [roadElements, selectedElementId]);

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
              <span>{lang === 'ru' ? 'Интерактивный конструктор дорожной инфраструктуры & ПДД-контроль' : 'Traffic Infrastructure & Enforcement Studio'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                DYNAMIC 60FPS
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {lang === 'ru'
                ? 'Полностью автоматическое распознавание Computer Vision или ручная расстановка светофоров, стоп-линий и разметки.'
                : '100% automated Computer Vision detection or manual drag & drop for traffic lights, stop lines, and lanes.'}
            </p>
          </div>
        </div>

        {/* Source Mode Switcher, 1-Click CV Auto Calibration, ROI Traffic Light Tool & Upload */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* ROI Traffic Light Drawing Button */}
          <button
            onClick={() => {
              setIsDrawingROI(prev => !prev);
              setRoiType('traffic_light_auto');
              if (!isDrawingROI) {
                setJumpNotice('🎯 Режим обведения светофора: кликните и протяните рамку вокруг светофора на видео.');
                setTimeout(() => setJumpNotice(null), 4000);
              }
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
              isDrawingROI
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 shadow-amber-400/40 animate-pulse'
                : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border-indigo-500/50 hover:text-white'
            }`}
            title="Нажмите, затем обведите светофор на экране для оптического распознавания цветов с акцентом"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isDrawingROI ? '🎯 Обведите светофор...' : '🎯 Обвести светофор (ROI)'}</span>
          </button>

          {/* 1-Click Master CV Auto Calibration Button */}
          <button
            onClick={handleAutoCalibrateAll}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
            title="Алгоритмы компьютерного зрения сканируют сцену и расставляют светофоры, стоп-линии и разметку"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{lang === 'ru' ? '⚡ Авто-CV расстановка' : '⚡ 1-Click CV Auto'}</span>
          </button>

          <button
            onClick={() => setIsPaletteOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isPaletteOpen
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isPaletteOpen ? 'Скрыть палитру' : 'Палитра объектов'}</span>
          </button>

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => {
                setStreamSource('simulator');
                if (roadElements.length === 0) {
                  const autoElems = realtimeNeuralVision.autoDetectAllInfrastructure();
                  setRoadElements(autoElems);
                  setActivePreset('standard_intersection');
                }
              }}
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
              <span>{uploadedFileName ? 'MP4: ' + uploadedFileName.slice(0, 14) + '...' : (lang === 'ru' ? 'Загрузить MP4' : 'Upload MP4')}</span>
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ROAD INFRASTRUCTURE OBJECTS PALETTE TOOLBOX (ОКОШКО С ОБЪЕКТАМИ) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isPaletteOpen && (
        <div className="bg-slate-900 border border-cyan-500/40 rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                {lang === 'ru' ? 'Дорожная инфраструктура & Готовые шаблоны сцен' : 'Infrastructure & Automated Scene Presets'}
              </h2>
            </div>
            
            {/* Quick Scene Presets Selector */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <span className="text-slate-400 font-sans text-xs mr-1">Пресеты:</span>
              <button
                onClick={handleClearAllRoadElements}
                className={`px-2 py-1 rounded border transition-colors cursor-pointer text-xs ${
                  activePreset === 'empty' || roadElements.length === 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Очистить все дорожные элементы с холста"
              >
                🧹 Чистый холст
              </button>
              <button
                onClick={() => handleApplyPreset('standard_intersection', 'Классический 4-полосный перекресток')}
                className={`px-2 py-1 rounded border transition-colors cursor-pointer text-xs ${
                  activePreset === 'standard_intersection'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🚦 Перекресток 4-полосный
              </button>
              <button
                onClick={() => handleApplyPreset('t_junction_arrow', 'Т-образный перекресток со стрелкой')}
                className={`px-2 py-1 rounded border transition-colors cursor-pointer text-xs ${
                  activePreset === 't_junction_arrow'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🔀 Т-образный (Стрелка)
              </button>
              <button
                onClick={() => handleApplyPreset('highway_radar', 'Скоростная трасса (Радар 70 км/ч)')}
                className={`px-2 py-1 rounded border transition-colors cursor-pointer text-xs ${
                  activePreset === 'highway_radar'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🛣️ Трасса (Радар 70)
              </button>
              <button
                onClick={() => handleApplyPreset('pedestrian_focus', 'Пешеходная зона / Зебра (30 км/ч)')}
                className={`px-2 py-1 rounded border transition-colors cursor-pointer text-xs ${
                  activePreset === 'pedestrian_focus'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                🚶 Школа / Переход
              </button>
              
              {/* Master Violation Enforcement Toggle */}
              <button
                onClick={toggleEnforcement}
                className={`ml-2 px-2.5 py-1 rounded border transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                  isEnforcementActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                }`}
                title="Включение / отключение автоматической фиксации нарушений ПДД"
              >
                <span>{isEnforcementActive ? '⚡ Фиксация: ВКЛ' : '⏸️ Фиксация: ВЫКЛ'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-9 gap-2.5">
            {/* 0. ИНТЕРАКТИВНОЕ ОБВЕДЕНИЕ СВЕТОФОРА (ROI) */}
            <div
              onClick={() => {
                setIsDrawingROI(true);
                setRoiType('traffic_light_auto');
                setJumpNotice('🎯 Зажмите левую кнопку мыши и обведите светофор на видео');
                setTimeout(() => setJumpNotice(null), 3500);
              }}
              className={`p-2.5 bg-indigo-950/70 hover:bg-indigo-900/60 border rounded-lg cursor-pointer transition-all flex flex-col items-center text-center group shadow-md ${
                isDrawingROI ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-indigo-500/40 hover:border-indigo-400'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 group-hover:scale-110 transition-transform mb-1.5">
                <Crosshair className="w-4 h-4 animate-spin text-amber-300" />
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-amber-300">Обвести светофор</div>
              <div className="text-[9px] text-indigo-300 font-mono">Акцент (ROI)</div>
              <div className="mt-1.5 text-[9px] text-amber-300 font-mono bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                {isDrawingROI ? 'Активно...' : '🎯 Выделить'}
              </div>
            </div>

            {/* 1. Авто-светофор 3-секционный */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'traffic_light_auto')}
              onClick={() => handleAddElementFromPalette('traffic_light_auto')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform mb-1.5">
                <CircleDot className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Авто-светофор</div>
              <div className="text-[9px] text-slate-400 font-mono">3 секции (🔴🟡🟢)</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>

            {/* 2. Пешеходный светофор 2-секционный */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'traffic_light_pedestrian')}
              onClick={() => handleAddElementFromPalette('traffic_light_pedestrian')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform mb-1.5">
                <span className="text-xs">🚶</span>
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Пеш-светофор</div>
              <div className="text-[9px] text-slate-400 font-mono">2 секции (🔴🟢)</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>

            {/* 3. Стрелка поворота */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'traffic_light_arrow')}
              onClick={() => handleAddElementFromPalette('traffic_light_arrow')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform mb-1.5">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Стрелка поворота</div>
              <div className="text-[9px] text-slate-400 font-mono">Лево/Право (⬅️)</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>

            {/* 4. Стоп-линия разметки 1.12 */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'stop_line')}
              onClick={() => handleAddElementFromPalette('stop_line')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform mb-1.5">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Стоп-линия</div>
              <div className="text-[9px] text-slate-400 font-mono">Разметка 1.12</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>

            {/* 5. Пешеходный переход «Зебра» 1.14 */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'crosswalk_zone')}
              onClick={() => handleAddElementFromPalette('crosswalk_zone')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform mb-1.5">
                <span className="text-xs">🦓</span>
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Переход «Зебра»</div>
              <div className="text-[9px] text-slate-400 font-mono">Разметка 1.14</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>

            {/* 6. Сплошная линия разметки 1.1 */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'solid_line')}
              onClick={() => handleAddElementFromPalette('solid_line')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform mb-1.5">
                <span className="text-sm font-bold">┃</span>
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Сплошная линия</div>
              <div className="text-[9px] text-slate-400 font-mono">Разметка 1.1</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>

            {/* 7. Зона запрета остановки 3.27 */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'no_parking_zone')}
              onClick={() => handleAddElementFromPalette('no_parking_zone')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform mb-1.5">
                <span className="text-xs">🚫</span>
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Зона 3.27</div>
              <div className="text-[9px] text-slate-400 font-mono">Стоп &gt;10 сек</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>

            {/* 8. Фоторадар контроля скорости */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'speed_radar_zone')}
              onClick={() => handleAddElementFromPalette('speed_radar_zone')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform mb-1.5">
                <Gauge className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">Фоторадар</div>
              <div className="text-[9px] text-slate-400 font-mono">Лимит 60 км/ч</div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                + Добавить
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Grid: Video Viewport (8 cols) & Infrastructure Inspector (4 cols) */}
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
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  (Кадр #{Math.floor(currentTime * 25)})
                </span>
              </div>

              {/* Traffic Light Quick Phase Buttons */}
              <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 font-mono text-[10px]">
                <span className="text-slate-400 font-sans font-bold">Фаза:</span>
                <button
                  onClick={() => handleManualSignalPhase('AUTO')}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                    trafficSignalPhase === 'AUTO'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Авто-цикл: 12с зеленый / 3с желтый / 10с красный"
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
                    checked={showInfrastructureOverlay}
                    onChange={(e) => setShowInfrastructureOverlay(e.target.checked)}
                    className="accent-indigo-400 w-3 h-3 rounded cursor-pointer"
                  />
                  <span className="text-indigo-300 font-bold">Инфраструктура</span>
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
                  onSeeked={() => renderCanvas()}
                  onTimeUpdate={(e) => {
                    const t = (e.target as HTMLVideoElement).currentTime;
                    currentTimeRef.current = t;
                  }}
                  onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 60)}
                  className="w-full h-full object-contain pointer-events-none"
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
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
                className="absolute inset-0 w-full h-full cursor-crosshair"
              />

              {/* ROI Drawing Mode Active Notification Banner */}
              {isDrawingROI && (
                <div className="absolute top-3 left-3 right-3 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-between shadow-2xl backdrop-blur border border-amber-300 animate-in fade-in slide-in-from-top-2 z-30">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 animate-spin" />
                    <span>🎯 РЕЖИМ ОБВЕДЕНИЯ: Зажмите левую кнопку мыши и протяните рамку вокруг светофора на видео</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsDrawingROI(false);
                      setRoiStart(null);
                      setRoiCurrent(null);
                    }}
                    className="px-2 py-0.5 bg-slate-950 text-amber-300 rounded text-[10px] font-mono hover:bg-slate-900 cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              )}

              {/* Helper Drag Overlay Info */}
              <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-lg text-[10px] text-cyan-300 flex items-center gap-2 select-none pointer-events-none shadow-xl">
                <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                <span>Горячие клавиши: [Пробел] Плей/Пауза, [&lt;] / [&gt;] Покадровая перемотка (1 кадр) • Квадратики скрыты, активны метки скорости</span>
              </div>
            </div>

            {/* Enhanced Playback Controls & Frame-by-Frame Timeline Bar */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2.5">
              {/* Top Row: Responsive Scrubbing Timeline Slider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={duration || 60}
                    step={0.04}
                    value={currentTime}
                    onChange={(e) => handleSeek(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 bg-slate-800 h-2 rounded-lg cursor-pointer transition-all"
                  />
                </div>

                <div className="font-mono text-xs text-cyan-400 font-bold shrink-0 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{currentTime.toFixed(2)}с / {(duration || 60).toFixed(1)}с</span>
                  <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-2">
                    #{Math.floor(currentTime * 25)}
                  </span>
                </div>
              </div>

              {/* Bottom Row: Frame-by-Frame Step Controls & Playback */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                {/* Left: Play/Pause, Frame Stepping Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center font-bold transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                    title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>

                  <button
                    onClick={handleReset}
                    className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                    title="Сброс таймкода к началу 0.00с (Home)"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <div className="h-5 w-px bg-slate-800 mx-1"></div>

                  {/* Frame-by-Frame Backward / Forward (0.04s per frame @ 25fps) */}
                  <button
                    onClick={() => handleStepFrame(-1)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 text-slate-200 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Шаг назад на 1 кадр (0.04с / Клавиша '<')"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                    <span>-1 кадр</span>
                  </button>

                  <button
                    onClick={() => handleStepFrame(1)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 text-slate-200 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Шаг вперед на 1 кадр (0.04с / Клавиша '>')"
                  >
                    <span>+1 кадр</span>
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>

                  {/* 5-second Jump Buttons */}
                  <button
                    onClick={() => handleStepSeconds(-5)}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-mono transition-colors cursor-pointer hidden sm:flex items-center gap-1"
                    title="Назад на 5 секунд (Shift + Left)"
                  >
                    <Rewind className="w-3 h-3" />
                    <span>-5с</span>
                  </button>

                  <button
                    onClick={() => handleStepSeconds(5)}
                    className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-mono transition-colors cursor-pointer hidden sm:flex items-center gap-1"
                    title="Вперед на 5 секунд (Shift + Right)"
                  >
                    <span>+5с</span>
                    <FastForward className="w-3 h-3" />
                  </button>
                </div>

                {/* Right: Playback Speed & Shortcuts Helper */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md px-1.5 py-0.5 text-xs font-mono">
                    <span className="text-slate-500 mr-1.5 text-[11px]">Скорость:</span>
                    {[0.25, 0.5, 1.0, 2.0].map(spd => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          playbackSpeed === spd ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setIsShortcutsOpen(true)}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded-md border border-slate-800 transition-colors cursor-pointer"
                    title="Горячие клавиши"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Road Object Inspector & Calibration Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {selectedElement ? 'Свойства объекта' : 'Инспектор инфраструктуры'}
                </h3>
              </div>
              {selectedElement && (
                <button
                  onClick={() => setSelectedElementId(null)}
                  className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                >
                  Снять выбор
                </button>
              )}
            </div>

            {selectedElement ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{selectedElement.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      {selectedElement.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-400">
                    <div>X: {(selectedElement.x * 100).toFixed(1)}%</div>
                    <div>Y: {(selectedElement.y * 100).toFixed(1)}%</div>
                    <div>Ширина: {(selectedElement.w * 100).toFixed(1)}%</div>
                    <div>Высота: {(selectedElement.h * 100).toFixed(1)}%</div>
                  </div>
                </div>

                {/* State Override if Traffic Light */}
                {(selectedElement.type === 'traffic_light_auto' || selectedElement.type === 'traffic_light_pedestrian') && (
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[11px] font-bold">Оптический режим / Фаза:</label>
                    <div className="grid grid-cols-4 gap-1 font-mono text-[11px]">
                      {(['AUTO', 'RED', 'YELLOW', 'GREEN'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => {
                            realtimeNeuralVision.setElementOverride(selectedElement.id, mode);
                            setRoadElements([...realtimeNeuralVision.getRoadElements()]);
                          }}
                          className={`py-1.5 rounded text-center transition-colors cursor-pointer border ${
                            selectedElement.manualOverride === mode
                              ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {mode === 'AUTO' ? 'Оптика' : mode === 'RED' ? '🔴 Красный' : mode === 'YELLOW' ? '🟡 Желтый' : '🟢 Зеленый'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direction Phase Assignment */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[11px] font-bold">Привязка к фазе перекрестка:</label>
                  <select
                    value={selectedElement.direction}
                    onChange={(e) => {
                      realtimeNeuralVision.updateRoadElement(selectedElement.id, { direction: e.target.value as any });
                      setRoadElements([...realtimeNeuralVision.getRoadElements()]);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                  >
                    <option value="MAIN_DIRECTION">Главное направление (Main Phase)</option>
                    <option value="CROSS_DIRECTION">Поперечное направление (Cross Phase)</option>
                    <option value="LEFT_TURN_PHASE">Левоповоротная секция (Left Turn)</option>
                    <option value="PEDESTRIAN_PHASE">Пешеходная фаза (Crosswalk Phase)</option>
                  </select>
                </div>

                {/* Speed Limit if Radar */}
                {selectedElement.type === 'speed_radar_zone' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Лимит скорости:</span>
                      <span className="text-yellow-400 font-bold font-mono">{selectedElement.speedLimitKmh || 60} км/ч</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={110}
                      step={5}
                      value={selectedElement.speedLimitKmh || 60}
                      onChange={(e) => {
                        realtimeNeuralVision.updateRoadElement(selectedElement.id, { speedLimitKmh: parseInt(e.target.value, 10) });
                        setRoadElements([...realtimeNeuralVision.getRoadElements()]);
                      }}
                      className="w-full accent-yellow-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                {/* Action Buttons: Duplicate & Delete */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => handleDuplicateElement(selectedElement.id)}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Дублировать</span>
                  </button>
                  <button
                    onClick={() => handleDeleteElement(selectedElement.id)}
                    className="py-2 px-3 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-500/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span>Интерактивная расстановка</span>
                  </div>
                  <p>
                    Перетаскивайте любые элементы из верхней палитры на видео. Система динамически учитывает их положение для детекции нарушений по статьям 128, 128-4, 138 КоАО РУз.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">Список активных объектов:</span>
                    <button
                      onClick={() => {
                        setIsDrawingROI(true);
                        setRoiType('traffic_light_auto');
                      }}
                      className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer font-bold"
                    >
                      <Crosshair className="w-3 h-3 animate-spin" />
                      <span>+ Обвести светофор</span>
                    </button>
                  </div>

                  {/* Accented Traffic Lights Live Status Box */}
                  {roadElements.some(e => e.isAccent && e.enabled) && (
                    <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/40 rounded-lg space-y-2 mb-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Акцентные светофоры (ROI)</span>
                        </span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {roadElements.filter(e => e.isAccent && e.enabled).length} зоны
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {roadElements.filter(e => e.isAccent && e.enabled).map(acc => (
                          <div
                            key={acc.id}
                            onClick={() => setSelectedElementId(acc.id)}
                            className="p-2 bg-slate-950/80 rounded border border-slate-800 hover:border-indigo-400 cursor-pointer space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: acc.colorHex }}></span>
                                <span>{acc.name}</span>
                              </span>
                              <span className="font-mono font-bold text-[10px]" style={{ color: acc.colorHex }}>
                                {acc.state === 'RED' ? '🔴 КРАСНЫЙ' : acc.state === 'YELLOW' ? '🟡 ЖЕЛТЫЙ' : '🟢 ЗЕЛЕНЫЙ'}
                              </span>
                            </div>

                            {/* Live Optical Lamp Intensity Bars */}
                            {acc.lampValues && (
                              <div className="grid grid-cols-3 gap-1 pt-1 font-mono text-[9px] text-slate-400">
                                <div className="flex flex-col">
                                  <span>Красный: {acc.lampValues.red}</span>
                                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                                    <div className="bg-red-500 h-full" style={{ width: `${Math.min(100, acc.lampValues.red)}%` }}></div>
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <span>Желтый: {acc.lampValues.yellow}</span>
                                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                                    <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, acc.lampValues.yellow * 2)}%` }}></div>
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <span>Зеленый: {acc.lampValues.green}</span>
                                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                                    <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, acc.lampValues.green)}%` }}></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {roadElements.map(el => (
                      <div
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`p-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          selectedElementId === el.id
                            ? 'bg-cyan-950/50 border-cyan-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: el.colorHex }}></span>
                          <span className="font-medium">{el.name}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Jump Notice */}
      {jumpNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-950 border border-cyan-500 text-cyan-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <Crosshair className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-xs font-mono font-bold">{jumpNotice}</span>
        </div>
      )}

      {/* SECTION 1: Dynamic Violations Table with Official Fine Registry */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{lang === 'ru' ? 'Реестр зафиксированных нарушений ПДД (КоАО РУз)' : 'Violation Registry & Legal Protocols'}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                violationsList.length > 0
                  ? 'bg-red-500/20 text-red-300 border-red-500/30 font-bold'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {violationsList.length > 0 ? `ФИКСАЦИЯ: ${violationsList.length}` : 'МОНИТОРИНГ: НЕТ НАРУШЕНИЙ'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'ru'
                ? 'Нажмите на строку нарушения для мгновенного перехода видео (Click-to-Jump) или генерации протокола МВД.'
                : 'Click any violation to seek video playback or print the official fine ticket.'}
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
                  <span>Экспорт JSON</span>
                </button>
              </>
            )}

            <span className="text-slate-400 ml-1">Таймкод:</span>
            <span className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-cyan-400 font-bold">
              {currentTime.toFixed(2)}с
            </span>
          </div>
        </div>

        {/* Violations Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          {[
            { id: 'all', label: `Все (${violationsList.length})` },
            { id: 'solid', label: 'Сплошная 1.1' },
            { id: 'red', label: 'Красный свет' },
            { id: 'jay', label: 'Пешеход' },
            { id: 'speed', label: 'Скорость' },
            { id: 'hazard', label: 'TTC < 2.0с' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedViolationCategory(tab.id)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selectedViolationCategory === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Violations Table */}
        {violationsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] bg-slate-950/60">
                  <th className="py-2.5 px-3">Таймкод</th>
                  <th className="py-2.5 px-3">Госномер (ANPR)</th>
                  <th className="py-2.5 px-3">Тип инцидента</th>
                  <th className="py-2.5 px-3">Квалификация (КоАО РУз)</th>
                  <th className="py-2.5 px-3">Сумма штрафа</th>
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
                      <td className="py-3 px-3 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white font-bold text-[11px]">
                          {viol.licensePlate}
                        </span>
                        <div className="text-[10px] text-slate-400 font-sans mt-0.5">{viol.vehicleType}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {lang === 'ru' ? viol.labelRu : viol.labelEn}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{viol.description}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-300 font-medium">{viol.codeArticle}</div>
                        <div className="text-[10px] text-slate-400">{viol.fineBrv}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-emerald-400">{viol.fineUzs}</div>
                        <div className="text-[10px] text-slate-500">Городской бюджет</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveProtocolItem(viol);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950/80 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Протокол
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSeek(viol.start, viol.labelRu);
                            }}
                            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs font-mono flex items-center gap-1 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                          >
                            <Target className="w-3 h-3" />
                            <span>Перейти</span>
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
                    Все размещенные дорожные объекты (светофоры, стоп-линии, радары, разметка 1.1) контролируют поток в реальном времени.
                  </p>
                </div>
              </div>

              {/* Quick Test Incident Simulations */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                <span className="text-slate-500 text-[10px] mr-1">Тест правил:</span>
                <button
                  onClick={() => handleSimulateViolation('solid_line_crossing')}
                  className="px-2 py-1 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/30 rounded-md transition-colors cursor-pointer"
                >
                  ⚡ Сплошная
                </button>
                <button
                  onClick={() => handleSimulateViolation('red_light')}
                  className="px-2 py-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 rounded-md transition-colors cursor-pointer"
                >
                  🔴 Красный
                </button>
                <button
                  onClick={() => handleSimulateViolation('jaywalking')}
                  className="px-2 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-500/30 rounded-md transition-colors cursor-pointer"
                >
                  🚶 Пешеход
                </button>
                <button
                  onClick={() => handleSimulateViolation('near_miss')}
                  className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 rounded-md transition-colors cursor-pointer"
                >
                  ⚠️ TTC &lt; 2.0с
                </button>
                <button
                  onClick={() => handleSimulateViolation('stopped_vehicle')}
                  className="px-2 py-1 bg-orange-950/60 hover:bg-orange-900/80 text-orange-300 border border-orange-500/30 rounded-md transition-colors cursor-pointer"
                >
                  ⏱️ Стоп &gt;10с
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Official Fine Protocol Modal (Электронное постановление МВД РУз) */}
      {activeProtocolItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-6 h-6 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Постановление об административном правонарушении</h3>
                  <div className="text-[10px] text-slate-400 font-mono">СЭФП / ГУБДД МВД Республики Узбекистан</div>
                </div>
              </div>
              <button
                onClick={() => setActiveProtocolItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-sans">Госномер ТС:</span>
                <span className="text-cyan-300 font-bold px-2 py-0.5 bg-slate-900 rounded border border-slate-700">
                  {activeProtocolItem.licensePlate}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-sans">Категория ТС:</span>
                <span className="text-white">{activeProtocolItem.vehicleType}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-sans">Статья правонарушения:</span>
                <span className="text-amber-300 font-bold">{activeProtocolItem.codeArticle}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-sans">Суть нарушения:</span>
                <span className="text-slate-200 text-right font-sans max-w-[280px]">{activeProtocolItem.labelRu}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-sans">Сумма штрафа (100%):</span>
                <span className="text-emerald-400 font-bold text-sm">{activeProtocolItem.fineUzs}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-sans">Скидка 50% при оплате за 15 дней:</span>
                <span className="text-cyan-400 font-bold">
                  {(parseInt(activeProtocolItem.fineUzs.replace(/\D/g, '') || '0', 10) / 2).toLocaleString('ru-RU')} сум
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400 font-sans">Таймкод фиксации:</span>
                <span className="text-cyan-300">{activeProtocolItem.start.toFixed(1)}с – {activeProtocolItem.end.toFixed(1)}с</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Печать</span>
              </button>
              <button
                onClick={() => setActiveProtocolItem(null)}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
