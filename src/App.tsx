import React, { useState } from 'react';
import { Header } from './components/Header';
import { LiveDemo } from './components/LiveDemo';
import { EDASection } from './components/EDASection';
import { ApproachSection } from './components/ApproachSection';
import { TechnicalReport } from './components/TechnicalReport';
import { EvaluationPlayground } from './components/EvaluationPlayground';
import { RepositoryHub } from './components/RepositoryHub';
import { TeamSection } from './components/TeamSection';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('demo');
  const [lang, setLang] = useState<'en' | 'ru'>('ru');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Navigation Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content Area - Keep components mounted so video playback and canvas do not reset on tab switch */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className={activeTab === 'demo' ? 'block' : 'hidden'}>
          <LiveDemo lang={lang} />
        </div>
        <div className={activeTab === 'eda' ? 'block' : 'hidden'}>
          <EDASection lang={lang} />
        </div>
        <div className={activeTab === 'approach' ? 'block' : 'hidden'}>
          <ApproachSection lang={lang} />
        </div>
        <div className={activeTab === 'report' ? 'block' : 'hidden'}>
          <TechnicalReport lang={lang} />
        </div>
        <div className={activeTab === 'evaluation' ? 'block' : 'hidden'}>
          <EvaluationPlayground lang={lang} />
        </div>
        <div className={activeTab === 'repo' ? 'block' : 'hidden'}>
          <RepositoryHub lang={lang} />
        </div>
        <div className={activeTab === 'team' ? 'block' : 'hidden'}>
          <TeamSection lang={lang} />
        </div>
      </main>

      {/* Simple Clean Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>VisionForce • YOLOv8 + ByteTrack + OpenCV Traffic Surveillance</span>
          </div>
          <div>
            Team: Alisherov Mirkamol (Lead) • Normatov Bekzod • Muzaffar Solixojaev
          </div>
        </div>
      </footer>
    </div>
  );
}

