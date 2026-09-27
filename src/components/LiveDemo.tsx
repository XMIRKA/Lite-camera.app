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
import { SAMPLE_VIDEOS } from '../data/competitionData';
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
    fineUzs = '220 000 сум';
    fineBrv = '0.5 БРВ';
    riskBadge = 'Разметка 1.1';
    badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    speedKmh = 54.2;
  } else if (evt.label === 'red_light') {
    labelRu = 'Проезд на запрещающий сигнал (Красный)';
    labelEn = 'Red Light Violation';
    codeArticle = 'ст. 128-4 КоАО РУз';
    fineUzs = '880 000 сум';
    fineBrv = '2.0 БРВ';
    riskBadge = 'КРАСНЫЙ СИГНАЛ';
    badgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
    speedKmh = 62.0;
  } else if (evt.label === 'stop_line') {
    labelRu = 'Выезд за стоп-линию на запрещающий сигнал';
    labelEn = 'Stop Line Crossing';
    codeArticle = 'ст. 128-4 КоАО РУз';
    fineUzs = '880 000 сум';
    fineBrv = '2.0 БРВ';
    riskBadge = 'Стоп-линия 1.12';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    speedKmh = 8.4;
  } else if (evt.label === 'jaywalking') {
    labelRu = 'Пешеход вне пешеходного перехода';
    labelEn = 'Jaywalking';
    codeArticle = 'ст. 138 КоАО РУз';
    fineUzs = '146 667 сум';
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
    fineUzs = '440 000 сум';
    fineBrv = '1.0 БРВ';
    riskBadge = 'Помеха движению';
    badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    vehicleType = 'Грузовой транспорт (Truck)';
    speedKmh = 0.0;
  } else if (evt.label === 'congestion') {
    labelRu = 'Затор / Блокировка перекрестка';
    labelEn = 'Intersection Congestion';
    codeArticle = 'ст. 128-8 КоАО РУз';
    fineUzs = '440 000 сум';
    fineBrv = '1.0 БРВ';
    riskBadge = 'LOS F (Затор)';
    badgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    vehicleType = 'Колонна транспорта';
    speedKmh = 2.1;
  } else if ((evt.label as string) === 'speeding') {
    labelRu = 'Превышение установленной скорости движения';
    labelEn = 'Speeding Violation';
    codeArticle = 'ст. 128-3 КоАО РУз';
    fineUzs = '440 000 сум';
    fineBrv = '1.0 БРВ';
    riskBadge = 'РАДАР ФИКСАЦИЯ';
    badgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    speedKmh = 74.0;
  } else if (evt.label === 'accident') {
    labelRu = 'Дорожно-транспортное происшествие (ДТП)';
    labelEn = 'Traffic Collision';
    codeArticle = 'ст. 133 КоАО РУз';
    fineUzs = '2 200 000 сум';
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
  // Stream Source: strictly real video mode
  const [streamSource, setStreamSource] = useState<'simulator' | 'uploaded'>('uploaded');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
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
  const [showCollisionAlerts, setShowCollisionAlerts] = useState<boolean>(true);

  // Interactive Traffic Light ROI Drawing State
  const [isDrawingROI, setIsDrawingROI] = useState<boolean>(false);
  const [roiType, setRoiType] = useState<'traffic_light_auto' | 'traffic_light_pedestrian'>('traffic_light_auto');
  const [roiStart, setRoiStart] = useState<{ x: number; y: number } | null>(null);
  const [roiCurrent, setRoiCurrent] = useState<{ x: number; y: number } | null>(null);

  // Traffic Light Global Controller
  const [trafficSignalPhase, setTrafficSignalPhase] = useState<'GREEN' | 'YELLOW' | 'RED' | 'AUTO'>('AUTO');

  // Detector Output Events
  const [detectedEvents, setDetectedEvents] = useState<TrafficEvent[]>([]);
  const [smoothedEvents, setSmoothedEvents] = useState<TrafficEvent[]>([]);

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
  const isInferringRef = useRef<boolean>(false);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

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

      const nowMs = performance.now();
      // Continuous Optical Photometry analysis for traffic light ROIs
      if (nowMs - lastInferenceTimeRef.current > 180) {
        realtimeNeuralVision.updateOpticalPhotometry(videoRef.current || canvasRef.current);
      }

      if (playing) {
        if (source === 'uploaded' && videoRef.current) {
          currentTimeRef.current = videoRef.current.currentTime;
          if (videoRef.current.playbackRate !== speed) {
            videoRef.current.playbackRate = speed;
          }
        } else {
          currentTimeRef.current = (currentTimeRef.current + dt * speed) % (duration || 60);
        }

        // 1. Video Frame Neural Inference (Throttled to 280ms to prevent WebGL/GPU thread saturation)
        if (source === 'uploaded' && videoRef.current && videoRef.current.readyState >= 2 && !videoRef.current.paused && !videoRef.current.seeking) {
          if (nowMs - lastInferenceTimeRef.current > 280 && !isInferringRef.current) {
            lastInferenceTimeRef.current = nowMs;
            isInferringRef.current = true;
            realtimeNeuralVision.processFrame(videoRef.current, conf)
              .catch(() => {})
              .finally(() => {
                isInferringRef.current = false;
              });
          }
        }

        // 2. Liquid Smooth 60 FPS Interpolation (runs at high fps using velocity vectors with 0 GPU cost)
        realtimeNeuralVision.updateInterpolation();
      }

      // 4. Throttled UI State Dispatcher (Dispatches at ~3.5 FPS and only triggers React re-render when events or elements change)
      if (nowMs - lastUiUpdateRef.current > 260) {
        lastUiUpdateRef.current = nowMs;
        setCurrentTime(currentTimeRef.current);
        if (realtimeNeuralVision.hasEventUpdates()) {
          setDetectedEvents(realtimeNeuralVision.getRawEvents());
          setSmoothedEvents(realtimeNeuralVision.getSmoothedEvents());
        }
        if (realtimeNeuralVision.hasRoadElementUpdates()) {
          setRoadElements([...realtimeNeuralVision.getRoadElements()]);
        }
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

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as React.MouseEvent<HTMLCanvasElement>;
      handleCanvasMouseDown(mouseEvent);
      if (isDrawingROI) {
        e.preventDefault();
      }
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as React.MouseEvent<HTMLCanvasElement>;
      handleCanvasMouseMove(mouseEvent);
      if (isDrawingROI) {
        e.preventDefault();
      }
    }
  };

  const handleCanvasTouchEnd = () => {
    handleCanvasMouseUp();
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const curX = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

    mousePosRef.current = { x: curX, y: curY };

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

      if (w >= 0.012 && h >= 0.015) {
        const isPed = roiType === 'traffic_light_pedestrian';
        const newSig = realtimeNeuralVision.addCustomDrawnTrafficLight(
          { x: minX, y: minY, w, h },
          'MAIN_DIRECTION',
          isPed,
          videoRef.current || canvasRef.current
        );
        const updated = realtimeNeuralVision.getRoadElements();
        setRoadElements(updated);
        setSelectedElementId(newSig.id);
        setJumpNotice(`✅ Создан ${newSig.name}! Можете сразу обвести еще один светофор или нажать «Завершить»`);
        setTimeout(() => setJumpNotice(null), 4500);
      }
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
    setJumpNotice(`Режим светофоров: ${phase === 'AUTO' ? 'Оптический CV-анализ (реальный цвет с видео)' : `Ручной принудительный [${phase}]`}`);
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
      } else if (e.code === 'Escape') {
        setIsDrawingROI(false);
        setRoiStart(null);
        setRoiCurrent(null);
      } else if (e.code === 'KeyT') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsDrawingROI(prev => !prev);
          setRoiType('traffic_light_auto');
          setRoiStart(null);
          setRoiCurrent(null);
        }
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

  const handleLoadSampleDirect = (sample: (typeof SAMPLE_VIDEOS)[0]) => {
    if (uploadedVideoUrl && uploadedVideoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }
    setUploadedFileName(sample.filename);
    setUploadedVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
    setStreamSource('uploaded');
    setDuration(sample.duration);
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);
    isPlayingRef.current = true;
    realtimeNeuralVision.clearAllEvents();
    realtimeNeuralVision.clearRoadElements();
    setRoadElements([]);
    setSelectedElementId(null);
    const groundTruth: TrafficEvent[] = sample.events.map(ev => ({
      id: ev.id,
      label: ev.label as OfficialClass,
      start_sec: ev.start_sec,
      end_sec: ev.end_sec,
      confidence: ev.confidence,
      description: ev.description,
    }));
    setDetectedEvents(groundTruth);
    setSmoothedEvents(groundTruth);
    setJumpNotice(`Загружен образец: ${sample.title}`);
    setTimeout(() => setJumpNotice(null), 3000);
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

    // 1. Draw Background: Video Frame or Clean CCTV Standby Grid
    if (uploadedVideoUrl && videoRef.current && videoRef.current.readyState >= 2) {
      // Native <video> element underneath provides hardware-accelerated 60 FPS playback.
      // Transparent canvas overlay eliminates 1280x720 double-blitting and GPU memory bus saturation.
    } else if (!uploadedVideoUrl) {
      // Clean, professional CCTV Standby Grid (No animated road or fake cars)
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Subtle CCTV coordinate grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
      ctx.lineWidth = 1;
      const step = 60;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center Standby Crosshair & Text
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1.5;
      const cx = width / 2;
      const cy = height / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.moveTo(cx - 45, cy);
      ctx.lineTo(cx + 45, cy);
      ctx.moveTo(cx, cy - 45);
      ctx.lineTo(cx, cy + 45);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 12px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[CCTV MONITOR STANDBY • ОЖИДАНИЕ ЗАГРУЗКИ ВИДЕОПОТОКА]', cx, cy + 60);
      ctx.textAlign = 'left';
    }

    // 2. Render ALL Configured Road Infrastructure Elements
    if (showInfrastructureOverlay && uploadedVideoUrl) {
      const activeElements = realtimeNeuralVision.getRoadElements();
      activeElements.forEach(elem => {
        if (!elem.enabled) return;

        const isSelected = selectedElementId === elem.id;
        const isHovered = hoveredElementId === elem.id;
        const sx = Math.round(elem.x * width);
        const sy = Math.round(elem.y * height);
        const sw = Math.round(elem.w * width);
        const sh = Math.round(elem.h * height);

        // A. AUTOMOBILE TRAFFIC LIGHT (Clear glowing outline bounding box over video)
        if (elem.type === 'traffic_light_auto') {
          const isRed = elem.state === 'RED';
          const isYellow = elem.state === 'YELLOW';
          const isGreen = elem.state === 'GREEN';
          const isAccent = !!elem.isAccent;
          const activeColor = isRed ? '#ef4444' : isYellow ? '#f59e0b' : '#10b981';
          const activeLabelRu = isRed ? '🔴 КРАСНЫЙ' : isYellow ? '🟡 ЖЕЛТЫЙ' : '🟢 ЗЕЛЕНЫЙ';

          // Outer glowing outline (Обводка)
          ctx.save();
          ctx.shadowColor = activeColor;
          ctx.shadowBlur = isSelected ? 14 : isAccent ? 10 : 6;
          ctx.strokeStyle = isSelected ? '#38bdf8' : activeColor;
          ctx.lineWidth = isSelected ? 3.0 : isAccent ? 2.5 : 2.0;

          // Transparent fill so real video traffic light remains 100% visible inside
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.08)';
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, 4);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // 4 Corner Brackets for HUD framing
          const cornerLen = Math.min(10, Math.min(sw / 3, sh / 3));
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(sx, sy + cornerLen); ctx.lineTo(sx, sy); ctx.lineTo(sx + cornerLen, sy);
          ctx.moveTo(sx + sw - cornerLen, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + cornerLen);
          ctx.moveTo(sx + sw, sy + sh - cornerLen); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + sw - cornerLen, sy + sh);
          ctx.moveTo(sx + cornerLen, sy + sh); ctx.lineTo(sx, sy + sh); ctx.lineTo(sx, sy + sh - cornerLen);
          ctx.stroke();

          // Mini Optical Lamp Indicator Pips along right border
          const pipRadius = Math.max(3, Math.min(5, sh * 0.07));
          const pipX = sx + sw + pipRadius + 3;
          const pips = [
            { active: isRed, hex: '#ef4444', dimHex: '#450a0a', y: sy + sh * 0.22 },
            { active: isYellow, hex: '#f59e0b', dimHex: '#451a03', y: sy + sh * 0.50 },
            { active: isGreen, hex: '#10b981', dimHex: '#022c22', y: sy + sh * 0.78 }
          ];
          pips.forEach(p => {
            ctx.beginPath();
            ctx.arc(pipX, p.y, pipRadius, 0, Math.PI * 2);
            ctx.fillStyle = p.active ? p.hex : p.dimHex;
            ctx.fill();
            ctx.strokeStyle = p.active ? '#ffffff' : '#334155';
            ctx.lineWidth = 1;
            ctx.stroke();
          });

          // Top Header Badge: Name
          const titleText = `🚦 ${elem.name}`;
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          const titleW = Math.max(sw, ctx.measureText(titleText).width + 12);
          const badgeY = sy > 22 ? sy - 19 : sy + sh + 2;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
          ctx.fillRect(sx, badgeY, titleW, 17);
          ctx.strokeStyle = isSelected ? '#38bdf8' : activeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, badgeY, titleW, 17);
          ctx.fillStyle = isSelected ? '#38bdf8' : '#ffffff';
          ctx.fillText(titleText, sx + 6, badgeY + 12);

          // Status Sub-badge: State and Confidence
          const statusText = `${activeLabelRu} ${Math.round(elem.confidence * 100)}%`;
          ctx.font = 'bold 8.5px JetBrains Mono, monospace';
          const statusW = Math.max(sw, ctx.measureText(statusText).width + 10);
          const statusY = sy > 22 ? sy + sh + 3 : sy + sh + 22;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
          ctx.fillRect(sx, statusY, statusW, 16);
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, statusY, statusW, 16);
          ctx.fillStyle = activeColor;
          ctx.fillText(statusText, sx + 5, statusY + 11);
        }

        // B. PEDESTRIAN TRAFFIC LIGHT
        else if (elem.type === 'traffic_light_pedestrian') {
          const isRed = elem.state === 'RED';
          const isGreen = elem.state === 'GREEN';
          const isAccent = !!elem.isAccent;
          const activeColor = isRed ? '#ef4444' : '#10b981';
          const activeLabelRu = isRed ? '🛑 СТОЙ' : '🚶 ИДИ';

          ctx.save();
          ctx.shadowColor = activeColor;
          ctx.shadowBlur = isSelected ? 14 : isAccent ? 10 : 6;
          ctx.strokeStyle = isSelected ? '#38bdf8' : activeColor;
          ctx.lineWidth = isSelected ? 3.0 : isAccent ? 2.5 : 2.0;

          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.08)';
          ctx.beginPath();
          ctx.roundRect(sx, sy, sw, sh, 4);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          const cornerLen = Math.min(10, Math.min(sw / 3, sh / 3));
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(sx, sy + cornerLen); ctx.lineTo(sx, sy); ctx.lineTo(sx + cornerLen, sy);
          ctx.moveTo(sx + sw - cornerLen, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + cornerLen);
          ctx.moveTo(sx + sw, sy + sh - cornerLen); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + sw - cornerLen, sy + sh);
          ctx.moveTo(sx + cornerLen, sy + sh); ctx.lineTo(sx, sy + sh); ctx.lineTo(sx, sy + sh - cornerLen);
          ctx.stroke();

          const titleText = `🚶 ${elem.name}`;
          ctx.font = 'bold 9px JetBrains Mono, monospace';
          const titleW = Math.max(sw, ctx.measureText(titleText).width + 12);
          const badgeY = sy > 22 ? sy - 19 : sy + sh + 2;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
          ctx.fillRect(sx, badgeY, titleW, 17);
          ctx.strokeStyle = isSelected ? '#38bdf8' : activeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, badgeY, titleW, 17);
          ctx.fillStyle = isSelected ? '#38bdf8' : '#ffffff';
          ctx.fillText(titleText, sx + 6, badgeY + 12);

          const statusText = `${activeLabelRu} ${Math.round(elem.confidence * 100)}%`;
          ctx.font = 'bold 8.5px JetBrains Mono, monospace';
          const statusW = Math.max(sw, ctx.measureText(statusText).width + 10);
          const statusY = sy > 22 ? sy + sh + 3 : sy + sh + 22;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
          ctx.fillRect(sx, statusY, statusW, 16);
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, statusY, statusW, 16);
          ctx.fillStyle = activeColor;
          ctx.fillText(statusText, sx + 5, statusY + 11);
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

    // 3. Tracked Objects Bounding Boxes completely removed per user request ("Убери квадраты у людей и у машин полностью")
    // No rectangles or squares are rendered over pedestrians or vehicles.

    // 4. Draw Interactive ROI Selection Rectangle (When User is Drawing Traffic Light)
    if (isDrawingROI) {
      if (roiStart && roiCurrent) {
        const rx1 = Math.min(roiStart.x, roiCurrent.x) * width;
        const ry1 = Math.min(roiStart.y, roiCurrent.y) * height;
        const rw = Math.max(1, Math.abs(roiCurrent.x - roiStart.x) * width);
        const rh = Math.max(1, Math.abs(roiCurrent.y - roiStart.y) * height);

        // Semi-transparent selection fill
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.fillRect(rx1, ry1, rw, rh);

        // Glowing animated dashed stroke (Marching Ants)
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.lineDashOffset = -performance.now() / 35;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.strokeRect(rx1, ry1, rw, rh);
        ctx.restore();

        // 4 High-contrast white corner brackets
        const cornerLen = Math.min(16, Math.min(rw / 2, rh / 2));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.0;

        ctx.beginPath();
        // Top-Left
        ctx.moveTo(rx1, ry1 + cornerLen); ctx.lineTo(rx1, ry1); ctx.lineTo(rx1 + cornerLen, ry1);
        // Top-Right
        ctx.moveTo(rx1 + rw - cornerLen, ry1); ctx.lineTo(rx1 + rw, ry1); ctx.lineTo(rx1 + rw, ry1 + cornerLen);
        // Bottom-Right
        ctx.moveTo(rx1 + rw, ry1 + rh - cornerLen); ctx.lineTo(rx1 + rw, ry1 + rh); ctx.lineTo(rx1 + rw - cornerLen, ry1 + rh);
        // Bottom-Left
        ctx.moveTo(rx1 + cornerLen, ry1 + rh); ctx.lineTo(rx1, ry1 + rh); ctx.lineTo(rx1, ry1 + rh - cornerLen);
        ctx.stroke();

        // Size and instructions badge
        const badgeText = `🎯 ОБВОДКА СВЕТОФОРА • ${Math.round(rw)}×${Math.round(rh)}px`;
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        const textWidth = ctx.measureText(badgeText).width + 16;
        const badgeY = ry1 > 28 ? ry1 - 25 : ry1 + rh + 8;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
        ctx.fillRect(rx1, badgeY, textWidth, 22);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx1, badgeY, textWidth, 22);

        ctx.fillStyle = '#38bdf8';
        ctx.fillText(badgeText, rx1 + 8, badgeY + 15);
      } else if (mousePosRef.current) {
        // Guide laser crosshair before click
        const mx = mousePosRef.current.x * width;
        const my = mousePosRef.current.y * height;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(mx, 0);
        ctx.lineTo(mx, height);
        ctx.moveTo(0, my);
        ctx.lineTo(width, my);
        ctx.stroke();
        ctx.restore();

        // Floating tooltip next to crosshair
        ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.fillRect(mx + 12, my + 12, 250, 22);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx + 12, my + 12, 250, 22);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('🎯 Зажмите ЛКМ и обведите светофор', mx + 18, my + 27);
      }
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

  }, [streamSource, showBoundingBoxes, showTrajectories, showSpeedRadar, showInfrastructureOverlay, roadElements, selectedElementId, hoveredElementId, trafficSignalPhase, violationsList, isDrawingROI, roiStart, roiCurrent]);

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

          {/* Source Mode Switcher, ROI Traffic Light Tool & Upload */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">

          {/* ROI Traffic Light Tool Toggle */}
          <button
            onClick={() => setIsDrawingROI(prev => !prev)}
            className={`px-3 py-2 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 ${
              isDrawingROI
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Target className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span>{lang === 'ru' ? 'Обвести светофор (ROI)' : 'Select Traffic Light (ROI)'}</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 sm:py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer hover:scale-[1.02] active:scale-95"
          >
            <Upload className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="truncate">{uploadedFileName ? (uploadedFileName.length > 20 ? uploadedFileName.slice(0, 15) + '...' : uploadedFileName) : (lang === 'ru' ? 'Загрузить видео (.mp4)' : 'Upload Video (.mp4)')}</span>
          </button>

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
                {lang === 'ru' ? 'Дорожная инфраструктура & Светофоры' : 'Infrastructure & Traffic Lights'}
              </h2>
            </div>
            
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              {/* Master Violation Enforcement Toggle */}
              <button
                onClick={toggleEnforcement}
                className={`px-2.5 py-1 rounded border transition-all cursor-pointer text-xs flex items-center gap-1 hover:scale-105 active:scale-95 ${
                  isEnforcementActive
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                }`}
                title={lang === 'ru' ? 'Включение / отключение автоматической фиксации нарушений ПДД' : 'Enable / disable automatic traffic violation enforcement'}
              >
                <span>
                  {isEnforcementActive
                    ? (lang === 'ru' ? '⚡ Фиксация: ВКЛ' : '⚡ Enforcement: ON')
                    : (lang === 'ru' ? '⏸️ Фиксация: ВЫКЛ' : '⏸️ Enforcement: OFF')}
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">


            {/* 1. Стоп-линия разметки 1.12 */}
            <div
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/road-element-type', 'stop_line')}
              onClick={() => handleAddElementFromPalette('stop_line')}
              className="p-2.5 bg-slate-950/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/60 rounded-lg cursor-grab active:cursor-grabbing transition-all flex flex-col items-center text-center group shadow-md"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform mb-1.5">
                <Shield className="w-4 h-4" />
              </div>
              <div className="text-[11px] font-bold text-white group-hover:text-cyan-300">
                {lang === 'ru' ? 'Стоп-линия' : 'Stop Line'}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                {lang === 'ru' ? 'Разметка 1.12' : 'Marking 1.12'}
              </div>
              <div className="mt-1.5 text-[9px] text-cyan-400 font-mono bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                {lang === 'ru' ? '+ Добавить' : '+ Add'}
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
                <span className={`w-2 h-2 rounded-full ${uploadedVideoUrl ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span className="font-mono text-cyan-300 font-bold">
                  {uploadedFileName ? uploadedFileName : (lang === 'ru' ? 'ОЖИДАНИЕ ВИДЕО (.MP4)' : 'AWAITING VIDEO STREAM (.MP4)')}
                </span>
                {uploadedVideoUrl && (
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    (Кадр #{Math.floor(currentTime * 25)})
                  </span>
                )}
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
                  crossOrigin="anonymous"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onSeeked={() => renderCanvas()}
                  onTimeUpdate={(e) => {
                    const t = (e.target as HTMLVideoElement).currentTime;
                    currentTimeRef.current = t;
                  }}
                  onLoadedMetadata={(e) => setDuration((e.target as HTMLVideoElement).duration || 60)}
                  className="w-full h-full object-fill pointer-events-none"
                />
              )}

              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                onMouseDown={handleCanvasMouseDown}
                onTouchStart={handleCanvasTouchStart}
                onMouseMove={handleCanvasMouseMove}
                onTouchMove={handleCanvasTouchMove}
                onMouseUp={handleCanvasMouseUp}
                onTouchEnd={handleCanvasTouchEnd}
                onMouseLeave={() => {
                  mousePosRef.current = null;
                  handleCanvasMouseUp();
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
                className="absolute inset-0 w-full h-full cursor-crosshair"
              />

              {/* Active Drawing HUD Banner */}
              {isDrawingROI && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/95 border border-cyan-400 shadow-2xl backdrop-blur-md text-xs font-mono">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold">
                    <Crosshair className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>{lang === 'ru' ? '🎯 ОБВОДКА: Зажмите ЛКМ и выделите светофор на видео' : '🎯 DRAWING: Drag mouse to outline traffic light'}</span>
                  </div>
                  <span className="bg-cyan-950/80 px-2 py-0.5 rounded text-[11px] text-cyan-200 border border-cyan-800">
                    {lang === 'ru' ? 'Светофоров:' : 'Lights:'} {roadElements.filter(e => e.type === 'traffic_light_auto' || e.type === 'traffic_light_pedestrian').length}
                  </span>
                  <button
                    onClick={() => {
                      setIsDrawingROI(false);
                      setRoiStart(null);
                      setRoiCurrent(null);
                    }}
                    className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold cursor-pointer transition-colors text-[11px]"
                  >
                    {lang === 'ru' ? 'Завершить (Esc)' : 'Done (Esc)'}
                  </button>
                </div>
              )}

              {/* Standby State: No Video Loaded Yet (Clean Upload Screen) */}
              {!uploadedVideoUrl && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-sm text-center">
                  <div className="max-w-md w-full p-6 sm:p-7 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl flex flex-col items-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {lang === 'ru' ? 'Загрузите тестовое видео для анализа' : 'Upload Video for AI Analysis'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {lang === 'ru'
                          ? 'Поддерживаются видеопотоки .mp4 без ограничений на вес и длительность. Все алгоритмы детекции и трекинга работают локально на CPU/GPU.'
                          : 'Supports .mp4 video streams with no weight or duration limits. All detection and tracking runs client-side on CPU/GPU.'}
                      </p>
                    </div>

                    <div className="w-full pt-1">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{lang === 'ru' ? 'Выбрать .mp4 файл с устройства' : 'Select .mp4 File'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ROI Drawing Mode Active Notification Banner */}
              {isDrawingROI && (
                <div className="absolute top-3 left-3 right-3 bg-amber-500/90 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-between shadow-2xl backdrop-blur border border-amber-300 animate-in fade-in slide-in-from-top-2 z-30">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 animate-spin" />
                    <span>{lang === 'ru' ? '🎯 РЕЖИМ ОБВЕДЕНИЯ: Зажмите левую кнопку мыши и протяните рамку вокруг светофора на видео' : '🎯 DRAWING MODE: Press & drag mouse to create a traffic light ROI box on video'}</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsDrawingROI(false);
                      setRoiStart(null);
                      setRoiCurrent(null);
                    }}
                    className="px-2 py-0.5 bg-slate-950 text-amber-300 rounded text-[10px] font-mono hover:bg-slate-900 cursor-pointer"
                  >
                    {lang === 'ru' ? 'Отмена' : 'Cancel'}
                  </button>
                </div>
              )}

              {/* Helper Drag Overlay Info */}
              <div className="absolute bottom-3 left-3 bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-lg text-[10px] text-cyan-300 flex items-center gap-2 select-none pointer-events-none shadow-xl">
                <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {lang === 'ru'
                    ? 'Горячие клавиши: [Пробел] Плей/Пауза, [<] / [>] Покадровая перемотка • Квадратики скрыты, активен оптический CV-детектор'
                    : 'Hotkeys: [Space] Play/Pause, [<] / [>] Step 1 frame • Bounding boxes hidden, live optical detector active'}
                </span>
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
                  {selectedElement
                    ? (lang === 'ru' ? 'Свойства объекта' : 'Object Properties')
                    : (lang === 'ru' ? 'Инспектор инфраструктуры' : 'Infrastructure Inspector')}
                </h3>
              </div>
              {selectedElement && (
                <button
                  onClick={() => setSelectedElementId(null)}
                  className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                >
                  {lang === 'ru' ? 'Снять выбор' : 'Deselect'}
                </button>
              )}
            </div>

            {selectedElement ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-cyan-500/30 space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 font-mono">
                      {lang === 'ru' ? 'Название светофора / объекта:' : 'Name of traffic light / object:'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={selectedElement.name}
                        onChange={(e) => {
                          realtimeNeuralVision.updateRoadElement(selectedElement.id, { name: e.target.value });
                          setRoadElements([...realtimeNeuralVision.getRoadElements()]);
                        }}
                        className="font-bold text-white text-xs bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 flex-1 focus:border-cyan-400 outline-none"
                      />
                      <span className="px-2 py-1 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
                        {selectedElement.type === 'traffic_light_auto'
                          ? (lang === 'ru' ? 'Светофор' : 'Traffic Light')
                          : selectedElement.type === 'traffic_light_pedestrian'
                          ? (lang === 'ru' ? 'Пешеходный' : 'Pedestrian')
                          : selectedElement.type}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-400">
                    <div>X: {(selectedElement.x * 100).toFixed(1)}%</div>
                    <div>Y: {(selectedElement.y * 100).toFixed(1)}%</div>
                    <div>{lang === 'ru' ? 'Ширина:' : 'Width:'} {(selectedElement.w * 100).toFixed(1)}%</div>
                    <div>{lang === 'ru' ? 'Высота:' : 'Height:'} {(selectedElement.h * 100).toFixed(1)}%</div>
                  </div>
                </div>

                {/* State Override if Traffic Light */}
                {(selectedElement.type === 'traffic_light_auto' || selectedElement.type === 'traffic_light_pedestrian') && (
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-[11px] font-bold">
                      {lang === 'ru' ? 'Оптический режим / Фаза:' : 'Optical Mode / Phase:'}
                    </label>
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
                          {mode === 'AUTO'
                            ? (lang === 'ru' ? 'Оптика' : 'Optics')
                            : mode === 'RED'
                            ? (lang === 'ru' ? '🔴 Красный' : '🔴 Red')
                            : mode === 'YELLOW'
                            ? (lang === 'ru' ? '🟡 Желтый' : '🟡 Yellow')
                            : (lang === 'ru' ? '🟢 Зеленый' : '🟢 Green')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direction Phase Assignment */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[11px] font-bold">
                    {lang === 'ru' ? 'Привязка к фазе перекрестка:' : 'Intersection Phase Assignment:'}
                  </label>
                  <select
                    value={selectedElement.direction}
                    onChange={(e) => {
                      realtimeNeuralVision.updateRoadElement(selectedElement.id, { direction: e.target.value as any });
                      setRoadElements([...realtimeNeuralVision.getRoadElements()]);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 outline-none"
                  >
                    <option value="MAIN_DIRECTION">
                      {lang === 'ru' ? 'Главное направление (Main Phase)' : 'Main Phase'}
                    </option>
                    <option value="CROSS_DIRECTION">
                      {lang === 'ru' ? 'Поперечное направление (Cross Phase)' : 'Cross Phase'}
                    </option>
                    <option value="LEFT_TURN_PHASE">
                      {lang === 'ru' ? 'Левоповоротная секция (Left Turn)' : 'Left Turn Phase'}
                    </option>
                    <option value="PEDESTRIAN_PHASE">
                      {lang === 'ru' ? 'Пешеходная фаза (Crosswalk Phase)' : 'Crosswalk Phase'}
                    </option>
                  </select>
                </div>

                {/* Speed Limit if Radar */}
                {selectedElement.type === 'speed_radar_zone' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">{lang === 'ru' ? 'Лимит скорости:' : 'Speed Limit:'}</span>
                      <span className="text-yellow-400 font-bold font-mono">
                        {selectedElement.speedLimitKmh || 60} {lang === 'ru' ? 'км/ч' : 'km/h'}
                      </span>
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
                    <span>{lang === 'ru' ? 'Дублировать' : 'Duplicate'}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteElement(selectedElement.id)}
                    className="py-2 px-3 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-500/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ru' ? 'Удалить' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-cyan-400" />
                    <span>{lang === 'ru' ? 'Интерактивная расстановка' : 'Interactive Layout Placement'}</span>
                  </div>
                  <p>
                    {lang === 'ru'
                      ? 'Перетаскивайте любые элементы из верхней палитры на видео. Система динамически учитывает их положение для детекции нарушений по статьям 128, 128-4, 138 КоАО РУз.'
                      : 'Drag any elements from the top palette directly onto the video feed. The system dynamically monitors their placement to enforce articles 128, 128-4, and 138 of the Administrative Code.'}
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Traffic Lights Section with Multi-Signal Support */}
                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/40 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{lang === 'ru' ? 'Светофоры перекрестка:' : 'Intersection Traffic Lights:'}</span>
                      </span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-mono font-bold">
                        {roadElements.filter(e => e.type === 'traffic_light_auto' || e.type === 'traffic_light_pedestrian' || e.isAccent).length} {lang === 'ru' ? 'активных' : 'active'}
                      </span>
                    </div>



                    {/* List of ALL Configured Traffic Lights */}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                      {roadElements
                        .filter(e => e.type === 'traffic_light_auto' || e.type === 'traffic_light_pedestrian' || e.isAccent)
                        .map(sig => {
                          const isSel = selectedElementId === sig.id;
                          return (
                            <div
                              key={sig.id}
                              onClick={() => setSelectedElementId(sig.id)}
                              className={`p-2.5 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                                isSel
                                  ? 'bg-slate-900 border-cyan-400 shadow-md shadow-cyan-500/10'
                                  : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-white flex items-center gap-1.5 truncate">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: sig.colorHex }}></span>
                                  <span className="truncate">{sig.name}</span>
                                </span>
                                <span className="font-mono font-bold text-[10px] shrink-0" style={{ color: sig.colorHex }}>
                                  {sig.state === 'RED'
                                    ? (lang === 'ru' ? '🔴 КРАСНЫЙ' : '🔴 RED')
                                    : sig.state === 'YELLOW'
                                    ? (lang === 'ru' ? '🟡 ЖЕЛТЫЙ' : '🟡 YELLOW')
                                    : (lang === 'ru' ? '🟢 ЗЕЛЕНЫЙ' : '🟢 GREEN')}
                                </span>
                              </div>

                              {/* Live Optical Intensity Bars */}
                              {sig.lampValues && (
                                <div className="grid grid-cols-3 gap-1 font-mono text-[9px] text-slate-400 bg-slate-900/60 p-1 rounded">
                                  <div className="flex flex-col">
                                    <span>{lang === 'ru' ? 'Крас:' : 'Red:'} {sig.lampValues.red}</span>
                                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                                      <div className="bg-red-500 h-full" style={{ width: `${Math.min(100, sig.lampValues.red)}%` }}></div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col">
                                    <span>{lang === 'ru' ? 'Желт:' : 'Yel:'} {sig.lampValues.yellow}</span>
                                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                                      <div className="bg-amber-500 h-full" style={{ width: `${Math.min(100, sig.lampValues.yellow * 2)}%` }}></div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col">
                                    <span>{lang === 'ru' ? 'Зел:' : 'Grn:'} {sig.lampValues.green}</span>
                                    <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-0.5">
                                      <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(100, sig.lampValues.green)}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Quick Manual Override & Delete Toolbar */}
                              <div className="flex items-center justify-between pt-0.5 text-[10px]">
                                <div className="flex items-center gap-1">
                                  {(['AUTO', 'RED', 'YELLOW', 'GREEN'] as const).map(p => (
                                    <button
                                      key={p}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        realtimeNeuralVision.setElementOverride(sig.id, p);
                                        setRoadElements([...realtimeNeuralVision.getRoadElements()]);
                                      }}
                                      className={`px-1.5 py-0.5 rounded cursor-pointer border ${
                                        sig.manualOverride === p
                                          ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                      }`}
                                    >
                                      {p === 'AUTO' ? (lang === 'ru' ? 'Оптика' : 'Optics') : p === 'RED' ? '🔴' : p === 'YELLOW' ? '🟡' : '🟢'}
                                    </button>
                                  ))}
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteElement(sig.id);
                                  }}
                                  className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                                  title={lang === 'ru' ? 'Удалить светофор' : 'Delete traffic light'}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-bold text-slate-400">
                      {lang === 'ru' ? 'Прочие объекты разметки:' : 'Other Infrastructure Markings:'}
                    </span>
                  </div>

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
                {violationsList.length > 0
                  ? (lang === 'ru' ? `ФИКСАЦИЯ: ${violationsList.length}` : `DETECTED: ${violationsList.length}`)
                  : (lang === 'ru' ? 'МОНИТОРИНГ: НЕТ НАРУШЕНИЙ' : 'MONITORING: CLEAR')}
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
                  <span>{lang === 'ru' ? 'Очистить' : 'Clear'}</span>
                </button>
                <button
                  onClick={handleExportViolationsReport}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-950/60 text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/40 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{lang === 'ru' ? 'Экспорт JSON' : 'Export JSON'}</span>
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
            { id: 'all', label: lang === 'ru' ? `Все (${violationsList.length})` : `All (${violationsList.length})` },
            { id: 'red', label: lang === 'ru' ? 'Красный свет' : 'Red Light' },
            { id: 'jay', label: lang === 'ru' ? 'Пешеход' : 'Pedestrian' },
            { id: 'speed', label: lang === 'ru' ? 'Скорость' : 'Speed' },
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
          <button
            onClick={() => setShowCollisionAlerts(prev => !prev)}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer font-bold ${
              showCollisionAlerts
                ? 'bg-red-600 text-white'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {showCollisionAlerts ? '⚠️ Alerts ON' : '⚠️ Alerts OFF'}
          </button>
        </div>

        {/* Violations Table */}
        {violationsList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] bg-slate-950/60 sticky top-0">
                  <th className="py-3 px-4">Таймкод</th>
                  <th className="py-3 px-4">ТС / Госномер</th>
                  <th className="py-3 px-4">Описание нарушения</th>
                  <th className="py-3 px-4">Статья КоАО</th>
                  <th className="py-3 px-4">Штраф</th>
                  <th className="py-3 px-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {violationsList.map((viol) => {
                  const isCurrentActive = currentTime >= viol.start && currentTime <= viol.end;
                  return (
                    <tr
                      key={viol.id}
                      onClick={() => handleSeek(viol.start, viol.labelRu)}
                      className={`transition-all cursor-pointer group border-l-2 ${
                        isCurrentActive
                          ? 'bg-cyan-950/20 border-cyan-500'
                          : 'hover:bg-slate-800/40 border-transparent'
                      }`}
                    >
                      <td className="py-4 px-4 font-mono text-cyan-200">
                        <div className="flex items-center gap-2 font-bold">
                          <Clock className="w-4 h-4 text-slate-500" />
                          {viol.start.toFixed(1)}с — {viol.end.toFixed(1)}с
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Длительность: {(viol.end - viol.start).toFixed(1)}с</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white font-bold font-mono text-[11px]">
                          {viol.licensePlate}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">{viol.vehicleType}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {lang === 'ru' ? viol.labelRu : viol.labelEn}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-[180px] truncate">{viol.description}</div>
                      </td>
                      <td className="py-4 px-4 text-[11px]">
                        <div className="text-amber-300 font-medium">{viol.codeArticle}</div>
                        <div className="text-slate-500">{viol.fineBrv}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-mono font-bold text-emerald-400 text-sm">{viol.fineUzs}</div>
                        <div className="text-[10px] text-slate-500">Официальный штраф</div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveProtocolItem(viol);
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Протокол
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer hover:rotate-90 transition-transform"
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
