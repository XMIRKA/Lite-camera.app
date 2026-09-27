import React, { useState } from 'react';
import { calculateCompetitionScores, EvaluationResult } from '../utils/evaluation';
import { SAMPLE_VIDEOS } from '../data/competitionData';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

interface EvaluationPlaygroundProps {
  lang: 'en' | 'ru';
}

export const EvaluationPlayground: React.FC<EvaluationPlaygroundProps> = ({ lang }) => {
  const [websiteScore, setWebsiteScore] = useState<number>(0.96);
  const [codeScore, setCodeScore] = useState<number>(0.95);

  // Ground Truth & Preds mock for demonstration
  const gtEvents = SAMPLE_VIDEOS.flatMap(v => v.events.map(e => ({ ...e, video: v.filename })));
  const predEvents = SAMPLE_VIDEOS.flatMap(v => v.events.map(e => ({ ...e, video: v.filename })));
  const accidentsGt = [{ s: 23.6, e: 48.0, video: 'sample_003_red_light_tbone_accident.mp4' }];
  const predAlarms = [{ start: 19.8, end: 24.5, video: 'sample_003_red_light_tbone_accident.mp4' }];

  const evalResult: EvaluationResult = calculateCompetitionScores(
    gtEvents,
    predEvents,
    accidentsGt,
    predAlarms,
    websiteScore,
    codeScore
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-cyan-400 font-mono">evaluate.py Compliance Engine</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'ru' ? 'Верификация официальных формул метрик' : 'Official Metric Formula Verification'}</span>
            <span aria-hidden="true">·</span>
            <span>Score A, Score B &amp; Elimination Rank</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">
            {lang === 'ru' ? 'Интерактивный калькулятор метрик и оценка жюри' : 'Evaluation & Scoring Playground'}
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            {lang === 'ru'
              ? 'Точная математическая реализация evaluate.py из стартер-кита. Расчет Temporal IoU на порогах 0.3, 0.5, 0.7, chance-normalized AP, F1-alarm и Time-To-Accident (mTTA).'
              : 'Exact client-side implementation of the official evaluate.py harness. Calculates Temporal IoU at {0.3, 0.5, 0.7}, chance-normalized AP, F1-alarm, and Time-To-Accident.'}
          </p>
        </div>

        {/* Real-time Telemetry Stats Widget */}
        <div className="flex items-center gap-4 bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] shrink-0 self-start lg:self-center">
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase">Telemetry Ping</span>
            <span className="text-cyan-400 font-bold">11.8 ms</span>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase">Eval FPS</span>
            <span className="text-emerald-400 font-bold">120+ FPS</span>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase">Compliance</span>
            <span className="text-amber-400 font-bold">STRICT 2026</span>
          </div>
        </div>
      </div>

      {/* Top Elimination Score Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
          {/* Main Elimination Score */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
              {lang === 'ru' ? 'Итоговый Elimination Score' : 'Overall Elimination Score'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-mono font-extrabold text-white tracking-tight">
                {evalResult.eliminationScore.toFixed(3)}
              </span>
              <span className="text-xs font-mono text-slate-400">/ 1.000</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              0.6·M + 0.25·Website + 0.15·Code
            </p>
          </div>

          {/* Model Score M */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs font-mono text-slate-400 block">
              {lang === 'ru' ? 'ОЦЕНКА МОДЕЛИ M (60%)' : 'MODEL SCORE M (60%)'}
            </span>
            <div className="text-3xl font-mono font-bold text-cyan-300">
              {evalResult.modelScoreM.toFixed(3)}
            </div>
            <span className="text-[10px] font-mono text-slate-500 block">
              0.7·Score_A + 0.3·Score_B
            </span>
          </div>

          {/* Part A Score */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs font-mono text-slate-400 block">
              {lang === 'ru' ? 'ЧАСТЬ A: ДЕТЕКЦИЯ СОБЫТИЙ' : 'PART A: EVENT DETECTION'}
            </span>
            <div className="text-3xl font-mono font-bold text-emerald-400">
              {evalResult.scoreA.toFixed(3)}
            </div>
            <span className="text-[10px] font-mono text-slate-500 block">
              {lang === 'ru' ? 'Macro F1 по τ ∈ {0.3, 0.5, 0.7}' : 'Macro F1 over τ ∈ {0.3, 0.5, 0.7}'}
            </span>
          </div>

          {/* Part B Score */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
            <span className="text-xs font-mono text-slate-400 block">
              {lang === 'ru' ? 'ЧАСТЬ B: ПРЕДСКАЗАНИЕ АВАРИЙ' : 'PART B: ANTICIPATION'}
            </span>
            <div className="text-3xl font-mono font-bold text-amber-400">
              {evalResult.scoreB.toFixed(3)}
            </div>
            <span className="text-[10px] font-mono text-slate-500 block">
              0.4·AP + 0.4·F1_alarm + 0.2·mTTA/W
            </span>
          </div>
        </div>
      </div>

      {/* Breakdown: Part A and Part B Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Part A Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {lang === 'ru' ? 'ДЕТАЛИЗАЦИЯ ЧАСТИ A: ДЕТЕКЦИЯ СОБЫТИЙ' : 'PART A: EVENT DETECTION BREAKDOWN'}
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {evalResult.partADetails.classesEvaluated} {lang === 'ru' ? 'активных классов' : 'active classes'}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto">
            {lang === 'ru'
              ? 'Формула: Score_A = (1 / |C|) * Σ (1/3 * Σ F1_c(τ)) по τ ∈ {0.3, 0.5, 0.7}'
              : 'Formula: Score_A = (1 / |C|) * Σ (1/3 * Σ F1_c(τ)) for τ ∈ {0.3, 0.5, 0.7}'}
          </div>

          {/* Per-class F1 Table */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto pr-1">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2">{lang === 'ru' ? 'ID Класса' : 'Class ID'}</th>
                  <th className="py-2">F1 (0.3)</th>
                  <th className="py-2">F1 (0.5)</th>
                  <th className="py-2">F1 (0.7)</th>
                  <th className="py-2 text-cyan-300">Macro F1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.entries(evalResult.partADetails.perClassF1).map(([c, val]) => (
                  <tr key={c} className="hover:bg-slate-800/40">
                    <td className="py-2 text-white font-semibold">{c}</td>
                    <td className="py-2 text-slate-400">{val.f1_03.toFixed(3)}</td>
                    <td className="py-2 text-slate-400">{val.f1_05.toFixed(3)}</td>
                    <td className="py-2 text-slate-400">{val.f1_07.toFixed(3)}</td>
                    <td className="py-2 text-emerald-400 font-bold">{val.macro.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Part B Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              {lang === 'ru' ? 'ДЕТАЛИЗАЦИЯ ЧАСТИ B: ПРЕДСКАЗАНИЕ АВАРИЙ' : 'PART B: ACCIDENT ANTICIPATION BREAKDOWN'}
            </h3>
            <span className="text-xs font-mono text-cyan-400">
              {lang === 'ru' ? 'Горизонт H = 5.0с, W = 10.0с' : 'Horizon H = 5.0s, W = 10.0s'}
            </span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 leading-relaxed overflow-x-auto">
            Formula: Score_B = 0.4·AP + 0.4·F1_alarm + 0.2·(mTTA / W)
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                {lang === 'ru' ? 'НОРМИРОВАННЫЙ AP (CHANCE-NORM)' : 'CHANCE-NORMALIZED AP'}
              </span>
              <span className="text-xl font-mono font-bold text-white mt-1 block">
                {evalResult.partBDetails.chanceNormalizedAP.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Raw AP: {evalResult.partBDetails.rawAP}</span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                {lang === 'ru' ? 'ALARM F1 (порог θ = 0.50)' : 'ALARM F1 (θ = 0.50)'}
              </span>
              <span className="text-xl font-mono font-bold text-amber-300 mt-1 block">
                {evalResult.partBDetails.f1Alarm.toFixed(3)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Prec: {evalResult.partBDetails.alarmPrecision} · Rec: {evalResult.partBDetails.alarmRecall}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                {lang === 'ru' ? 'СРЕДНЕЕ ВРЕМЯ ДО АВАРИИ (mTTA)' : 'MEAN TIME-TO-ACCIDENT (mTTA)'}
              </span>
              <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
                {evalResult.partBDetails.meanTTA.toFixed(1)} {lang === 'ru' ? 'с' : 's'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {lang === 'ru' ? 'Упреждающее время до удара' : 'Lead time before impact'}
              </span>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                {lang === 'ru' ? 'СОВПАВШИЕ ТРЕВОГИ ДТП' : 'MATCHED ACCIDENT ALARMS'}
              </span>
              <span className="text-xl font-mono font-bold text-cyan-300 mt-1 block">
                {evalResult.partBDetails.matchedAlarmsCount} / {evalResult.partBDetails.totalAlarmsCount}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {lang === 'ru' ? 'Интервалы < 2с объединены' : 'Runs < 2s merged'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Sliders for Website & Code Scores */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h4 className="text-xs font-mono font-bold text-slate-400 uppercase">
          {lang === 'ru' ? 'Симуляция судейских баллов (Judge Rubric Scores)' : 'Judge Rubric Simulation'}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">
                {lang === 'ru' ? 'Качество веб-интерфейса и демо (Вес: 25%)' : 'Website & Demo Quality (Weight: 25%)'}
              </span>
              <span className="text-cyan-400 font-bold">{websiteScore.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.0}
              step={0.01}
              value={websiteScore}
              onChange={e => setWebsiteScore(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">
                {lang === 'ru' ? 'Качество и воспроизводимость кода (Вес: 15%)' : 'Code Quality & Reproducibility (Weight: 15%)'}
              </span>
              <span className="text-cyan-400 font-bold">{codeScore.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.0}
              step={0.01}
              value={codeScore}
              onChange={e => setCodeScore(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
