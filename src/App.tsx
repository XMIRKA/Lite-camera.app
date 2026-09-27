import React, { useState } from 'react';
import { Header } from './components/Header';
import { LiveDemo } from './components/LiveDemo';
import { EDASection } from './components/EDASection';
import { ApproachSection } from './components/ApproachSection';
import { TechnicalReport } from './components/TechnicalReport';
import { EvaluationPlayground } from './components/EvaluationPlayground';
import { RepositoryHub } from './components/RepositoryHub';
import { TeamSection } from './components/TeamSection';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('demo');
  const [lang, setLang] = useState<'ru' | 'en'>('ru');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'demo' && <LiveDemo lang={lang} />}
        {activeTab === 'eda' && <EDASection lang={lang} />}
        {activeTab === 'approach' && <ApproachSection lang={lang} />}
        {activeTab === 'report' && <TechnicalReport lang={lang} />}
        {activeTab === 'evaluation' && <EvaluationPlayground lang={lang} />}
        {activeTab === 'repo' && <RepositoryHub lang={lang} />}
        {activeTab === 'team' && <TeamSection lang={lang} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs font-mono text-slate-500">
        VisionForce Computer Vision System • WIUT Hackathon 2026 Submission
      </footer>
    </div>
  );
}

export default App;
