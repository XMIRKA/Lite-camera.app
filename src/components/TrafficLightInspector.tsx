import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Upload,
  Crosshair,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Eye,
  Info
} from 'lucide-react';

export interface TrafficLightInspectorProps {
  sampleVideoUrl?: string;
}

export type SignalState = 'RED' | 'YELLOW' | 'GREEN' | 'ANALYZING';

export interface ZonePixelStats {
  redZoneCount: number;
  yellowZoneCount: number;
  greenZoneCount: number;
  totalValidPixels: number;
  activeState: SignalState;
  confidence: number;
}

/**
 * Converts RGBA [0..255] to HSV (H: 0..180 degrees OpenCV scale, S: 0..1, V: 0..1)
 */
export function rgbToHsvOpenCV(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case rf:
        h = (gf - bf) / d + (gf < bf ? 6 : 0);
        break;
      case gf:
        h = (bf - rf) / d + 2;
        break;
      case bf:
        h = (rf - gf) / d + 4;
        break;
    }
    h = (h / 6) * 180; // 0..180 scale
  }

  return { h, s, v };
}

export const TrafficLightInspector: React.FC<TrafficLightInspectorProps> = ({
  sampleVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
}) => {
  // Media & Video State
  const [videoSrc, setVideoUrl] = useState<string>(sampleVideoUrl);
  const [videoName, setVideoName] = useState<string>('Sample Traffic Video (.mp4)');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(0);

  // ROI Mouse Selection State: normalized [x1, y1, x2, y2] in 0..1 scale
  const [roi, setRoi] = useState<[number, number, number, number] | null>([0.68, 0.12, 0.76, 0.38]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // Analysis Metrics State
  const [stats, setStats] = useState<ZonePixelStats>({
    redZoneCount: 0,
    yellowZoneCount: 0,
    greenZoneCount: 0,
    totalValidPixels: 0,
    activeState: 'ANALYZING',
    confidence: 0
  });

  // Element Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. HSV PIXELsamPLING & 3-ZONE VERTICAL ANALYSIS ENGINE
  // ══════════════════════════════════════════════════════════════════════════
  const analyzeCropArea = useCallback(
    (video: HTMLVideoElement, cropCanvas: HTMLCanvasElement, bbox: [number, number, number, number]): ZonePixelStats => {
      const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx || video.readyState < 2 || video.videoWidth === 0) {
        return { redZoneCount: 0, yellowZoneCount: 0, greenZoneCount: 0, totalValidPixels: 0, activeState: 'ANALYZING', confidence: 0 };
      }

      const [x1, y1, x2, y2] = bbox;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const cropX = Math.max(0, Math.floor(Math.min(x1, x2) * vw));
      const cropY = Math.max(0, Math.floor(Math.min(y1, y2) * vh));
      const cropW = Math.max(4, Math.floor(Math.abs(x2 - x1) * vw));
      const cropH = Math.max(4, Math.floor(Math.abs(y2 - y1) * vh));

      if (cropCanvas.width !== cropW || cropCanvas.height !== cropH) {
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
      }

      try {
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const imgData = ctx.getImageData(0, 0, cropW, cropH);
        const data = imgData.data;

        let redZoneCount = 0;
        let yellowZoneCount = 0;
        let greenZoneCount = 0;
        let totalValidPixels = 0;

        const zoneHeight = cropH / 3;

        for (let y = 0; y < cropH; y++) {
          const isTopZone = y < zoneHeight;              // Upper third: RED
          const isMidZone = y >= zoneHeight && y < zoneHeight * 2; // Middle third: YELLOW
          const isBotZone = y >= zoneHeight * 2;          // Lower third: GREEN

          for (let x = 0; x < cropW; x++) {
            const idx = (y * cropW + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const { h, s, v } = rgbToHsvOpenCV(r, g, b);

            // WASHOUT GLARE PROTECTION:
            // Ignore pixels with low saturation and high value (sunlight reflections on glass)
            if (s < 0.35 && v > 0.50) {
              continue;
            }

            // Minimum brightness threshold
            if (v < 0.15) {
              continue;
            }

            // HUE RANGE FILTERING (H in 0..180 scale)
            // A. Red Hue: 0..15 and 165..180
            const isRedHue = (h >= 0 && h <= 15) || (h >= 165 && h <= 180);
            if (isRedHue && isTopZone) {
              redZoneCount++;
              totalValidPixels++;
              continue;
            }

            // B. Yellow Hue: 20..35
            const isYellowHue = h >= 20 && h <= 35;
            if (isYellowHue && isMidZone) {
              yellowZoneCount++;
              totalValidPixels++;
              continue;
            }

            // C. Green Hue: 40..85
            const isGreenHue = h >= 40 && h <= 85;
            if (isGreenHue && isBotZone) {
              greenZoneCount++;
              totalValidPixels++;
              continue;
            }
          }
        }

        // Active State Decision Rule
        let activeState: SignalState = 'ANALYZING';
        let maxCount = Math.max(redZoneCount, yellowZoneCount, greenZoneCount);
        let confidence = totalValidPixels > 0 ? Math.min(0.99, (maxCount / totalValidPixels) * 0.75 + 0.25) : 0;

        if (totalValidPixels >= 4 && maxCount > 2) {
          if (maxCount === redZoneCount) activeState = 'RED';
          else if (maxCount === yellowZoneCount) activeState = 'YELLOW';
          else if (maxCount === greenZoneCount) activeState = 'GREEN';
        }

        return {
          redZoneCount,
          yellowZoneCount,
          greenZoneCount,
          totalValidPixels,
          activeState,
          confidence
        };
      } catch {
        return { redZoneCount: 0, yellowZoneCount: 0, greenZoneCount: 0, totalValidPixels: 0, activeState: 'ANALYZING', confidence: 0 };
      }
    },
    []
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 2. MAIN 60 FPS requestAnimationFrame LOOP & CANVAS RENDER
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!cropCanvasRef.current) {
      cropCanvasRef.current = document.createElement('canvas');
    }

    const loop = () => {
      const now = performance.now();
      frameCountRef.current++;
      if (now - lastTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (canvas && video) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          let currentStats = stats;

          // A. Perform Optical Pixel Analysis on Active ROI
          if (roi && video.readyState >= 2) {
            currentStats = analyzeCropArea(video, cropCanvasRef.current!, roi);
            setStats(currentStats);
          }

          // B. Draw Active ROI Box & HUD Overlay
          if (roi) {
            const [x1, y1, x2, y2] = roi;
            const rx = Math.min(x1, x2) * w;
            const ry = Math.min(y1, y2) * h;
            const rw = Math.abs(x2 - x1) * w;
            const rh = Math.abs(y2 - y1) * h;

            const state = currentStats.activeState;
            const activeColor =
              state === 'RED'
                ? '#ef4444'
                : state === 'YELLOW'
                ? '#f59e0b'
                : state === 'GREEN'
                ? '#10b981'
                : '#38bdf8';

            const stateText =
              state === 'RED'
                ? '🔴 RED'
                : state === 'YELLOW'
                ? '🟡 YELLOW'
                : state === 'GREEN'
                ? '🟢 GREEN'
                : '🔍 АНАЛИЗ ФАЗЫ...';

            // 1. Neon Glowing Outer Frame
            ctx.save();
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 16;
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 3;
            ctx.fillStyle =
              state === 'RED'
                ? 'rgba(239, 68, 68, 0.15)'
                : state === 'YELLOW'
                ? 'rgba(245, 158, 11, 0.15)'
                : state === 'GREEN'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(56, 189, 248, 0.10)';

            ctx.fillRect(rx, ry, rw, rh);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.restore();

            // 2. Corner Bracket Accents
            const cLen = Math.min(14, Math.min(rw, rh) * 0.25);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            // Top-Left
            ctx.moveTo(rx, ry + cLen); ctx.lineTo(rx, ry); ctx.lineTo(rx + cLen, ry);
            // Top-Right
            ctx.moveTo(rx + rw - cLen, ry); ctx.lineTo(rx + rw, ry); ctx.lineTo(rx + rw, ry + cLen);
            // Bottom-Right
            ctx.moveTo(rx + rw, ry + rh - cLen); ctx.lineTo(rx + rw, ry + rh); ctx.lineTo(rx + rw - cLen, ry + rh);
            // Bottom-Left
            ctx.moveTo(rx + cLen, ry + rh); ctx.lineTo(rx, ry + rh); ctx.lineTo(rx, ry + rh - cLen);
            ctx.stroke();

            // 3. 3-Zone Dashed Dividers inside ROI
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(rx, ry + rh / 3);
            ctx.lineTo(rx + rw, ry + rh / 3);
            ctx.moveTo(rx, ry + (rh * 2) / 3);
            ctx.lineTo(rx + rw, ry + (rh * 2) / 3);
            ctx.stroke();
            ctx.restore();

            // 4. State Header HUD Badge
            ctx.font = 'bold 13px JetBrains Mono, monospace';
            const badgeW = Math.max(rw, ctx.measureText(stateText).width + 16);
            const badgeY = ry > 32 ? ry - 28 : ry + rh + 8;

            ctx.fillStyle = 'rgba(2, 6, 23, 0.94)';
            ctx.fillRect(rx, badgeY, badgeW, 24);
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(rx, badgeY, badgeW, 24);

            ctx.fillStyle = activeColor;
            ctx.fillText(stateText, rx + 8, badgeY + 16);
          }

          // C. Draw Mouse Drawing Interactive Box
          if (isDrawing && drawStart && drawCurrent) {
            const rx1 = Math.min(drawStart.x, drawCurrent.x) * w;
            const ry1 = Math.min(drawStart.y, drawCurrent.y) * h;
            const rw1 = Math.abs(drawCurrent.x - drawStart.x) * w;
            const rh1 = Math.abs(drawCurrent.y - drawStart.y) * h;

            ctx.save();
            ctx.fillStyle = 'rgba(56, 189, 248, 0.20)';
            ctx.fillRect(rx1, ry1, rw1, rh1);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(rx1, ry1, rw1, rh1);
            ctx.restore();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [roi, isDrawing, drawStart, drawCurrent, analyzeCropArea]);

  // ══════════════════════════════════════════════════════════════════════════
  // 3. MOUSE DRAWING HANDLERS
  // ══════════════════════════════════════════════════════════════════════════
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    setIsDrawing(true);
    setDrawStart({ x: nx, y: ny });
    setDrawCurrent({ x: nx, y: ny });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setDrawCurrent({ x: nx, y: ny });
  };

  const handleMouseUp = () => {
    if (isDrawing && drawStart && drawCurrent) {
      const x1 = Math.min(drawStart.x, drawCurrent.x);
      const y1 = Math.min(drawStart.y, drawCurrent.y);
      const x2 = Math.max(drawStart.x, drawCurrent.x);
      const y2 = Math.max(drawStart.y, drawCurrent.y);

      if (Math.abs(x2 - x1) > 0.01 && Math.abs(y2 - y1) > 0.01) {
        setRoi([x1, y1, x2, y2]);
      }
    }
    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoName(file.name);
      setIsPlaying(true);
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl text-slate-200 font-sans space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>HSV 3-ZONE OPTICAL DETECTOR</span>
            <span>•</span>
            <span className="text-emerald-400 font-bold">{fps} FPS</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
            <span>Инспектор Светофоров в Реальном Времени</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Зажмите ЛКМ и обведите светофор на видео мышкой для мгновенного определения фазы (25+ FPS)
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? 'Пауза' : 'Пуск'}</span>
          </button>

          <button
            onClick={() => setRoi(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Сбросить ROI</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Загрузить MP4</span>
          </button>
          <input type="file" ref={fileInputRef} accept="video/mp4,video/webm" onChange={handleFileUpload} className="hidden" />
        </div>
      </div>

      {/* Main Grid: Video Viewport & Stats Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Viewport Area */}
        <div className="lg:col-span-8 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden relative group shadow-xl">
          <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              loop
              muted
              autoPlay
              crossOrigin="anonymous"
              className="w-full h-full object-fill pointer-events-none"
            />

            <canvas
              ref={canvasRef}
              width={1280}
              height={720}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="absolute inset-0 w-full h-full cursor-crosshair z-10"
            />
          </div>

          {/* Bottom Banner */}
          <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="truncate max-w-xs">{videoName}</span>
            <span>{roi ? `ROI: [${roi.map(v => v.toFixed(2)).join(', ')}]` : 'Зажмите ЛКМ и обведите светофор'}</span>
          </div>
        </div>

        {/* Side Metrics Panel */}
        <div className="lg:col-span-4 space-y-4">
          {/* Active State Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
            <span className="text-xs font-mono text-slate-400 font-bold block">АКТИВНАЯ ФАЗА СВЕТОФОРА</span>

            <div
              className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                stats.activeState === 'RED'
                  ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-lg shadow-red-500/10'
                  : stats.activeState === 'YELLOW'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10'
                  : stats.activeState === 'GREEN'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <div>
                <div className="text-2xl font-black font-mono tracking-wide">
                  {stats.activeState === 'RED'
                    ? '🔴 RED'
                    : stats.activeState === 'YELLOW'
                    ? '🟡 YELLOW'
                    : stats.activeState === 'GREEN'
                    ? '🟢 GREEN'
                    : '🔍 ПОИСК'}
                </div>
                <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                  Уверенность: {Math.round(stats.confidence * 100)}%
                </span>
              </div>
              <Sparkles className="w-8 h-8 opacity-80" />
            </div>

            {/* 3-Zone Histogram Bars */}
            <div className="space-y-2 pt-2 border-t border-slate-800 font-mono text-xs">
              <span className="text-[11px] text-slate-400 block font-bold">ПОПИКСЕЛЬНОЕ РАСПРЕДЕЛЕНИЕ 3-Х ЗОН:</span>

              {/* Red Zone */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-red-400 font-bold">Верхняя зона (Красный):</span>
                  <span className="text-slate-300">{stats.redZoneCount} px</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-red-500 transition-all duration-150"
                    style={{
                      width: `${stats.totalValidPixels > 0 ? (stats.redZoneCount / stats.totalValidPixels) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Yellow Zone */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-amber-400 font-bold">Средняя зона (Жёлтый):</span>
                  <span className="text-slate-300">{stats.yellowZoneCount} px</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-amber-500 transition-all duration-150"
                    style={{
                      width: `${stats.totalValidPixels > 0 ? (stats.yellowZoneCount / stats.totalValidPixels) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              {/* Green Zone */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-emerald-400 font-bold">Нижняя зона (Зелёный):</span>
                  <span className="text-slate-300">{stats.greenZoneCount} px</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-150"
                    style={{
                      width: `${stats.totalValidPixels > 0 ? (stats.greenZoneCount / stats.totalValidPixels) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Algorithm Spec Info */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-2 text-slate-400">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Info className="w-4 h-4" />
              <span>Параметры HSV-фильтрации</span>
            </div>
            <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-400">
              <li>Защита от бликов: Saturation &lt; 0.35 & Value &gt; 0.50</li>
              <li>Красный Hue: 0..15 & 165..180 (Верхняя 1/3)</li>
              <li>Жёлтый Hue: 20..35 (Средняя 1/3)</li>
              <li>Зелёный Hue: 40..85 (Нижняя 1/3)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrafficLightInspector;
