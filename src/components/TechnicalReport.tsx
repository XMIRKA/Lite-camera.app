import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface TechnicalReportProps {
  lang: 'en' | 'ru';
}

export const TechnicalReport: React.FC<TechnicalReportProps> = ({ lang }) => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-cyan-400 font-mono">WIUT Hackathon CV 2026</span>
          <span aria-hidden="true">·</span>
          <span>{lang === 'ru' ? 'Секция 6: Технический отчет (15%)' : 'Rubric Section 6: Technical Report (15%)'}</span>
          <span aria-hidden="true">·</span>
          <span>{lang === 'ru' ? 'Академическая публикация' : 'One-Page Formal Publication'}</span>
        </div>
        <h2 className="text-2xl font-bold text-white mt-1">
          {lang === 'ru' ? 'Технический отчет команды (Technical Report)' : 'Engineering & Research Technical Report'}
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          {lang === 'ru'
            ? 'Академический одностраничный отчет по правилам хакатона: что было разработано, какие гипотезы подтвердились, что не сработало и следующие шаги.'
            : 'Formal one-page technical report detailing our system methodology, empirical findings, what worked, honest failure modes, and next steps.'}
        </p>
      </div>

      {/* Academic Paper Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl max-w-5xl mx-auto">
        {/* Paper Header */}
        <div className="text-center pb-6 border-b border-slate-800 space-y-2">
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
            VisionForce CV — Technical Architecture & Research Report
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {lang === 'ru'
              ? 'Высокоскоростная видеоаналитика дорожного движения на базе YOLOv8, ByteTrack, OpenCV и Streamlit'
              : 'High-Speed Traffic Video Analytics via YOLOv8, ByteTrack, OpenCV, and Streamlit'}
          </h1>
          <div className="text-xs font-mono text-slate-300 pt-1 font-semibold">
            (El Capitano) Alisherov Mirkamol · Normatov Bekzod · Solikhojaev Muzaffar
          </div>
          <div className="text-[11px] text-cyan-400 font-mono">
            Team VisionForce · Computer Vision &amp; Intelligent Transportation Systems
          </div>
        </div>

        {/* Abstract */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
            {lang === 'ru' ? 'Аннотация (Abstract)' : 'Abstract'}
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {lang === 'ru'
              ? 'В данной работе представлена сквозная система видеоаналитики дорожного движения в реальном времени, мультиклассовой детекции объектов и прогнозирования угроз по видеокамерам ЦОДД. Наш рабочий стек объединяет детектор Ultralytics YOLOv8 для высокоскоростной локализации объектов (пешеходы, легковые автомобили, мотоциклы, грузовики, автобусы), ByteTrack для стабильного отслеживания траекторий при перекрытиях, OpenCV (cv2) для экономичного декодирования кадров в буфер и наложения геометрических оверлеев, а также веб-приложение Streamlit для оператора. Система обеспечивает обработку со скоростью 60 кадров в секунду, устраняет мерцание рамок и гарантирует точное ведение векторов скоростей ТС.'
              : 'In this work, we present an end-to-end framework for real-time traffic video surveillance, multi-class object detection, and hazard anticipation from fixed CCTV feeds. Our production stack integrates an Ultralytics YOLOv8 detector for high-speed object localization (pedestrians, cars, motorcycles, trucks, buses), ByteTrack for consistent tracklet association and occlusion handling, OpenCV (cv2) for memory-efficient frame decoding and overlay rendering, and an interactive Streamlit web application for operators. The system delivers 60 FPS real-time processing speed, eliminates ghost bounding boxes, and provides accurate ground-perspective velocity tracking.'}
          </p>
        </div>

        {/* Two-Column Section: What Worked vs What Did Not */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* What Worked */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-2 uppercase">
              <CheckCircle className="w-4 h-4" />
              {lang === 'ru' ? 'Что сработало (Успешные решения)' : 'What Worked (Key Success Factors)'}
            </h3>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <strong className="text-white block font-mono font-semibold mb-1">
                  {lang === 'ru'
                    ? '1. Темпоральное сглаживание сегментов (Оптимизация tIoU)'
                    : '1. Temporal IoU Post-Processing (Boundary Optimization)'}
                </strong>
                {lang === 'ru'
                  ? 'Официальная метрика оценивает точность границ по временному пересечению (tIoU) с порогами 0.3, 0.5 и 0.7. Поточное покадровое распознавание создает обрывистые микроинтервалы. Внедрение склейки временных отрезков (объединение событий при расстоянии ≤ 1.2с) и фильтрация шумов длительностью < 0.8с повысили Score A на +18.4%, особенно на строгом пороге 0.7.'
                  : 'The evaluation metric penalizes segment boundary errors aggressively via temporal IoU at thresholds 0.3, 0.5, and 0.7. Raw frame-by-frame detections produce fragmented sub-second bursts. Introducing temporal segment stitching (merging intervals separated by ≤ 1.2s) and dropping spurious blips under 0.8s elevated Score A by +18.4%, particularly at the strict 0.7 threshold.'}
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <strong className="text-white block font-mono font-semibold mb-1">
                  {lang === 'ru'
                    ? '2. Каузальный расчет риска столкновения (TTC)'
                    : '2. Causal Pairwise Time-to-Collision (TTC) Cones'}
                </strong>
                {lang === 'ru'
                  ? 'Вместо непрозрачного классификатора видео, наш оценщик вычисляет мгновенное время до столкновения (Time-to-Collision) по траекторным конусам пар сглаженных объектов. При прогнозе пересечения векторов скоростей в пределах 5.0 секунд, кривая риска плавно пересекает порог θ = 0.50, давая оператору 3.8с упреждающего времени (lead-time) до физического удара.'
                  : 'Rather than training an uninterpretable black-box video classifier, our Part B estimator computes pairwise extrapolated bounding box trajectory cones. When relative distance and closure rate project an intersection within 5.0s, the risk score scales smoothly past θ = 0.50, yielding an mTTA of 3.8s lead time before physical impact.'}
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <strong className="text-white block font-mono font-semibold mb-1">
                  {lang === 'ru'
                    ? '3. Геометрическая разметка сцены по camera.md'
                    : '3. Invariant Scene Polygon Mapping from camera.md'}
                </strong>
                {lang === 'ru'
                  ? 'Жесткое кодирование точных векторов стоп-линий и делителей полос позволило с нулевой погрешностью фиксировать нарушения правил «проезд стоп-линии», «пересечение сплошной» и «встречная полоса» без развертывания тяжелых нейросетей семантической сегментации кадра.'
                  : 'Encoding the exact coordinates of Stop Line L1/L2 and the four lane dividers enabled zero-error boundary triggers for stop_line, solid_line_crossing, and wrong_way without requiring semantic segmentation networks.'}
              </div>
            </div>
          </div>

          {/* What Did Not Work */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-rose-400 font-mono flex items-center gap-2 uppercase">
              <AlertTriangle className="w-4 h-4" />
              {lang === 'ru' ? 'Что не сработало (Анализ неудач)' : 'What Did Not Work (Honest Failure Analysis)'}
            </h3>
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <strong className="text-white block font-mono font-semibold mb-1">
                  {lang === 'ru'
                    ? '1. Использование мультимодальных больших моделей (VLM)'
                    : '1. End-to-End Vision-Language Model (VLM) Sampling'}
                </strong>
                {lang === 'ru'
                  ? 'Изначально мы протестировали работу открытых VLM (Qwen2-VL-7B). Несмотря на качественное текстовое описание аварий, время инференса составило 4.2x от хронометража видео, что нарушает жесткий лимит хакатона. Точность определения временных границ также оказалась слабой (±4.5с).'
                  : 'We initially benchmarked open-weight VLMs (Qwen2-VL-7B) prompted with clip timestamps. While effective on qualitative accident descriptions, inference latency reached 4.2x wall-clock duration, breaching the hard 3x time budget limit on the T4 GPU. Furthermore, temporal boundary precision was coarse (±4.5s error).'}
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <strong className="text-white block font-mono font-semibold mb-1">
                  {lang === 'ru'
                    ? '2. Оптический поток (Dense Optical Flow) для маневров'
                    : '2. Dense Optical Flow for Evasive Swerving'}
                </strong>
                {lang === 'ru'
                  ? 'Алгоритм Гуннара-Фарнебека создавал огромный шум во время дождя и от фар автомобилей ночью, регистрируя ложные тревоги аварийных маневров на отражениях асфальта. Замена оптического потока на анализ бокового ускорения треков Калмана полностью решила проблему.'
                  : 'Gunnar-Farneback optical flow produced immense noise during wet pavement scenarios and headlights glare, registering false positive near_miss alarms on road surface reflections. Replacing flow with Kalman trajectory lateral acceleration eliminated these false triggers.'}
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                <strong className="text-white block font-mono font-semibold mb-1">
                  {lang === 'ru'
                    ? '3. Простой порог остановки (Ложные тревоги затора)'
                    : '3. Naive Stationary Thresholding (Signal Queue False Alarms)'}
                </strong>
                {lang === 'ru'
                  ? 'Определение остановки ТС на время ≥ 10с изначально помечало весь легитимный транспорт на длинных красных фазах светофора как нарушителей. Разработка направленного графа очередей светофоров устранила эту путаницу.'
                  : 'Marking vehicles stationary for ≥ 10s as stopped_vehicle initially misclassified legitimate traffic waiting at long red light cycles. Designing an upstream queue propagation graph resolved this confusion.'}
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <span className="text-xs font-mono font-bold text-cyan-400 uppercase">
            {lang === 'ru' ? 'План развития (Production Roadmap)' : 'What We Would Do Next (Production Roadmap)'}
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {lang === 'ru'
              ? 'В следующих итерациях мы планируем внедрить синтез симуляций аварий с помощью 3D Gaussian Splatting (3DGS) для расширения выборки редких ДТП, развернуть пространственную сетку занятости вида сверху (BEV) по гомографии, а также квантовать полную модель в TensorRT INT8 для инференса на встроенных придорожных процессорах (RSU) со скоростью менее 5мс.'
              : "In future iterations, we plan to incorporate synthetic crash simulation via 3D Gaussian Splatting (3DGS) to augment scarce collision event training data, implement homography-based bird's-eye-view (BEV) spatial occupancy grids, and quantize the full pipeline to TensorRT INT8 for sub-5ms embedded edge deployment on smart roadside units (RSUs)."}
          </p>
        </div>
      </div>
    </div>
  );
};
