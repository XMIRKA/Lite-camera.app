import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Download,
  Sliders,
  CheckCircle2,
  Video,
  FileVideo,
  User,
  Car,
  ShieldAlert,
  Sparkles,
  Camera,
  Activity,
  Gauge,
  Layers,
  AlertTriangle,
  Flame
} from 'lucide-react';
import { SAMPLE_VIDEOS } from '../data/competitionData';
import {
  calculateTrafficDensityAndLOS,
  evaluatePairwiseCollisionRisks,
  TrafficDensityMetrics,
  TrackedTrafficEntity
} from '../utils/trafficAnalyticsEngine';

interface StreamlitAppProps {
  lang: 'en' | 'ru';
}

interface DetectedObject {
  id: number;
  cls: 'pedestrian' | 'car' | 'truck' | 'bus' | 'person_bike' | 'person_moped' | 'bicycle' | 'motorcycle' | string;
  label: string;
  x: number; // 0..1
  y: number;
  w: number;
  h: number;
  conf: number;
  speedKmh: number;
  trail: { x: number; y: number }[];
  collisionRisk?: boolean;
  conflictWithId?: number;
  distanceMeters?: number;
  ttcSeconds?: number;
}

export const StreamlitApp: React.FC<StreamlitAppProps> = ({ lang }) => {
  // Streamlit Configuration State (Sidebar)
  const [modelWeights, setModelWeights] = useState<string>('yolov8n.pt');
  const [confThreshold, setConfThreshold] = useState<number>(0.35);
  const [iouThreshold, setIouThreshold] = useState<number>(0.45);
  const [enableTrajectories, setEnableTrajectories] = useState<boolean>(true);
  const [enableSpeedRadar, setEnableSpeedRadar] = useState<boolean>(true);
  const [enableCollisionAlerts, setEnableCollisionAlerts] = useState<boolean>(true);

  // Video & Streamlit Execution State
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(SAMPLE_VIDEOS[0].duration);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [totalFrames, setTotalFrames] = useState<number>(Math.floor(SAMPLE_VIDEOS[0].duration * 25));
  const [pipelineFps, setPipelineFps] = useState<number>(28.5);

  // Real-time dynamic detections & traffic density metrics
  const [pedestrianCount, setPedestrianCount] = useState<number>(0);
  const [vehicleCount, setVehicleCount] = useState<number>(0);
  const [trafficMetrics, setTrafficMetrics] = useState<TrafficDensityMetrics>(() =>
    calculateTrafficDensityAndLOS([])
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const sampleVideo = SAMPLE_VIDEOS[selectedSampleIdx];

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
      setIsPlaying(false);
      setCurrentTime(0);
      setCurrentFrame(0);
    }
  };

  // Switch to Sample Video
  const handleSelectSample = (idx: number) => {
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
      setUploadedVideoUrl(null);
      setUploadedFileName(null);
    }
    setSelectedSampleIdx(idx);
    const dur = SAMPLE_VIDEOS[idx].duration;
    setDuration(dur);
    setTotalFrames(Math.floor(dur * 25));
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentFrame(0);
  };

  // Video metadata loaded
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 15.0;
      setDuration(dur);
      setTotalFrames(Math.floor(dur * 25));
    }
  };

  // Video Time update
  const handleTimeUpdate = () => {
    if (videoRef.current && uploadedVideoUrl) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      setCurrentFrame(Math.floor(cur * 25));
    }
  };

  // Generate simulated dynamic YOLOv8 + ByteTrack detections based on current time
  const generateDetections = useCallback((t: number): DetectedObject[] => {
    const objs: DetectedObject[] = [];
    const baseSpeed = modelWeights === 'yolov8m.pt' ? 38.0 : 35.0;

    // Vehicle 1: Moving westbound
    const v1_x = 0.85 - ((t * 0.08) % 1.0);
    const v1_y = 0.58 + Math.sin(t * 0.5) * 0.02;
    if (v1_x > 0.05 && v1_x < 0.95 && confThreshold <= 0.85) {
      objs.push({
        id: 101,
        cls: 'car',
        label: '🚗 Автомобиль #101',
        x: v1_x,
        y: v1_y,
        w: 0.12,
        h: 0.10,
        conf: 0.92,
        speedKmh: baseSpeed + 4.2,
        trail: [
          { x: v1_x + 0.08, y: v1_y },
          { x: v1_x + 0.05, y: v1_y },
          { x: v1_x + 0.02, y: v1_y },
          { x: v1_x, y: v1_y }
        ]
      });
    }

    // Vehicle 2: Eastbound car
    const v2_x = 0.15 + ((t * 0.06) % 1.0);
    const v2_y = 0.68;
    if (v2_x > 0.05 && v2_x < 0.95 && confThreshold <= 0.75) {
      objs.push({
        id: 104,
        cls: 'car',
        label: '🚗 Автомобиль #104',
        x: v2_x,
        y: v2_y,
        w: 0.14,
        h: 0.11,
        conf: 0.88,
        speedKmh: 41.5,
        trail: [
          { x: v2_x - 0.08, y: v2_y },
          { x: v2_x - 0.05, y: v2_y },
          { x: v2_x, y: v2_y }
        ]
      });
    }

    // Pedestrian with Bicycle / Cyclist: Crosswalk
    const p1_x = 0.42 + Math.sin(t * 0.4) * 0.05;
    const p1_y = 0.48 + ((t * 0.03) % 0.35);
    if (confThreshold <= 0.60) {
      objs.push({
        id: 205,
        cls: 'person_bike',
        label: '🚶‍♂️+🚲 Пешеход с великом #205',
        x: p1_x,
        y: p1_y,
        w: 0.05,
        h: 0.10,
        conf: 0.86,
        speedKmh: 4.6,
        trail: [
          { x: p1_x, y: p1_y - 0.04 },
          { x: p1_x, y: p1_y - 0.02 },
          { x: p1_x, y: p1_y }
        ]
      });
    }

    // Pedestrian 2: Sidewalk
    const p2_x = 0.82;
    const p2_y = 0.42 + ((t * 0.02) % 0.25);
    if (confThreshold <= 0.50) {
      objs.push({
        id: 209,
        cls: 'pedestrian',
        label: '🚶 Пешеход #209',
        x: p2_x,
        y: p2_y,
        w: 0.035,
        h: 0.08,
        conf: 0.79,
        speedKmh: 3.9,
        trail: [
          { x: p2_x, y: p2_y - 0.03 },
          { x: p2_x, y: p2_y }
        ]
      });
    }

    // Courier / Moped
    const m_x = 0.20 + ((t * 0.07) % 0.9);
    const m_y = 0.62;
    if (confThreshold <= 0.65) {
      objs.push({
        id: 218,
        cls: 'person_moped',
        label: '🛵 Курьер на мопеде #218',
        x: m_x,
        y: m_y,
        w: 0.08,
        h: 0.09,
        conf: 0.89,
        speedKmh: 24.5,
        trail: [
          { x: m_x - 0.06, y: m_y },
          { x: m_x, y: m_y }
        ]
      });
    }

    // Bus / Heavy vehicle
    if (t > 2 && t < 14 && confThreshold <= 0.70) {
      const b_x = 0.28 + ((t - 2) * 0.045);
      objs.push({
        id: 312,
        cls: 'bus',
        label: '🚌 Автобус #312',
        x: b_x,
        y: 0.52,
        w: 0.18,
        h: 0.14,
        conf: 0.94,
        speedKmh: 28.0,
        trail: [
          { x: b_x - 0.08, y: 0.52 },
          { x: b_x, y: 0.52 }
        ]
      });
    }

    return objs;
  }, [modelWeights, confThreshold]);

  // OpenCV Canvas Drawing Loop (cv2 simulation engine)
  const drawOpenCVOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background rendering
    if (!uploadedVideoUrl) {
      // Draw realistic CCTV road intersection background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      // Asphalt roadway
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, height * 0.4);
      ctx.lineTo(width, height * 0.4);
      ctx.lineTo(width, height * 0.88);
      ctx.lineTo(0, height * 0.88);
      ctx.fill();

      // Lane dividers (dashed lines)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.setLineDash([18, 14]);

      // Lane 1 divider
      ctx.beginPath();
      ctx.moveTo(0, height * 0.56);
      ctx.lineTo(width, height * 0.56);
      ctx.stroke();

      // Lane 2 divider
      ctx.beginPath();
      ctx.moveTo(0, height * 0.72);
      ctx.lineTo(width, height * 0.72);
      ctx.stroke();
      ctx.setLineDash([]);

      // Solid Stop-line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(width * 0.36, height * 0.4);
      ctx.lineTo(width * 0.36, height * 0.88);
      ctx.stroke();

      // Crosswalk Zebra stripes
      ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
      for (let i = 0; i < 9; i++) {
        ctx.fillRect(width * 0.38 + i * 22, height * 0.42, 12, height * 0.44);
      }
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    // Grid guide
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(width * 0.35, height * 0.45, width * 0.3, height * 0.35);
    ctx.setLineDash([]);

    const detections = generateDetections(currentTime);

    const now = performance.now();
    const isFlashActive = Math.floor(now / 220) % 2 === 0;

    // Convert to TrackedTrafficEntity
    const trafficEntities: TrackedTrafficEntity[] = detections.map(d => ({
      id: d.id,
      class: d.cls,
      x: d.x,
      y: d.y,
      w: d.w,
      h: d.h,
      renderX: d.x,
      renderY: d.y,
      renderW: d.w,
      renderH: d.h,
      speedKmh: d.speedKmh,
      trail: d.trail
    }));

    // Vector Kinematics & Trajectory Collision Forecasting (Eliminates false alarms on parallel/queue objects)
    let collisionResults: ReturnType<typeof evaluatePairwiseCollisionRisks> = [];
    if (enableCollisionAlerts) {
      collisionResults = evaluatePairwiseCollisionRisks(trafficEntities);
      // Sync back risk flags
      trafficEntities.forEach(te => {
        const match = detections.find(d => d.id === te.id);
        if (match) {
          match.collisionRisk = te.collisionRisk;
          match.conflictWithId = te.conflictWithId;
          match.distanceMeters = te.distanceMeters;
          match.ttcSeconds = te.ttcSeconds;
        }
      });
    } else {
      detections.forEach(d => {
        d.collisionRisk = false;
        d.conflictWithId = undefined;
      });
    }

    // High-Precision Traffic Density & Level of Service (LOS) calculation
    const densityData = calculateTrafficDensityAndLOS(trafficEntities);
    setTrafficMetrics(densityData);

    let peds = 0;
    let vehs = 0;

    // Draw Collision Vector Lines between Conflicting Objects
    if (enableCollisionAlerts && collisionResults.length > 0) {
      collisionResults.forEach(risk => {
        const o1 = detections.find(d => d.id === risk.sourceId);
        const o2 = detections.find(d => d.id === risk.targetId);
        if (o1 && o2 && o1.id < o2.id) {
          const x1 = (o1.x + o1.w / 2) * width;
          const y1 = (o1.y + o1.h) * height;
          const x2 = (o2.x + o2.w / 2) * width;
          const y2 = (o2.y + o2.h) * height;

          ctx.strokeStyle = isFlashActive ? '#ef4444' : '#dc262688';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const distLabel = `⚠️ ${risk.distanceMeters}m (TTC: ${risk.ttcSeconds}s | ${risk.closingSpeedKmh} км/ч)`;

          ctx.font = 'bold 9px JetBrains Mono, monospace';
          const textMetrics = ctx.measureText(distLabel);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(midX - (textMetrics.width + 8) / 2, midY - 9, textMetrics.width + 8, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(distLabel, midX - textMetrics.width / 2, midY + 3);
        }
      });
    }

    detections.forEach(obj => {
      if (obj.cls === 'pedestrian') peds++;
      else vehs++;

      const bx = obj.x * width;
      const by = obj.y * height;
      const bw = obj.w * width;
      const bh = obj.h * height;

      const isPed = obj.cls === 'pedestrian';
      const isDanger = obj.collisionRisk && enableCollisionAlerts;
      let color = isPed ? '#00f2fe' : obj.cls === 'bus' ? '#f59e0b' : '#10b981';

      if (isDanger) {
        color = isFlashActive ? '#ff0033' : '#dc2626';
      }

      // 1. Draw Bounding Box (cv2.rectangle) with pulsing red highlight on collision anticipation
      ctx.strokeStyle = color;
      ctx.lineWidth = isDanger ? (isFlashActive ? 4.0 : 2.5) : 2.5;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner markers
      const cLen = Math.min(bw, bh) * 0.25;
      ctx.lineWidth = isDanger ? 4.5 : 3.5;
      ctx.beginPath();
      ctx.moveTo(bx, by + cLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cLen, by);
      ctx.moveTo(bx + bw - cLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cLen);
      ctx.moveTo(bx, by + bh - cLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cLen, by + bh);
      ctx.moveTo(bx + bw - cLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cLen);
      ctx.stroke();

      // 2. Draw Trajectory lines (cv2.line)
      if (enableTrajectories && obj.trail.length > 1) {
        ctx.strokeStyle = isDanger ? '#ef4444cc' : color;
        ctx.lineWidth = isDanger ? 3 : 2;
        ctx.beginPath();
        obj.trail.forEach((pt, idx) => {
          const px = pt.x * width + bw / 2;
          const py = pt.y * height + bh;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        ctx.fillStyle = isDanger ? '#ef4444' : color;
        ctx.beginPath();
        ctx.arc(bx + bw / 2, by + bh, isDanger ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Draw HUD Tag with flashing 'DANGER' label (cv2.putText)
      let fullText = '';
      if (isDanger) {
        fullText = isFlashActive
          ? `⚠️ DANGER #${obj.conflictWithId} | ${obj.speedKmh.toFixed(1)} km/h`
          : `⚠️ DANGER | ${(obj.conf * 100).toFixed(0)}%`;
      } else {
        const labelText = `${obj.label} (${(obj.conf * 100).toFixed(0)}%)`;
        const radarText = enableSpeedRadar ? ` | ${obj.speedKmh.toFixed(1)} km/h` : '';
        fullText = labelText + radarText;
      }

      ctx.font = 'bold 11px JetBrains Mono, monospace';
      const textMetrics = ctx.measureText(fullText);
      const tagWidth = textMetrics.width + 12;
      const tagHeight = 18;

      ctx.fillStyle = color;
      ctx.fillRect(bx, by - tagHeight, tagWidth, tagHeight);

      ctx.fillStyle = isDanger ? '#ffffff' : '#020617';
      ctx.fillText(fullText, bx + 6, by - 5);
    });

    setPedestrianCount(peds);
    setVehicleCount(vehs);

    // 4. Collision Warning Banner on Canvas
    const activeDanger = detections.find(d => d.collisionRisk);
    if (activeDanger && enableCollisionAlerts) {
      ctx.fillStyle = isFlashActive ? 'rgba(220, 38, 38, 0.95)' : 'rgba(185, 28, 28, 0.90)';
      ctx.fillRect(12, 46, 360, 26);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(12, 46, 360, 26);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.fillText(`🚨 DANGER: PROXIMITY ALERT (ID #${activeDanger.id})`, 22, 63);
    }

    // Streamlit Top Watermark HUD
    ctx.fillStyle = 'rgba(11, 19, 43, 0.88)';
    ctx.fillRect(12, 12, 540, 28);
    ctx.strokeStyle = 'rgba(58, 80, 107, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, 540, 28);

    ctx.fillStyle = '#00f2fe';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText(
      `STREAMLIT LIVE | ${densityData.levelOfService} (${densityData.congestionLevel}) | Занятость: ${densityData.roadOccupancyPct}% | V_avg: ${densityData.averageSpeedKmh} км/ч`,
      20,
      30
    );
  }, [currentTime, generateDetections, enableTrajectories, enableSpeedRadar, enableCollisionAlerts, modelWeights, uploadedVideoUrl]);

  // Synthetic timer when playing without uploaded video
  useEffect(() => {
    if (isPlaying && !uploadedVideoUrl) {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + 0.04;
          if (next >= duration) {
            return 0;
          }
          setCurrentFrame(Math.floor(next * 25));
          return next;
        });
      }, 40);
      return () => clearInterval(interval);
    }
  }, [isPlaying, uploadedVideoUrl, duration]);

  // Main Render loop
  useEffect(() => {
    const render = () => {
      drawOpenCVOverlay();
      animFrameRef.current = requestAnimationFrame(render);
    };
    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawOpenCVOverlay]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (uploadedVideoUrl && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    if (uploadedVideoUrl && videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setCurrentFrame(0);
  };

  // Export frame snapshot
  const handleExportSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `visionforce_frame_${currentFrame}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const progressPercent = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  return (
    <div className="bg-[#0b132b] text-slate-100 rounded-2xl border border-[#1c2541] overflow-hidden shadow-2xl">
      {/* Streamlit Layout: Sidebar (Left) + Main Page (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[750px]">
        {/* ═══════════════════════════════════════════════════════════════════
            STREAMLIT SIDEBAR (Parameters & Model Weights)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-4 bg-[#1c2541] p-6 border-r border-[#3a506b] flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            {/* Header / Brand */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚦</span>
                <h3 className="text-lg font-bold text-white tracking-wide">VisionForce AI</h3>
              </div>
              <p className="text-xs text-[#00f2fe] font-mono font-semibold">
                Streamlit Video Analytics Engine
              </p>
            </div>

            {/* Team Authors */}
            <div className="p-3 bg-[#0b132b] rounded-xl border border-[#3a506b]/60 space-y-1.5 text-xs">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                {lang === 'ru' ? 'Команда разработки:' : 'Engineering Team:'}
              </div>
              <div className="text-white font-medium flex items-center gap-1.5">
                <span>👑</span>
                <strong>(El Capitano) Alisherov Mirkamol</strong>
              </div>
              <div className="text-slate-300 flex items-center gap-1.5 text-[11px]">
                <span>🚀</span>
                <span>Normatov Bekzod — CV & Calibration</span>
              </div>
              <div className="text-slate-300 flex items-center gap-1.5 text-[11px]">
                <span>⚡</span>
                <span>Muzaffar Solixojaev — AI & Telemetry</span>
              </div>
            </div>

            <hr className="border-[#3a506b]/60" />

            {/* Streamlit Controls / Sliders */}
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#00f2fe]" />
                  {lang === 'ru' ? 'Параметры пайплайна' : 'Pipeline Parameters'}
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/40">
                  LIVE SYNC
                </span>
              </div>

              {/* Model Weights selectbox */}
              <div className="space-y-1.5">
                <label className="text-slate-300 block">
                  {lang === 'ru' ? 'Веса модели YOLOv8:' : 'YOLOv8 Weights:'}
                </label>
                <select
                  value={modelWeights}
                  onChange={(e) => setModelWeights(e.target.value)}
                  className="w-full bg-[#0b132b] border border-[#3a506b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe]"
                >
                  <option value="yolov8n.pt">yolov8n.pt (Nano — 120 FPS / Real-Time)</option>
                  <option value="yolov8s.pt">yolov8s.pt (Small — 85 FPS / Balanced)</option>
                  <option value="yolov8m.pt">yolov8m.pt (Medium — 45 FPS / Max Precision)</option>
                </select>
              </div>

              {/* Confidence slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-300">{lang === 'ru' ? 'Порог уверенности (Conf):' : 'Confidence Thresh:'}</span>
                  <span className="text-[#00f2fe] font-bold">{confThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.95"
                  step="0.05"
                  value={confThreshold}
                  onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                  className="w-full accent-[#00f2fe] bg-[#0b132b] cursor-pointer"
                />
              </div>

              {/* IoU slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-300">{lang === 'ru' ? 'Порог NMS IoU:' : 'NMS IoU Thresh:'}</span>
                  <span className="text-emerald-400 font-bold">{iouThreshold.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.90"
                  step="0.05"
                  value={iouThreshold}
                  onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 bg-[#0b132b] cursor-pointer"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-2.5 pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableTrajectories}
                    onChange={(e) => setEnableTrajectories(e.target.checked)}
                    className="accent-[#00f2fe] w-4 h-4 rounded"
                  />
                  <span className="text-slate-200">
                    {lang === 'ru' ? 'Отрисовывать траектории ByteTrack' : 'Render ByteTrack Trajectories'}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableSpeedRadar}
                    onChange={(e) => setEnableSpeedRadar(e.target.checked)}
                    className="accent-[#00f2fe] w-4 h-4 rounded"
                  />
                  <span className="text-slate-200">
                    {lang === 'ru' ? 'Радар физической скорости (км/ч)' : 'Physical Speed Radar (km/h)'}
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none bg-red-950/40 p-1.5 rounded border border-red-500/30">
                  <input
                    type="checkbox"
                    checked={enableCollisionAlerts}
                    onChange={(e) => setEnableCollisionAlerts(e.target.checked)}
                    className="accent-red-500 w-4 h-4 rounded"
                  />
                  <span className="text-red-300 font-bold text-xs">
                    {lang === 'ru' ? '⚠️ Детектор сближения & Алерты ДТП' : '⚠️ Proximity & Collision Alert (DANGER)'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Sidebar Footer Specs */}
          <div className="p-3 bg-[#0b132b]/80 rounded-xl border border-[#3a506b]/40 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>OpenCV (cv2):</span>
              <span className="text-[#00f2fe]">v4.8.0.76</span>
            </div>
            <div className="flex justify-between">
              <span>Tracker:</span>
              <span className="text-emerald-400">ByteTrack v0.3</span>
            </div>
            <div className="flex justify-between">
              <span>Engine Status:</span>
              <span className="text-emerald-400">Ready</span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            STREAMLIT MAIN CONTENT (Video, Metrics & OpenCV Canvas)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="lg:col-span-8 p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            {/* Title Header */}
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-[#00f2fe]" />
                {lang === 'ru'
                  ? 'Интеллектуальный видеомониторинг дорожного движения'
                  : 'Intelligent Traffic Video Surveillance'}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                YOLOv8 + ByteTrack + OpenCV (cv2) + Streamlit Engine
              </p>
            </div>

            {/* Video Source Picker / File Uploader */}
            <div className="p-4 bg-[#1c2541] rounded-xl border border-[#3a506b] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <span className="font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#00f2fe]" />
                  {lang === 'ru' ? 'Загрузите свой файл .mp4 или выберите тестовый сценарий:' : 'Upload .mp4 video or select a sample scenario:'}
                </span>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/mp4,video/avi,video/quicktime"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-[#00f2fe] hover:bg-[#00d8e4] text-[#0b132b] font-bold font-mono rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {lang === 'ru' ? 'Загрузить .mp4' : 'Upload .mp4'}
                </button>
              </div>

              {/* Sample Video Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {SAMPLE_VIDEOS.map((sample, idx) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(idx)}
                    className={`px-3 py-1 text-xs font-mono rounded-lg border transition-all ${
                      selectedSampleIdx === idx && !uploadedVideoUrl
                        ? 'bg-[#00f2fe]/20 border-[#00f2fe] text-[#00f2fe] font-bold'
                        : 'bg-[#0b132b] border-[#3a506b] text-slate-400 hover:text-white'
                    }`}
                  >
                    {sample.title}
                  </button>
                ))}
                {uploadedFileName && (
                  <span className="px-3 py-1 text-xs font-mono rounded-lg border bg-emerald-950/60 border-emerald-500/60 text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {uploadedFileName}
                  </span>
                )}
              </div>
            </div>

            {/* Streamlit Top Metric Cards (st.metric) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 bg-[#1c2541] rounded-xl border border-[#3a506b]">
                <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                  <span>{lang === 'ru' ? 'Плотность полотна' : 'Road Occupancy'}</span>
                  <span className="text-[#00f2fe] font-bold">{trafficMetrics.levelOfService}</span>
                </div>
                <div className="text-base font-bold text-white mt-0.5 flex items-center justify-between">
                  <span>{trafficMetrics.roadOccupancyPct}%</span>
                  <span className="text-[11px] font-normal text-slate-400">({trafficMetrics.vehicleDensityPerKm} авт/км)</span>
                </div>
              </div>

              <div className="p-3 bg-[#1c2541] rounded-xl border border-[#3a506b]">
                <div className="text-[10px] text-slate-400 uppercase">
                  {lang === 'ru' ? 'Уровень затора (HCM)' : 'Congestion State'}
                </div>
                <div className="text-base font-bold mt-0.5 flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    trafficMetrics.congestionLevel === 'ПРОБКА' ? 'bg-red-500/20 text-red-400 border border-red-500/40' :
                    trafficMetrics.congestionLevel === 'ПЛОТНЫЙ' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                    trafficMetrics.congestionLevel === 'УМЕРЕННЫЙ' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}>
                    {trafficMetrics.congestionLevel}
                  </span>
                  <span className="text-xs text-slate-400 font-normal">({trafficMetrics.congestionScore}/10)</span>
                </div>
              </div>

              <div className="p-3 bg-[#1c2541] rounded-xl border border-[#3a506b]">
                <div className="text-[10px] text-slate-400 uppercase">
                  {lang === 'ru' ? 'Ср. скорость потока' : 'Avg Traffic Speed'}
                </div>
                <div className="text-base font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                  <Activity className="w-4 h-4" />
                  {trafficMetrics.averageSpeedKmh.toFixed(1)} км/ч
                </div>
              </div>

              <div className="p-3 bg-[#1c2541] rounded-xl border border-[#3a506b]">
                <div className="text-[10px] text-slate-400 uppercase">
                  {lang === 'ru' ? 'Объекты в кадре' : 'Active Objects'}
                </div>
                <div className="text-base font-bold text-cyan-400 mt-0.5 flex items-center gap-2">
                  <span className="text-xs text-slate-300">🚗 {vehicleCount}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-xs text-emerald-300">🚶 {pedestrianCount}</span>
                </div>
              </div>
            </div>

            {/* Video + OpenCV Canvas Player Frame */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-[#3a506b] shadow-inner">
              {/* Underlying HTML5 Video for uploaded files */}
              {uploadedVideoUrl && (
                <video
                  ref={videoRef}
                  src={uploadedVideoUrl}
                  playsInline
                  loop
                  muted
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Overlaying OpenCV Canvas */}
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className={`w-full h-full ${uploadedVideoUrl ? 'absolute inset-0 pointer-events-none' : 'block'}`}
              />
            </div>

            {/* Streamlit Progress Bar (st.progress) & Status (st.text) */}
            <div className="space-y-2 font-mono text-xs">
              <div className="w-full bg-[#1c2541] h-2.5 rounded-full overflow-hidden border border-[#3a506b]">
                <div
                  className="bg-gradient-to-r from-[#00f2fe] to-emerald-400 h-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-400 text-[11px] gap-1">
                <span>
                  {lang === 'ru' ? 'Обработка кадра:' : 'Frame:'}{' '}
                  <strong className="text-white">{currentFrame} / {totalFrames}</strong> ({progressPercent.toFixed(1)}%)
                </span>
                <span className="text-[#00f2fe]">
                  {lang === 'ru' ? 'Скорость инференса:' : 'Inference Speed:'}{' '}
                  <strong>{pipelineFps.toFixed(1)} FPS</strong> (YOLOv8 + ByteTrack)
                </span>
              </div>
            </div>
          </div>

          {/* Player Actions & Controls */}
          <div className="pt-4 border-t border-[#3a506b] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="px-5 py-2.5 bg-[#00f2fe] hover:bg-[#00d8e4] text-[#0b132b] font-bold font-mono text-xs rounded-xl shadow-lg shadow-[#00f2fe]/20 transition-all flex items-center gap-2"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                {isPlaying
                  ? lang === 'ru' ? 'Пауза' : 'Pause'
                  : lang === 'ru' ? 'Запустить анализ (OpenCV + YOLOv8)' : 'Run Analysis (OpenCV + YOLOv8)'}
              </button>

              <button
                onClick={handleReset}
                className="p-2.5 bg-[#1c2541] hover:bg-[#3a506b] text-slate-300 rounded-xl transition-colors"
                title="Сброс"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportSnapshot}
                className="px-3.5 py-2 bg-[#1c2541] hover:bg-[#3a506b] text-slate-200 font-mono text-xs rounded-xl transition-colors flex items-center gap-1.5 border border-[#3a506b]"
              >
                <Download className="w-3.5 h-3.5 text-[#00f2fe]" />
                {lang === 'ru' ? 'Снимок кадра (.png)' : 'Export Frame (.png)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
