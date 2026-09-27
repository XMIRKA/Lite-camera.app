import React, { useState } from 'react';
import { TrafficLightInspector } from './components/TrafficLightInspector';
import { EvaluationPlayground } from './components/EvaluationPlayground';
import { EDASection } from './components/EDASection';
import { LiveDemo } from './components/LiveDemo';
import {
  Activity,
  Crosshair,
  BarChart3,
  Calculator,
  Shield,
  Zap,
  Layers,
  Sparkles
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'inspector' | 'livedemo' | 'playground' | 'eda'>('livedemo');
  const [lang, setLang] = useState<'ru' | 'en'>('ru');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-cyan-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                <span>VisionForce PDD Studio</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  WIUT 2026
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Автоматическая фиксация ПДД • Оптический инспектор светофоров • Vision Zero
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold font-mono">
            <button
              onClick={() => setActiveTab('livedemo')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'livedemo'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Live Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('inspector')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'inspector'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Инспектор Светофоров</span>
            </button>

            <button
              onClick={() => setActiveTab('playground')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'playground'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Оценка Жюри</span>
            </button>

            <button
              onClick={() => setActiveTab('eda')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'eda'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>EDA Анализ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'livedemo' && <LiveDemo lang={lang} />}
        {activeTab === 'inspector' && <TrafficLightInspector />}
        {activeTab === 'playground' && <EvaluationPlayground lang={lang} />}
        {activeTab === 'eda' && <EDASection lang={lang} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs font-mono text-slate-500">
        VisionForce Computer Vision System • WIUT Hackathon 2026 Submission
      </footer>
    </div>
  );
}

export default App;
