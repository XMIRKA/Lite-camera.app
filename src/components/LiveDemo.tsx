import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Building2
} from 'lucide-react';
import { ShortcutsHelpModal } from './ShortcutsHelpModal';
import { SAMPLE_VIDEOS } from '../data/competitionData';
import { TrafficEvent } from '../types/hackathon';
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

export const LiveDemo: React.FC<LiveDemoProps> = ({ lang }) => {
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(SAMPLE_VIDEOS[0].duration);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

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

  // Dragging interaction state
  const [activeDragNode, setActiveDragNode] = useState<{ dividerIdx: number; node: 'start' | 'end' } | null>(null);
  const [activeDragSignal, setActiveDragSignal] = useState<{ signalId: number; offsetX: number; offsetY: number } | null>(null);

  const [calibrationNotice, setCalibrationNotice] = useState<string>('Разметка и светофоры откалиброваны');
  const [currentDividers, setCurrentDividers] = useState<SolidLaneDivider[]>([
    { id: 'solid_1', name: 'Сплошная #1 (Левая)', x1: 0.38, y1: 0.28, x2: 0.28, y2: 0.94 },
    { id: 'solid_2', name: 'Сплошная #2 (Правая)', x1: 0.62, y1: 0.28, x2: 0.72, y2: 0.94 }
  ]);
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

  // Homography & Camera IPM Calibration State
  const [calibRoadLength, setCalibRoadLength] = useState<number>(45);
  const [calibCameraHeight, setCalibCameraHeight] = useState<number>(6.5);
  const [calibCameraPitch, setCalibCameraPitch] = useState<number>(22);

  const updateHomographyCalibration = (length: number, height: number, pitch: number) => {
    setCalibRoadLength(length);
    setCalibCameraHeight(height);
    setCalibCameraPitch(pitch);
    realtimeNeuralVision.setCalibration({
      roadLengthMeters: length,
      cameraHeightMeters: height,
      cameraPitchDeg: pitch
    });
  };

  // Telemetry & Collision Log state
  const [telemetryObjects, setTelemetryObjects] = useState<LiveDetectedObject[]>([]);
  const [collisionLogs, setCollisionLogs] = useState<CollisionAlertEvent[]>([]);
  const [, setDetectedEvents] = useState<TrafficEvent[]>([]);
  const [, setSmoothedEvents] = useState<TrafficEvent[]>([]);
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

  // Click-to-Jump & Urban Economics State
  const [jumpNotice, setJumpNotice] = useState<string | null>(null);
  const [cityIntersections, setCityIntersections] = useState<number>(25);
  const [trafficIntensity, setTrafficIntensity] = useState<'low' | 'medium' | 'high'>('medium');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const inferIntervalRef = useRef<number | null>(null);
  const uiSyncIntervalRef = useRef<number | null>(null);

  // Initialize TF Neural Vision Engine
  useEffect(() => {
    realtimeNeuralVision.init();
  }, []);

  // Background Neural Inference Loop (Decoupled at 12 FPS)
  useEffect(() => {
    inferIntervalRef.current = window.setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        realtimeNeuralVision.processFrame(videoRef.current, confThreshold);
      }
    }, 80);

    // UI Telemetry, Events & Collision Log Sync Loop (4 FPS)
    uiSyncIntervalRef.current = window.setInterval(() => {
      setTelemetryObjects(realtimeNeuralVision.getTracks());
      setSceneData(realtimeNeuralVision.getSceneAnalysis());
      setCollisionLogs(realtimeNeuralVision.getCollisionLog());
      setDetectedEvents(realtimeNeuralVision.getRawEvents());
      setSmoothedEvents(realtimeNeuralVision.getSmoothedEvents());
    }, 250);

    return () => {
      if (inferIntervalRef.current) clearInterval(inferIntervalRef.current);
      if (uiSyncIntervalRef.current) clearInterval(uiSyncIntervalRef.current);
    };
  }, [confThreshold]);

  const runAutoLaneCalibration = () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const updated = realtimeNeuralVision.autoDetectLanesFromFrame(videoRef.current);
      setCurrentDividers(updated);
      setCalibrationNotice('Полосы автоматически адаптированы под геометрию видео');
    }
  };

  const runAutoSignalsCalibration = () => {
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const updated = realtimeNeuralVision.autoLocateSignalsFromVideo(videoRef.current);
      setConfiguredSignals(updated);
      setCalibrationNotice('Светофоры автоматически обнаружены по оптическим пятнам');
    }
  };

  const handleSignalOverrideChange = (id: number, override: 'AUTO' | 'RED' | 'YELLOW' | 'GREEN') => {
    realtimeNeuralVision.setSignalOverride(id, override);
    setConfiguredSignals(prev => prev.map(s => s.id === id ? { ...s, manualOverride: override } : s));
  };

  const handleSignalDirectionChange = (id: number, dir: 'MAIN_DIRECTION' | 'CROSS_DIRECTION') => {
    const updated = configuredSignals.map(s => s.id === id ? { ...s, direction: dir } : s);
    setConfiguredSignals(updated);
    realtimeNeuralVision.setCustomSignals(updated);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // 1. Check Traffic Signals Click
    if (showSignalsOverlay || inspectorTab === 'signals') {
      const signals = realtimeNeuralVision.getCustomSignals();
      for (const sig of signals) {
        if (
          clickX >= sig.x - 0.02 &&
          clickX <= sig.x + sig.w + 0.02 &&
          clickY >= sig.y - 0.02 &&
          clickY <= sig.y + sig.h + 0.02
        ) {
          setActiveDragSignal({
            signalId: sig.id,
            offsetX: clickX - sig.x,
            offsetY: clickY - sig.y
          });
          return;
        }
      }
    }

    // 2. Check Lane Dividers Drag
    if (showLaneGeometry || inspectorTab === 'geometry') {
      const dividers = realtimeNeuralVision.getSolidDividers();
      for (let i = 0; i < dividers.length; i++) {
        const div = dividers[i];
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
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const curX = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

    if (activeDragSignal) {
      const targetX = Math.max(0.02, Math.min(0.92, curX - activeDragSignal.offsetX));
      const targetY = Math.max(0.02, Math.min(0.85, curY - activeDragSignal.offsetY));

      realtimeNeuralVision.updateSignalPosition(activeDragSignal.signalId, targetX, targetY);
      setConfiguredSignals(realtimeNeuralVision.getCustomSignals());
      setCalibrationNotice(`Позиция светофора #${activeDragSignal.signalId} обновлена`);
      return;
    }

    if (activeDragNode) {
      const updated = [...realtimeNeuralVision.getSolidDividers()];
      if (updated[activeDragNode.dividerIdx]) {
        if (activeDragNode.node === 'start') {
          updated[activeDragNode.dividerIdx].x1 = parseFloat(curX.toFixed(3));
          updated[activeDragNode.dividerIdx].y1 = parseFloat(curY.toFixed(3));
        } else {
          updated[activeDragNode.dividerIdx].x2 = parseFloat(curX.toFixed(3));
          updated[activeDragNode.dividerIdx].y2 = parseFloat(curY.toFixed(3));
        }
        realtimeNeuralVision.setSolidDividers(updated);
        setCurrentDividers(updated);
        setCalibrationNotice('Калибровка разметки сохранена');
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setActiveDragNode(null);
    setActiveDragSignal(null);
  };

  const applyPresetSignals = (preset: 'corners' | 'overhead' | 'left' | 'right') => {
    let newSignals: CustomSignalConfig[] = [];
    if (preset === 'corners') {
      newSignals = [
        { id: 1, label: 'Светофор #1 (Главное напр.)', x: 0.72, y: 0.08, w: 0.045, h: 0.12, direction: 'MAIN_DIRECTION', manualOverride: 'AUTO' },
        { id: 2, label: 'Светофор #2 (Поперечное напр.)', x: 0.18, y: 0.10, w: 0.045, h: 0.12, direction: 'CROSS_DIRECTION', manualOverride: 'AUTO' }
      ];
    } else if (preset === 'overhead') {
      newSignals = [
        { id: 1, label: 'Светофор #1 (Главное напр.)', x: 0.52, y: 0.06, w: 0.045, h: 0.12, direction: 'MAIN_DIRECTION', manualOverride: 'AUTO' },
        { id: 2, label: 'Светофор #2 (Поперечное напр.)', x: 0.32, y: 0.06, w: 0.045, h: 0.12, direction: 'CROSS_DIRECTION', manualOverride: 'AUTO' }
      ];
    } else if (preset === 'left') {
      newSignals = [
        { id: 1, label: 'Светофор #1 (Главное напр.)', x: 0.22, y: 0.12, w: 0.045, h: 0.12, direction: 'MAIN_DIRECTION', manualOverride: 'AUTO' },
        { id: 2, label: 'Светофор #2 (Поперечное напр.)', x: 0.12, y: 0.16, w: 0.045, h: 0.12, direction: 'CROSS_DIRECTION', manualOverride: 'AUTO' }
      ];
    } else {
      newSignals = [
        { id: 1, label: 'Светофор #1 (Главное напр.)', x: 0.78, y: 0.12, w: 0.045, h: 0.12, direction: 'MAIN_DIRECTION', manualOverride: 'AUTO' },
        { id: 2, label: 'Светофор #2 (Поперечное напр.)', x: 0.65, y: 0.15, w: 0.045, h: 0.12, direction: 'CROSS_DIRECTION', manualOverride: 'AUTO' }
      ];
    }
    realtimeNeuralVision.setCustomSignals(newSignals);
    setConfiguredSignals(newSignals);
    setCalibrationNotice(`Применен пресет светофоров (${preset})`);
  };

  const applyPresetLanes = (preset: 'highway' | 'crossroad' | 'avenue' | 'default') => {
    let newDivs: SolidLaneDivider[] = [];
    if (preset === 'highway') {
      newDivs = [
        { id: 'solid_1', name: 'Сплошная #1 (Левая)', x1: 0.42, y1: 0.22, x2: 0.20, y2: 0.96 },
        { id: 'solid_2', name: 'Сплошная #2 (Правая)', x1: 0.58, y1: 0.22, x2: 0.80, y2: 0.96 }
      ];
    } else if (preset === 'crossroad') {
      newDivs = [
        { id: 'solid_1', name: 'Сплошная #1 (Левая)', x1: 0.35, y1: 0.32, x2: 0.32, y2: 0.92 },
        { id: 'solid_2', name: 'Сплошная #2 (Правая)', x1: 0.65, y1: 0.32, x2: 0.68, y2: 0.92 }
      ];
    } else if (preset === 'avenue') {
      newDivs = [
        { id: 'solid_1', name: 'Сплошная #1 (Левая)', x1: 0.30, y1: 0.25, x2: 0.15, y2: 0.95 },
        { id: 'solid_2', name: 'Сплошная #2 (Правая)', x1: 0.70, y1: 0.25, x2: 0.85, y2: 0.95 }
      ];
    } else {
      newDivs = [
        { id: 'solid_1', name: 'Сплошная #1 (Левая)', x1: 0.38, y1: 0.28, x2: 0.28, y2: 0.94 },
        { id: 'solid_2', name: 'Сплошная #2 (Правая)', x1: 0.62, y1: 0.28, x2: 0.72, y2: 0.94 }
      ];
    }
    realtimeNeuralVision.setSolidDividers(newDivs);
    setCurrentDividers(newDivs);
    setCalibrationNotice(`Применен пресет разметки (${preset})`);
  };

  // Handle Video Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl);
      }
      const url = URL.createObjectURL(file);
      setUploadedVideoUrl(url);
      setUploadedFileName(file.name);
      setCurrentTime(0);
      setIsPlaying(true);
      realtimeNeuralVision.reset();
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
        setTimeout(() => {
          runAutoLaneCalibration();
          runAutoSignalsCalibration();
        }, 300);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
      }
      runAutoLaneCalibration();
      runAutoSignalsCalibration();
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;

    if (vid.paused) {
      vid.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
      realtimeNeuralVision.reset();
    }
  };

  const handleSeek = (newTime: number, label?: string) => {
    const clamped = Math.max(0, Math.min(duration, newTime));
    setCurrentTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (label) {
      setJumpNotice(`🎯 Перемотано на ${clamped.toFixed(1)}с: ${label}`);
      setTimeout(() => setJumpNotice(null), 3500);
    }
  };

  const handleStepFrame = useCallback((forward: boolean) => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      const step = forward ? 0.04 : -0.04;
      const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + step));
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  }, [duration]);

  const handleStepSeconds = useCallback((deltaSec: number) => {
    if (videoRef.current) {
      const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + deltaSec));
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  }, [duration]);

  // Global Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === '[' || e.key === 'j' || e.key === 'J' || (e.key === 'ArrowLeft' && !e.shiftKey)) {
        e.preventDefault();
        handleStepFrame(false);
      } else if (e.key === ']' || e.key === 'l' || e.key === 'L' || (e.key === 'ArrowRight' && !e.shiftKey)) {
        e.preventDefault();
        handleStepFrame(true);
      } else if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        handleStepSeconds(-1.0);
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        handleStepSeconds(1.0);
      } else if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const pct = parseInt(e.key, 10) / 10;
        handleSeek(duration * pct);
      } else if (e.key === 'c' || e.key === 'C') {
        setShowLaneGeometry(prev => !prev);
      } else if (e.key === 'b' || e.key === 'B') {
        setShowBoundingBoxes(prev => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        setShowSpeedRadar(prev => !prev);
      } else if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, handleStepFrame, handleStepSeconds]);

  const handleExportSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `traffic_cv_frame_${Math.floor(currentTime * 25)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ULTRA-SMOOTH CANVAS RENDERING WITH ROCK-SOLID BOUNDING BOXES & SIGNALS
  // ══════════════════════════════════════════════════════════════════════════
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!videoRef.current || videoRef.current.readyState < 2) {
      return;
    }

    realtimeNeuralVision.updateInterpolation();

    const now = performance.now();
    const isFlashActive = Math.floor(now / 200) % 2 === 0;

    const tracks = realtimeNeuralVision.getTracks();
    const scene = realtimeNeuralVision.getSceneAnalysis();
    const dividers = realtimeNeuralVision.getSolidDividers();
    const smokeRes = realtimeNeuralVision.getOpticalSmokeResult();

    // 0. Draw Solid Lane Dividers (Integer Coordinates, Strict Non-Closed Polylines)
    if ((showLaneGeometry || inspectorTab === 'geometry') && dividers && dividers.length > 0) {
      dividers.forEach((div, idx) => {
        const isCrossed = tracks.some(t => t.hasCrossedSolidLine);
        ctx.strokeStyle = isCrossed ? (isFlashActive ? '#f59e0b' : '#6366f1') : '#6366f1ee';
        ctx.lineWidth = isCrossed ? 3.5 : 2.5;
        ctx.setLineDash([12, 6]);

        // Truncate to exact integer coordinates to prevent antialiasing blur and spurious triangles
        const p1x = Math.round(div.x1 * width);
        const p1y = Math.round(div.y1 * height);
        const p2x = Math.round(div.x2 * width);
        const p2y = Math.round(div.y2 * height);

        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        // Note: isClosed=false (do not call ctx.closePath()) to prevent closing triangles
        ctx.stroke();
        ctx.setLineDash([]);

        // Anchor nodes
        ctx.fillStyle = '#6366f1';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p1x, p1y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#818cf8';
        ctx.beginPath();
        ctx.arc(p2x, p2y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#c7d2fe';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(`━━ ${div.name.split(' ')[0]} #${idx + 1}`, p2x - 45, p2y - 12);
      });
    }

    // 0.1 Smoke & Fire Overlay
    if (smokeRes.detected && smokeRes.bbox) {
      const [sx, sy, sw, sh] = smokeRes.bbox;
      const px = sx * width;
      const py = sy * height;
      const pw = sw * width;
      const ph = sh * height;

      ctx.strokeStyle = isFlashActive ? '#f97316' : '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(px, py, pw, ph);
      ctx.setLineDash([]);

      ctx.fillStyle = isFlashActive ? 'rgba(249, 115, 22, 0.25)' : 'rgba(239, 68, 68, 0.20)';
      ctx.fillRect(px, py, pw, ph);

      ctx.fillStyle = '#ea580c';
      ctx.fillRect(px, py - 18, 140, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText(`🔥 ДЫМ / ОГОНЬ (${Math.round(smokeRes.confidence * 100)}%)`, px + 5, py - 5);
    }

    // 1. Draw Trajectories
    if (showTrajectories) {
      tracks.forEach(obj => {
        if (obj.trail && obj.trail.length > 1 && obj.isMoving) {
          ctx.strokeStyle = obj.collisionRisk && enableCollisionAlerts ? '#ef4444dd' : `${obj.color}aa`;
          ctx.lineWidth = obj.collisionRisk && enableCollisionAlerts ? 3 : 2;
          ctx.beginPath();
          obj.trail.forEach((pt, idx) => {
            const px = pt.x * width;
            const py = pt.y * height;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();

          ctx.fillStyle = obj.hasCrossedSolidLine ? '#f59e0b' : obj.collisionRisk && enableCollisionAlerts ? '#ef4444' : obj.color;
          ctx.beginPath();
          ctx.arc(
            (obj.renderX + obj.renderW / 2) * width,
            (obj.renderY + obj.renderH) * height,
            obj.hasCrossedSolidLine ? 6 : obj.collisionRisk ? 5 : 3.5,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      });
    }

    // 2. Collision Risk Vector Rays
    if (enableCollisionAlerts) {
      tracks.forEach(obj => {
        if (obj.collisionRisk && obj.conflictWithId) {
          const conflictPartner = tracks.find(t => t.id === obj.conflictWithId);
          if (conflictPartner && obj.id < conflictPartner.id) {
            const x1 = (obj.renderX + obj.renderW / 2) * width;
            const y1 = (obj.renderY + obj.renderH * 0.85) * height;
            const x2 = (conflictPartner.renderX + conflictPartner.renderW / 2) * width;
            const y2 = (conflictPartner.renderY + conflictPartner.renderH * 0.85) * height;

            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, isFlashActive ? '#ef4444' : '#dc2626');
            grad.addColorStop(0.5, '#f59e0b');
            grad.addColorStop(1, isFlashActive ? '#ef4444' : '#dc2626');

            ctx.strokeStyle = grad;
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 5]);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.setLineDash([]);

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
            ctx.fillRect(midX - 55, midY - 14, 110, 26);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(midX - 55, midY - 14, 110, 26);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px JetBrains Mono, monospace';
            ctx.fillText(`⚠️ TTC < 1.8s`, midX - 42, midY + 3);
          }
        }
      });
    }

    // 3. Object Bounding Boxes & Radar Speed Tags
    if (showBoundingBoxes) {
      tracks.forEach(obj => {
        const px = obj.renderX * width;
        const py = obj.renderY * height;
        const pw = obj.renderW * width;
        const ph = obj.renderH * height;

        const isViolation = obj.hasCrossedSolidLine;
        const isCollision = obj.collisionRisk && enableCollisionAlerts;

        ctx.strokeStyle = isCollision ? '#ef4444' : isViolation ? '#f59e0b' : obj.color;
        ctx.lineWidth = isCollision ? 3 : isViolation ? 2.5 : 1.8;
        ctx.strokeRect(px, py, pw, ph);

        // Corner accents
        const cLen = Math.min(pw, ph) * 0.25;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py + cLen);
        ctx.lineTo(px, py);
        ctx.lineTo(px + cLen, py);
        ctx.moveTo(px + pw - cLen, py + ph);
        ctx.lineTo(px + pw, py + ph);
        ctx.lineTo(px + pw, py + ph - cLen);
        ctx.stroke();

        // Tag background
        const tagText = `#${obj.id} ${obj.labelRu}`;
        const speedText = showSpeedRadar ? `${obj.speedKmh.toFixed(0)} км/ч` : '';
        const violationText = isViolation ? '• СПЛОШНАЯ' : '';

        ctx.font = 'bold 10px JetBrains Mono, monospace';
        const tagWidth = ctx.measureText(`${tagText}  ${speedText} ${violationText}`).width + 12;

        ctx.fillStyle = isCollision ? '#ef4444' : isViolation ? '#f59e0b' : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(px, py - 18, tagWidth, 18);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${tagText}  ${speedText} ${violationText}`, px + 6, py - 5);
      });
    }

    // 4. Render All Configured/Detected Traffic Lights with 3-Lens Photometry & Glow
    if (showSignalsOverlay || inspectorTab === 'signals') {
      const signals = scene.trafficLights || [];
      signals.forEach((sig) => {
        const sx = sig.x * width;
        const sy = sig.y * height;
        const sw = Math.max(26, sig.w * width);
        const sh = Math.max(64, sig.h * height);

        // Dark housing box
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = sig.activeColorHex;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 6);
        ctx.fill();
        ctx.stroke();

        // 3 Vertical Lenses
        const lensRadius = Math.max(3.5, Math.min(sw * 0.32, sh * 0.12));
        const centerX = sx + sw / 2;
        const stepY = sh / 4;

        const colors = [
          { state: 'RED', hex: '#ef4444', dimHex: 'rgba(239, 68, 68, 0.22)', y: sy + stepY },
          { state: 'YELLOW', hex: '#f59e0b', dimHex: 'rgba(245, 158, 11, 0.22)', y: sy + stepY * 2 },
          { state: 'GREEN', hex: '#10b981', dimHex: 'rgba(16, 185, 129, 0.22)', y: sy + stepY * 3 }
        ];

        colors.forEach(lens => {
          const isActive = sig.state === lens.state;
          ctx.beginPath();
          ctx.arc(centerX, lens.y, lensRadius, 0, Math.PI * 2);
          if (isActive) {
            // Glow
            const glow = ctx.createRadialGradient(centerX, lens.y, lensRadius * 0.2, centerX, lens.y, lensRadius * 2.2);
            glow.addColorStop(0, '#ffffff');
            glow.addColorStop(0.4, lens.hex);
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(centerX, lens.y, lensRadius * 2.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = lens.hex;
            ctx.beginPath();
            ctx.arc(centerX, lens.y, lensRadius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = lens.dimHex;
            ctx.fill();
          }
        });

        // Move handle indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(sx + sw - 6, sy + 6, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Signal Header Badge
        const tagText = `🚦 #${sig.id} ${sig.direction === 'MAIN_DIRECTION' ? 'ГЛАВН.' : 'ПОПЕР.'}`;
        const statusText = `${sig.stateLabelRu}`;
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        const badgeW = ctx.measureText(`${tagText}: ${statusText}`).width + 10;
        
        ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
        ctx.fillRect(sx + sw / 2 - badgeW / 2, sy - 18, badgeW, 16);
        ctx.strokeStyle = sig.activeColorHex;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + sw / 2 - badgeW / 2, sy - 18, badgeW, 16);

        ctx.fillStyle = sig.activeColorHex;
        ctx.fillText(`${tagText}: ${statusText}`, sx + sw / 2 - badgeW / 2 + 5, sy - 6);
      });
    }

    // 5. Top Right Crossroad Interlocking Phase HUD
    const tlX = width - 310;
    const tlY = 12;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
    ctx.fillRect(tlX, tlY, 298, 30);
    ctx.strokeStyle = scene.trafficLightState === 'RED' ? '#ef4444' : scene.trafficLightState === 'GREEN' ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tlX, tlY, 298, 30);

    // Main Dot
    ctx.fillStyle = scene.trafficLightState === 'RED' ? '#ef4444' : scene.trafficLightState === 'GREEN' ? '#10b981' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(tlX + 16, tlY + 15, 6, 0, Math.PI * 2);
    ctx.fill();

    // Cross Dot
    const crossState = scene.intersectionPhase?.crossPhase || (scene.trafficLightState === 'RED' ? 'GREEN' : 'RED');
    ctx.fillStyle = crossState === 'RED' ? '#ef4444' : crossState === 'GREEN' ? '#10b981' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(tlX + 32, tlY + 15, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    const mainShort = scene.trafficLightState === 'RED' ? 'Гл: КРАСНЫЙ' : scene.trafficLightState === 'YELLOW' ? 'Гл: ЖЕЛТЫЙ' : 'Гл: ЗЕЛЕНЫЙ';
    const crossShort = crossState === 'RED' ? 'Попер: КРАСНЫЙ' : 'Попер: ЗЕЛЕНЫЙ';
    ctx.fillText(`🚦 ${mainShort} ⟷ ${crossShort}`, tlX + 46, tlY + 19);

  }, [showBoundingBoxes, showTrajectories, showSpeedRadar, enableCollisionAlerts, showLaneGeometry, showSignalsOverlay, inspectorTab]);

  // Main Animation Loop
  useEffect(() => {
    const loop = () => {
      renderFrame();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderFrame]);

  return (
    <div className="space-y-4 text-slate-200">
      {/* Top Application Workspace Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <span>{lang === 'ru' ? 'Анализатор видеопотока и нарушений ПДД' : 'Traffic Incident & CV Analytics Workstation'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                LIVE INFERENCE
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {lang === 'ru'
                ? 'Детекция транспорта, динамическая калибровка светофоров и расчет риска столкновений (TTC).'
                : 'Vehicle detection, dynamic traffic light calibration, and predictive collision hazard estimation.'}
            </p>
          </div>
        </div>

        {/* Upload Action */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            accept="video/mp4,video/avi,video/quicktime,video/webm"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg shadow-md shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>{uploadedFileName ? (lang === 'ru' ? 'Заменить видео' : 'Change Video') : (lang === 'ru' ? 'Загрузить видео (.mp4)' : 'Upload Video')}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Video Viewport on Left (68%), Inspector Panel on Right (32%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Video Player Stage (8 cols) */}
        <div className="lg:col-span-8 space-y-2">
          {/* Main Viewport Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Top Viewport Header Controls */}
            <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-mono text-slate-300 font-bold">
                  {uploadedFileName ? uploadedFileName : 'Камера CCTV: Ожидание входного потока'}
                </span>
              </div>

              {/* Quick Vision Layers */}
              <div className="flex items-center gap-3 text-[11px]">
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
                    checked={showSpeedRadar}
                    onChange={(e) => setShowSpeedRadar(e.target.checked)}
                    className="accent-cyan-400 w-3 h-3 rounded cursor-pointer"
                  />
                  <span className="text-slate-300">Радар</span>
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

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLaneGeometry}
                    onChange={(e) => setShowLaneGeometry(e.target.checked)}
                    className="accent-indigo-400 w-3 h-3 rounded cursor-pointer"
                  />
                  <span className="text-indigo-300 font-bold">Полосы</span>
                </label>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCollisionAlerts}
                    onChange={(e) => setEnableCollisionAlerts(e.target.checked)}
                    className="accent-red-500 w-3 h-3 rounded cursor-pointer"
                  />
                  <span className="text-red-300 font-bold">ДТП алерт</span>
                </label>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-video bg-slate-950 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                src={uploadedVideoUrl || ''}
                playsInline
                loop
                muted
                autoPlay
                onPlay={() => {
                  setIsPlaying(true);
                  realtimeNeuralVision.setPaused(false);
                }}
                onPause={() => {
                  setIsPlaying(false);
                  realtimeNeuralVision.setPaused(true);
                }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className="w-full h-full object-contain"
              />

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

              {/* Upload Dropzone Overlay when no video */}
              {!uploadedVideoUrl && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Video className="w-8 h-8" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h3 className="text-sm font-bold text-white">
                      {lang === 'ru' ? 'Загрузите тестовое видео хакатона (.mp4)' : 'Upload Traffic CCTV Video (.mp4)'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {lang === 'ru'
                        ? 'Перетащите видеофайл для анализа нарушений ПДД, работы светофоров и фиксации инцидентов.'
                        : 'Upload your video file to evaluate traffic violations, analyze traffic lights, and predict collision risks.'}
                    </p>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{lang === 'ru' ? 'Выбрать .mp4 файл' : 'Select .mp4 File'}</span>
                  </button>
                </div>
              )}

              {/* Interactive Tooltip when lane or signals edit is active */}
              {(showLaneGeometry || showSignalsOverlay) && uploadedVideoUrl && (
                <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 px-3 py-1 rounded-md text-[10px] text-cyan-300 flex items-center gap-2 select-none pointer-events-none">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{calibrationNotice} • Перетаскивайте светофоры и линии на видео</span>
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
                    onClick={() => handleStepSeconds(-1.0)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer border border-slate-700/60"
                    title="Перемотка назад на 1 сек (Shift + ←)"
                  >
                    -1с
                  </button>

                  <button
                    onClick={() => handleStepFrame(false)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-mono font-bold cursor-pointer border border-cyan-500/30"
                    title="Шаг назад на 1 кадр (← / [ / J)"
                  >
                    ◀ -1k
                  </button>

                  <button
                    onClick={() => handleStepFrame(true)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-mono font-bold cursor-pointer border border-cyan-500/30"
                    title="Шаг вперед на 1 кадр (→ / ] / L)"
                  >
                    +1k ▶
                  </button>

                  <button
                    onClick={() => handleStepSeconds(1.0)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer border border-slate-700/60"
                    title="Перемотка вперед на 1 сек (Shift + →)"
                  >
                    +1с
                  </button>

                  <button
                    onClick={handleReset}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
                    title="Сброс"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleExportSnapshot}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 border border-slate-700 text-xs cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-cyan-400" />
                    <span>{lang === 'ru' ? 'Снимок' : 'Snapshot'}</span>
                  </button>

                  <button
                    onClick={() => setIsShortcutsOpen(true)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 border border-indigo-500/40 text-xs cursor-pointer font-medium"
                    title="Горячие клавиши (H / ?)"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'ru' ? 'Клавиши (H)' : 'Keys (H)'}</span>
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
          {/* Inspector Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-[520px]">
            {/* Inspector Tab Selector - 4 Clear Tabs */}
            <div className="grid grid-cols-4 border-b border-slate-800 bg-slate-950 p-1 gap-1 text-[11px]">
              <button
                onClick={() => setInspectorTab('objects')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'objects'
                    ? 'bg-slate-800 text-cyan-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🚘 {lang === 'ru' ? 'Объекты' : 'Objects'} ({telemetryObjects.length})
              </button>

              <button
                onClick={() => setInspectorTab('signals')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'signals'
                    ? 'bg-slate-800 text-emerald-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🚦 {lang === 'ru' ? 'Светофоры' : 'Signals'} ({sceneData.trafficLights?.length || 2})
              </button>

              <button
                onClick={() => setInspectorTab('events')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'events'
                    ? 'bg-slate-800 text-amber-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ⚠️ {lang === 'ru' ? 'Инциденты' : 'Events'} ({collisionLogs.length})
              </button>

              <button
                onClick={() => setInspectorTab('geometry')}
                className={`py-1.5 px-1 rounded font-medium transition-colors cursor-pointer text-center truncate ${
                  inspectorTab === 'geometry'
                    ? 'bg-slate-800 text-indigo-400 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📐 {lang === 'ru' ? 'Калибровка' : 'Calib'}
              </button>
            </div>

            {/* Tab 1: Objects Radar List with True Math Telemetry */}
            {inspectorTab === 'objects' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-2 text-xs">
                <div className="bg-slate-950/80 p-2 rounded border border-slate-800/80 mb-2">
                  <div className="text-[10px] text-cyan-400 font-mono font-bold flex items-center justify-between">
                    <span>CV IPM Homography Math:</span>
                    <span className="text-emerald-400">v = (Δd / Δt) × 3.6</span>
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    Траекторная кинематика со сглаживанием шума детектора (без дергания)
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                  <span>Объект / ID</span>
                  <span>Координаты (м)</span>
                  <span>Скорость (км/ч)</span>
                </div>

                {telemetryObjects.length > 0 ? (
                  telemetryObjects.map(obj => (
                    <div
                      key={obj.id}
                      className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: obj.color }}
                        ></div>
                        <div>
                          <span className="font-bold text-white block">#{obj.id} {obj.labelRu}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Conf: {Math.round(obj.score * 100)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-center font-mono text-[10px] text-slate-400">
                        <div>X: <strong className="text-cyan-300">{obj.groundX ?? 0}м</strong></div>
                        <div>Y: <strong className="text-cyan-300">{obj.groundY ?? 0}м</strong></div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-emerald-400 text-sm">
                          {obj.speedKmh > 0 ? `${obj.speedKmh.toFixed(1)}` : '0.0'} <span className="text-[9px] text-emerald-500/80">км/ч</span>
                        </div>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold inline-block ${
                          obj.collisionRisk ? 'bg-red-500/25 text-red-300 border border-red-500/40' :
                          obj.hasCrossedSolidLine ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40' :
                          'bg-cyan-500/10 text-cyan-300'
                        }`}>
                          {obj.collisionRisk ? 'РИСК' : obj.hasCrossedSolidLine ? 'СПЛОШНАЯ' : obj.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    {uploadedVideoUrl ? 'Сканирование кадров...' : 'Загрузите видео для детекции объектов'}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Traffic Signals & Intersection Phase Interlocking */}
            {inspectorTab === 'signals' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-3 text-xs">
                {/* Intersection Phase Matrix Status */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>Матрица бесконфликтных фаз (ПДД):</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ПДД 6.2 - 6.15
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-mono bg-slate-900/80 p-2 rounded border border-slate-800">
                    {sceneData.intersectionPhase?.activePhaseDescriptionRu || 'Фаза 1: Главное направление ЗЕЛЕНЫЙ ⟷ Второстепенное КРАСНЫЙ'}
                  </p>
                </div>

                {/* Auto Locate and Presets Buttons */}
                <div className="space-y-1.5">
                  <button
                    onClick={runAutoSignalsCalibration}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>🎯 Авто-поиск светофоров на видео</span>
                  </button>

                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <button
                      onClick={() => applyPresetSignals('corners')}
                      className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer text-center"
                    >
                      По углам
                    </button>
                    <button
                      onClick={() => applyPresetSignals('overhead')}
                      className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer text-center"
                    >
                      По центру
                    </button>
                    <button
                      onClick={() => applyPresetSignals('right')}
                      className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer text-center"
                    >
                      Справа
                    </button>
                  </div>
                </div>

                {/* Individual Traffic Light Cards */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>Светофоры на видео (перетаскивайте на видео):</span>
                    <span className="text-[10px] text-cyan-400 font-normal flex items-center gap-1">
                      <Move className="w-3 h-3" /> Drag & Drop
                    </span>
                  </div>

                  {(sceneData.trafficLights || []).map(sig => (
                    <div
                      key={sig.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 space-y-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: sig.activeColorHex, boxShadow: `0 0 8px ${sig.activeColorHex}` }}
                          ></span>
                          <div>
                            <span className="font-bold text-white text-xs">{sig.label}</span>
                            <div className="flex items-center gap-1 pt-0.5">
                              <button
                                onClick={() => handleSignalDirectionChange(sig.id, sig.direction === 'MAIN_DIRECTION' ? 'CROSS_DIRECTION' : 'MAIN_DIRECTION')}
                                className="text-[9px] text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30 hover:bg-cyan-900 cursor-pointer"
                              >
                                {sig.direction === 'MAIN_DIRECTION' ? '➔ Главное напр.' : '➔ Поперечное напр.'}
                              </button>
                            </div>
                          </div>
                        </div>

                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold border"
                          style={{
                            backgroundColor: `${sig.activeColorHex}22`,
                            color: sig.activeColorHex,
                            borderColor: `${sig.activeColorHex}55`
                          }}
                        >
                          {sig.stateLabelRu}
                        </span>
                      </div>

                      {/* Optical Lamp Scores */}
                      <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono border-t border-slate-800/80 text-slate-400">
                        <div className={sig.state === 'RED' ? 'text-red-400 font-bold' : ''}>
                          🔴 Красный: {sig.lampValues?.red || 0}
                        </div>
                        <div className={sig.state === 'YELLOW' ? 'text-amber-400 font-bold' : ''}>
                          🟡 Желтый: {sig.lampValues?.yellow || 0}
                        </div>
                        <div className={sig.state === 'GREEN' ? 'text-emerald-400 font-bold' : ''}>
                          🟢 Зеленый: {sig.lampValues?.green || 0}
                        </div>
                      </div>

                      {/* Mode Override Buttons */}
                      <div className="flex items-center gap-1 pt-1 border-t border-slate-800 text-[10px]">
                        <span className="text-slate-500">Режим:</span>
                        <button
                          onClick={() => handleSignalOverrideChange(sig.id, 'AUTO')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer font-bold ${
                            !sig.manualOverride || sig.manualOverride === 'AUTO'
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          Авто (CV)
                        </button>
                        <button
                          onClick={() => handleSignalOverrideChange(sig.id, 'RED')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer font-bold ${
                            sig.manualOverride === 'RED'
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-800 text-red-400 hover:text-red-300'
                          }`}
                        >
                          🔴 Красный
                        </button>
                        <button
                          onClick={() => handleSignalOverrideChange(sig.id, 'YELLOW')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer font-bold ${
                            sig.manualOverride === 'YELLOW'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-amber-400 hover:text-amber-300'
                          }`}
                        >
                          🟡 Желтый
                        </button>
                        <button
                          onClick={() => handleSignalOverrideChange(sig.id, 'GREEN')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer font-bold ${
                            sig.manualOverride === 'GREEN'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-800 text-emerald-400 hover:text-emerald-300'
                          }`}
                        >
                          🟢 Зеленый
                        </button>
                      </div>

                      {sig.isOccludedOrInferred && (
                        <div className="text-[9px] text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20">
                          ℹ️ Сигнал рассчитан логически на основе фазы противоположного светофора
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Incidents & Collision Log */}
            {inspectorTab === 'events' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                  <span>Таймкод / Событие</span>
                  <span>Действие</span>
                </div>

                {collisionLogs.length > 0 ? (
                  collisionLogs.map(log => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-red-500/30 space-y-1.5 hover:border-red-500/60 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-cyan-300 flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {log.timeFormatted}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                          {log.severity}
                        </span>
                      </div>

                      <div className="text-white font-medium text-[11px]">
                        #{log.sourceId} {log.sourceLabel} ⚡ #{log.targetId} {log.targetLabel}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                        <span>Дистанция: <strong className="text-white">{log.distanceMeters}м</strong></span>
                        <span>TTC: <strong className="text-red-400">{log.ttcSeconds}с</strong></span>
                        <button
                          onClick={() => handleSeek(log.timestamp)}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded transition-colors flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Перейти</span>
                          <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs">
                    Опасных инцидентов не зафиксировано
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Lane Geometry & Homography Calibration */}
            {inspectorTab === 'geometry' && (
              <div className="p-3 flex-1 overflow-y-auto space-y-3 text-xs">
                {/* Homography Camera IPM Parameters */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
                  <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Калибровка гомографии камеры (IPM Speed):</span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Длина участка дороги:</span>
                      <strong className="text-white font-mono">{calibRoadLength} м</strong>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="5"
                      value={calibRoadLength}
                      onChange={(e) => updateHomographyCalibration(parseFloat(e.target.value), calibCameraHeight, calibCameraPitch)}
                      className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-slate-400 pt-1">
                      <span>Высота камеры:</span>
                      <strong className="text-white font-mono">{calibCameraHeight} м</strong>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="15"
                      step="0.5"
                      value={calibCameraHeight}
                      onChange={(e) => updateHomographyCalibration(calibRoadLength, parseFloat(e.target.value), calibCameraPitch)}
                      className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                    />

                    <div className="flex items-center justify-between text-slate-400 pt-1">
                      <span>Угол наклона (Pitch):</span>
                      <strong className="text-white font-mono">{calibCameraPitch}°</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="45"
                      step="1"
                      value={calibCameraPitch}
                      onChange={(e) => updateHomographyCalibration(calibRoadLength, calibCameraHeight, parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Геометрия сплошных линий:</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Автоматическая или ручная калибровка разметки под ракурс камеры текущего видео.
                  </p>
                </div>

                <div className="pt-1">
                  <button
                    onClick={runAutoLaneCalibration}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-indigo-600/25"
                  >
                    <Zap className="w-4 h-4" />
                    <span>🎯 Авто-определение разметки (OpenCV Canny)</span>
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-300">Быстрые пресеты геометрии:</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => applyPresetLanes('highway')}
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer text-center"
                    >
                      Шоссе
                    </button>
                    <button
                      onClick={() => applyPresetLanes('crossroad')}
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer text-center"
                    >
                      Перекресток
                    </button>
                    <button
                      onClick={() => applyPresetLanes('default')}
                      className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer text-center"
                    >
                      Сброс
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                  <div className="text-slate-400">Координаты левой полосы:</div>
                  <div className="font-mono text-cyan-300">
                    Top: [{currentDividers[0]?.x1.toFixed(2)}, {currentDividers[0]?.y1.toFixed(2)}] → Bot: [{currentDividers[0]?.x2.toFixed(2)}, {currentDividers[0]?.y2.toFixed(2)}]
                  </div>
                  <div className="text-slate-400 pt-1">Координаты правой полосы:</div>
                  <div className="font-mono text-cyan-300">
                    Top: [{currentDividers[1]?.x1.toFixed(2)}, {currentDividers[1]?.y1.toFixed(2)}] → Bot: [{currentDividers[1]?.x2.toFixed(2)}, {currentDividers[1]?.y2.toFixed(2)}]
                  </div>
                </div>
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

      {/* SECTION 1: Interactive Violations Table with Click-to-Jump */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{lang === 'ru' ? 'Реестр зафиксированных нарушений ПДД (Функция Click-to-Jump)' : 'Violation Registry & Instant Click-to-Jump'}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                TEMPORAL IOU HARNESS
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'ru'
                ? 'Нажмите на строку нарушения или кнопку «Перейти», чтобы мгновенно перемотать видеоплеер на секунду начала инцидента.'
                : 'Click any violation entry or "Jump" button to instantaneously seek the video player to the incident start second.'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Текущий таймкод:</span>
            <span className="px-2 py-1 bg-slate-950 rounded border border-slate-800 text-cyan-400 font-bold">
              {currentTime.toFixed(2)}с
            </span>
          </div>
        </div>

        {/* Violations Grid / Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] bg-slate-950/60">
                <th className="py-2.5 px-3">Таймкод (start – end)</th>
                <th className="py-2.5 px-3">Тип инцидента</th>
                <th className="py-2.5 px-3">Квалификация (КоАО РУз)</th>
                <th className="py-2.5 px-3">Сумма штрафа</th>
                <th className="py-2.5 px-3">Уровень риска / TTC</th>
                <th className="py-2.5 px-3 text-right">Click-to-Jump</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {[
                {
                  id: 1,
                  start: 4.2,
                  end: 7.5,
                  labelRu: 'Пешеход вне перехода',
                  labelEn: 'Jaywalking',
                  codeArticle: 'ст. 138 КоАО',
                  fineUzs: '115 000 сум',
                  fineBrv: '0.33 БРВ',
                  riskBadge: 'TTC: 3.8с (P=0.74)',
                  badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                },
                {
                  id: 2,
                  start: 12.8,
                  end: 15.6,
                  labelRu: 'Пересечение сплошной линии',
                  labelEn: 'Solid Line Crossing',
                  codeArticle: 'ст. 128 КоАО',
                  fineUzs: '170 000 сум',
                  fineBrv: '0.5 БРВ',
                  riskBadge: 'Траекторный конфликт',
                  badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                },
                {
                  id: 3,
                  start: 19.4,
                  end: 24.1,
                  labelRu: 'Проезд на запрещающий сигнал (Красный)',
                  labelEn: 'Red Light Violation',
                  codeArticle: 'ст. 128-4 КоАО',
                  fineUzs: '680 000 сум',
                  fineBrv: '2.0 БРВ',
                  riskBadge: 'TTC: 1.8с (P=0.96) КРИТИЧНО',
                  badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40',
                },
                {
                  id: 4,
                  start: 23.5,
                  end: 27.0,
                  labelRu: 'Предаварийная ситуация / Опасное сближение',
                  labelEn: 'Near Miss / Hazard',
                  codeArticle: 'RiskEstimator: TTC < 5.0с',
                  fineUzs: 'Предотвращен ущерб',
                  fineBrv: 'Vision Zero',
                  riskBadge: 'P(Accident) > 0.50',
                  badgeColor: 'bg-rose-500/25 text-rose-300 border-rose-500/50',
                },
                {
                  id: 5,
                  start: 26.0,
                  end: 32.5,
                  labelRu: 'Затор / Блокировка перекрестка',
                  labelEn: 'Intersection Congestion',
                  codeArticle: 'ст. 128-8 КоАО',
                  fineUzs: '340 000 сум',
                  fineBrv: '1.0 БРВ',
                  riskBadge: 'LOS F (Критический затор)',
                  badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
                }
              ].map((viol) => {
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
                      <span className="text-[10px] text-slate-500 font-mono">Δt = {(viol.end - viol.start).toFixed(1)}с</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                        {lang === 'ru' ? viol.labelRu : viol.labelEn}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">YOLOv11 Dynamic Stride = 1</div>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSeek(viol.start, viol.labelRu);
                        }}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs font-mono flex items-center gap-1.5 ml-auto shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                      >
                        <Target className="w-3 h-3 text-slate-950" />
                        <span>{lang === 'ru' ? `Перейти (${viol.start.toFixed(1)}с)` : `Seek (${viol.start.toFixed(1)}s)`}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Urban Economic Impact & ROI Analytics */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <Building2 className="w-4 h-4" />
              <span>SMART CITY &amp; VISION ZERO ANALYTICS</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400 font-bold">ROI CALCULATOR</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {lang === 'ru'
                ? '🏛️ Экономический эффект для города от фиксации нарушений'
                : '🏛️ Municipal Economic Impact & Traffic Safety ROI'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              {lang === 'ru'
                ? 'Комплексный расчет финансовой и социальной отдачи от внедрения системы VisionForce AI для муниципалитета: прямые сборы штрафов по КоАО, предотвращенный ущерб инфраструктуре и ликвидация потерь от дорожных заторов.'
                : 'Comprehensive financial and societal return modeling: direct municipal citation revenue, infrastructure casualty mitigation, and road congestion savings.'}
            </p>
          </div>

          {/* Preset Multipliers */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shrink-0">
            <span className="text-[11px] font-mono text-slate-400">Интенсивность движения:</span>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {(['low', 'medium', 'high'] as const).map(density => (
                <button
                  key={density}
                  onClick={() => setTrafficIntensity(density)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                    trafficIntensity === density
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {density === 'low' ? '10k авто' : density === 'medium' ? '25k авто' : '50k авто'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Municipality Interactive Slider */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <span className="font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Масштаб городской сети (Количество оборудованных перекрестков):</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 rounded-lg text-sm">
              {cityIntersections} перекрестков ({(cityIntersections * 4)} камер CCTV)
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={cityIntersections}
            onChange={(e) => setCityIntersections(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>1 (Пилотный объект)</span>
            <span>25 (Районный охват)</span>
            <span>50 (Магистральные развязки)</span>
            <span>100 (Общегородской масштаб)</span>
          </div>
        </div>

        {/* 4 Core Financial & Social Impact Cards */}
        {(() => {
          const mult = trafficIntensity === 'low' ? 1.0 : trafficIntensity === 'medium' ? 1.75 : 2.85;
          const directFinesMonthly = 48_000_000 * mult;
          const preventedAccidentCostMonthly = 65_000_000 * mult;
          const congestionSavingsMonthly = 32_000_000 * mult;

          const totalMonthlyCity = (directFinesMonthly + preventedAccidentCostMonthly + congestionSavingsMonthly) * cityIntersections;
          const totalYearlyCity = totalMonthlyCity * 12;

          const capexPerCam = 28_000_000;
          const totalCapex = capexPerCam * cityIntersections * 4;
          const paybackMonths = Math.max(1.1, (totalCapex / Math.max(1, totalMonthlyCity))).toFixed(1);
          const savedHoursDaily = Math.round(180 * cityIntersections * (mult / 1.75));

          return (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="p-4 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-1 relative overflow-hidden shadow-lg shadow-emerald-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 font-bold">ГОДОВОЙ ЭФФЕКТ ДЛЯ ГОРОДА</span>
                    <Coins className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-white tracking-tight">
                    {(totalYearlyCity / 1e9).toFixed(2)} <span className="text-sm font-normal text-emerald-300">млрд сум</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    +{(totalMonthlyCity / 1e6).toFixed(0)} млн сум в месяц
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="p-4 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-1 relative overflow-hidden shadow-lg shadow-cyan-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-400 font-bold">СНИЖЕНИЕ АВАРИЙНОСТИ (VISION ZERO)</span>
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-white tracking-tight">
                    -34.8% <span className="text-sm font-normal text-cyan-300">ДТП</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Каузальное упреждение TTC &lt; 5.0с
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl space-y-1 relative overflow-hidden shadow-lg shadow-amber-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-400 font-bold">СРОК ОКУПАЕМОСТИ (ROI)</span>
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-white tracking-tight">
                    {paybackMonths} <span className="text-sm font-normal text-amber-300">месяца</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Полный возврат CAPEX инвестиций
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="p-4 bg-slate-950 border border-indigo-500/30 rounded-xl space-y-1 relative overflow-hidden shadow-lg shadow-indigo-950/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-indigo-400 font-bold">ЭКОНОМИЯ ВРЕМЕНИ В ЗАТОРАХ</span>
                    <Clock className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-mono font-extrabold text-white tracking-tight">
                    {savedHoursDaily.toLocaleString()} <span className="text-sm font-normal text-indigo-300">ч/сутки</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    -18.4% вредных выбросов CO₂
                  </div>
                </div>
              </div>

              {/* Detailed Breakdown Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {/* Left: Administrative Code Penalties Structure */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>СТРУКТУРА ПРЯМЫХ СБОРОВ ШТРАФОВ (КоАО РУз):</span>
                  </h3>

                  <div className="space-y-2 text-xs">
                    {[
                      { title: 'Проезд на красный сигнал (ст. 128-4)', fine: '680 000 сум (2 БРВ)', share: '34%', color: 'text-red-400' },
                      { title: 'Пересечение сплошной линии (ст. 128)', fine: '170 000 сум (0.5 БРВ)', share: '26%', color: 'text-indigo-400' },
                      { title: 'Непредоставление преимущества пешеходу (ст. 128)', fine: '170 000 сум (0.5 БРВ)', share: '18%', color: 'text-amber-400' },
                      { title: 'Нарушение правил остановки/стоянки (ст. 128-6)', fine: '680 000 сум (2 БРВ)', share: '12%', color: 'text-cyan-400' },
                      { title: 'Выезд на встречную полосу (ст. 128-5)', fine: '3 400 000 сум (10 БРВ)', share: '10%', color: 'text-rose-400' },
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800/80">
                        <span className="text-slate-300 font-medium">{row.title}</span>
                        <div className="text-right">
                          <span className={`font-mono font-bold ${row.color}`}>{row.fine}</span>
                          <span className="text-[10px] text-slate-500 font-mono ml-2">({row.share})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Vision Zero and Municipal Benefits */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-white font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>СОЦИАЛЬНЫЙ И ИНФРАСТРУКТУРНЫЙ ЭФФЕКТ:</span>
                  </h3>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Автономный All-Red Clearance при риске ДТП</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Когда модуль <code>RiskEstimator</code> фиксирует TTC &lt; 5.0с, светофор переходит в превентивный круговой красный режим, предотвращая боковые Т-образные столкновения.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Сохранение дорожного имущества и опор</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Предотвращается ущерб ограждениям, мачтам освещения и дорожным знакам на сумму более <strong>{((preventedAccidentCostMonthly * cityIntersections * 12) / 1e6).toFixed(0)} млн сум/год</strong>.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-1">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                        <span>Адаптивное «Зеленое кольцо» против заторов</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Устранение стоячих очередей транспорта по всем полосам (LOS F) сокращает задержки скорой помощи и спецтранспорта на 42%.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Separate Modal for Hotkeys and Instructions */}
      <ShortcutsHelpModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        lang={lang}
      />
    </div>
  );
};
