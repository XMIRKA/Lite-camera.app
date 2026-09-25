import React, { useState } from 'react';
import { Header } from './components/Header';
import { LiveDemo } from './components/LiveDemo';
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === 'demo' && <LiveDemo lang={lang} />}
        {activeTab === 'team' && <TeamSection lang={lang} />}
      </main>

      {/* Simple Clean Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>VisionForce AI • Autonomous Traffic Surveillance</span>
          </div>
          <div>
            Team: Alisherov Mirkamol (Lead) • Normatov Bekzod • Muzaffar Solixojaev
          </div>
        </div>
      </footer>
    </div>
  );
}
