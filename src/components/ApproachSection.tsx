import React, { useState } from 'react';
import { ABLATION_STUDIES } from '../data/competitionData';
import { Sliders, Cpu, GitMerge, CheckCircle, Database, ShieldAlert, Zap } from 'lucide-react';

interface ApproachSectionProps {
  lang: 'en' | 'ru';
}

export const ApproachSection: React.FC<ApproachSectionProps> = ({ lang }) => {
  const [selectedAblationIdx, setSelectedAblationIdx] = useState<number>(3); // Default to final ensemble

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-cyan-400 font-mono">VisionForce Architecture</span>
          <span aria-hidden="true">·</span>
          <span>End-to-End Neural Pipeline</span>
          <span aria-hidden="true">·</span>
          <span>Real-Time Performance</span>
        </div>
        <h2 className="text-2xl font-bold text-white mt-1">
          {lang === 'ru' ? 'Архитектура системы: YOLOv8 + ByteTrack + OpenCV + Streamlit' : 'System Architecture: YOLOv8 + ByteTrack + OpenCV + Streamlit'}
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          {lang === 'ru'
            ? 'Сбалансированный производственный стек: нейросетевой детектор YOLOv8, мультиобъектный трекер ByteTrack, библиотека OpenCV (cv2) для покадровой нарезки видео .mp4 и отрисовки bounding box, а также интерактивный веб-интерфейс на Streamlit.'
            : 'Production-ready stack: YOLOv8 neural detector, ByteTrack multi-object tracker, OpenCV (cv2) for .mp4 video frame slicing and bounding box overlay rendering, with a Streamlit web application.'}
        </p>
      </div>

      {/* Visual System Architecture Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <GitMerge className="w-4 h-4 text-cyan-400" />
          {lang === 'ru' ? 'СКВОЗНОЙ ПАЙПЛАЙН ОБРАБОТКИ ВИДЕОПОТОКА' : 'END-TO-END VIDEO PROCESSING PIPELINE'}
        </h3>

        {/* Pipeline flowchart nodes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl relative space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400 font-bold">STAGE 01</span>
              <span className="text-emerald-400 font-bold">OpenCV (cv2)</span>
            </div>
            <h4 className="text-sm font-bold text-white">{lang === 'ru' ? 'Чтение .mp4 и нарезка' : 'OpenCV Frame Decoder'}</h4>
            <p className="text-xs text-slate-400">
              {lang === 'ru'
                ? 'cv2.VideoCapture выполняет прямое чтение видеопотока, извлекает метаданные (FPS, разрешение) и нарезает кадры в реальном времени.'
                : 'Direct .mp4 stream decoding, metadata extraction (FPS, frame count), and memory-efficient frame slicing.'}
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl relative space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400 font-bold">STAGE 02</span>
              <span className="text-emerald-400 font-bold">YOLOv8</span>
            </div>
            <h4 className="text-sm font-bold text-white">{lang === 'ru' ? 'Детектор YOLOv8' : 'YOLOv8 Neural Detection'}</h4>
            <p className="text-xs text-slate-400">
              {lang === 'ru'
                ? 'Быстрая и точная детекция участников движения (пешеходы, легковые автомобили, автобусы, грузовики) с вероятностным скорингом.'
                : 'High-speed object detection differentiating pedestrians, cars, buses, and trucks with high confidence.'}
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl relative space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400 font-bold">STAGE 03</span>
              <span className="text-amber-400 font-bold">ByteTrack</span>
            </div>
            <h4 className="text-sm font-bold text-white">{lang === 'ru' ? 'Трекер ByteTrack' : 'ByteTrack Multi-Object Tracking'}</h4>
            <p className="text-xs text-slate-400">
              {lang === 'ru'
                ? 'Ассоциация детекций, удержание постоянных ID при перекрытиях и построение векторов перемещения объектов.'
                : 'Robust track association, persistent ID retention during occlusions, and trajectory vector calculation.'}
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl relative space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400 font-bold">STAGE 04</span>
              <span className="text-cyan-400 font-bold">Streamlit & Overlay</span>
            </div>
            <h4 className="text-sm font-bold text-white">{lang === 'ru' ? 'Отрисовка и Streamlit' : 'BBox Overlay & Streamlit UI'}</h4>
            <p className="text-xs text-slate-400">
              {lang === 'ru'
                ? 'Отрисовка bounding box и траекторий через cv2.rectangle / cv2.line, вывод интерактивной панели в Streamlit.'
                : 'Rendering bounding boxes, speed radars, and live telemetry on Streamlit interactive web dashboard.'}
            </p>
          </div>
        </div>
      </div>

      {/* Learned vs Rule-Based Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
            <Cpu className="w-4 h-4" />
            {lang === 'ru' ? 'Обучаемые компоненты (Learned)' : 'Learned Components (Deep Neural)'}
          </div>
          <p className="text-xs text-slate-400">
            {lang === 'ru'
              ? 'Используются там, где визуальная вариативность слишком велика для ручных формул:'
              : 'Deployed where visual entropy and high feature variability render static heuristic formulas brittle:'}
          </p>
          <ul className="text-xs space-y-2.5 text-slate-300 font-mono">
            <li className="p-2.5 bg-slate-950 rounded border border-slate-800/80">
              <strong className="text-white block font-sans">1. Нейросетевой детектор (YOLOv8)</strong>
              {lang === 'ru'
                ? 'Быстрая многомасштабная модель Ultralytics YOLOv8 для точной локализации автомобилей, автобусов, пешеходов и препятствий на дороге.'
                : 'Ultralytics YOLOv8 high-speed multi-scale detector for precise bounding box localization of cars, buses, pedestrians, and obstacles.'}
            </li>
            <li className="p-2.5 bg-slate-950 rounded border border-slate-800/80">
              <strong className="text-white block font-sans">2. Мультиобъектный трекер (ByteTrack)</strong>
              {lang === 'ru'
                ? 'Сквозное отслеживание объектов даже при низком score детекций, предотвращение перескоков ID и построение траекторий.'
                : 'Robust multi-object tracking retaining tracklet identities across heavy occlusions and generating motion histories.'}
            </li>
            <li className="p-2.5 bg-slate-950 rounded border border-slate-800/80">
              <strong className="text-white block font-sans">3. Модуль обработки видео и рендеринга (OpenCV cv2)</strong>
              {lang === 'ru'
                ? 'Оптимизированное покадровое чтение .mp4, нарезка видеоряда и скоростная отрисовка bounding box и радара скорости.'
                : 'Optimized frame slicing, .mp4 decoding, and high-performance bounding box / velocity rendering.'}
            </li>
          </ul>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold uppercase">
            <Sliders className="w-4 h-4" />
            {lang === 'ru' ? 'Детерминированные правила (Rule-Based)' : 'Deterministic Rule-Based Logic (camera.md)'}
          </div>
          <p className="text-xs text-slate-400">
            {lang === 'ru'
              ? 'Используют жесткие геометрические факты фиксированной камеры для 100% стабильности:'
              : 'Grounded in invariant camera geometry from camera.md for maximum precision and zero drift:'}
          </p>
          <ul className="text-xs space-y-2.5 text-slate-300 font-mono">
            <li className="p-2.5 bg-slate-950 rounded border border-slate-800/80">
              <strong className="text-white block font-sans">1. Stop-Line & Red Light Infringement</strong>
              Front wheel polygon intersection test across line $Y = 735$ during active red light phase.
            </li>
            <li className="p-2.5 bg-slate-950 rounded border border-slate-800/80">
              <strong className="text-white block font-sans">2. Wrong-Way & Prohibited U-Turn</strong>
              Heading angle calculation from Kalman trajectory. Directional deviation $\theta &gt; 135^\circ$ triggers violation.
            </li>
            <li className="p-2.5 bg-slate-950 rounded border border-slate-800/80">
              <strong className="text-white block font-sans">3. Stopped Vehicle (10s Threshold) & Congestion</strong>
              Stationary duration timer with signal queue exclusion filter (vehicles within 3.5m of front vehicle are queued).
            </li>
          </ul>
        </div>
      </div>

      {/* Ablation Studies Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              EXPERIMENTAL ABLATIONS MATRIX &amp; SCORE BENCHMARKS
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated on our internal annotated dev set with evaluate.py metrics and T4 GPU time budget.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded">
            All comply with &lt; 3× wall-clock budget
          </span>
        </div>

        {/* Ablation Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border border-slate-800 rounded-lg overflow-hidden font-mono">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="p-3">Architecture Configuration</th>
                <th className="p-3">Sampling</th>
                <th className="p-3">Score A (Part A)</th>
                <th className="p-3">Score B (Part B)</th>
                <th className="p-3 text-cyan-300">Model Score M</th>
                <th className="p-3">FPS (T4)</th>
                <th className="p-3">VRAM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/50">
              {ABLATION_STUDIES.map((ab, idx) => {
                const isSelected = idx === selectedAblationIdx;
                return (
                  <tr
                    key={ab.configuration}
                    onClick={() => setSelectedAblationIdx(idx)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="p-3 font-bold text-white font-sans">{ab.configuration}</td>
                    <td className="p-3 text-slate-400">{ab.sampleFps} FPS</td>
                    <td className="p-3 text-slate-200">{ab.scoreA.toFixed(3)}</td>
                    <td className="p-3 text-slate-200">{ab.scoreB.toFixed(3)}</td>
                    <td className="p-3 text-cyan-400 font-bold">{ab.overallM.toFixed(3)}</td>
                    <td className="p-3 text-emerald-400 font-bold">{ab.fpsSpeed} FPS</td>
                    <td className="p-3 text-slate-400">{ab.vramMb} MB</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected Ablation Note */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[11px] font-mono text-cyan-400 uppercase font-bold">Engineering Takeaway:</span>
          <p className="text-xs text-slate-300 font-sans leading-relaxed">
            {ABLATION_STUDIES[selectedAblationIdx].notes}
          </p>
        </div>
      </div>

      {/* External Public Datasets & Licensing Compliance */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          DATASETS USED &amp; OPEN-WEIGHTS LICENSING COMPLIANCE
        </h3>
        <p className="text-xs text-slate-400">
          As mandated in the challenge rules: strictly open weights, zero proprietary API calls (no OpenAI, Gemini, or Anthropic during inference).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs font-bold text-white block">DoTA Dataset</span>
            <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">Detection of Traffic Anomalies</span>
            <p className="text-[11px] text-slate-400 mt-2">4,677 videos with spatio-temporal accident bounding boxes.</p>
            <span className="text-[10px] font-mono text-slate-500 block mt-2">License: CC BY-NC 4.0</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs font-bold text-white block">CADP Dataset</span>
            <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">Car Accident Detection &amp; Prediction</span>
            <p className="text-[11px] text-slate-400 mt-2">Traffic surveillance collisions with precise pre-crash lead times.</p>
            <span className="text-[10px] font-mono text-slate-500 block mt-2">License: Apache 2.0</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs font-bold text-white block">UA-DETRAC Benchmark</span>
            <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">Urban Traffic Surveillance</span>
            <p className="text-[11px] text-slate-400 mt-2">140,000 frames under heavy occlusions, rain, and night conditions.</p>
            <span className="text-[10px] font-mono text-slate-500 block mt-2">License: Academic Research</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-xs font-bold text-white block">BDD100K</span>
            <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">Berkeley DeepDrive</span>
            <p className="text-[11px] text-slate-400 mt-2">Lane markings, stop lines, pedestrian crossings, and vehicle trajectories.</p>
            <span className="text-[10px] font-mono text-slate-500 block mt-2">License: BSD 3-Clause</span>
          </div>
        </div>
      </div>
    </div>
  );
};
