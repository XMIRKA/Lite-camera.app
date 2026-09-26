import React from 'react';
import { Play, BarChart2, Users, Eye, Radio } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: 'en' | 'ru';
  setLang: (lang: 'en' | 'ru') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, lang, setLang }) => {
  const navItems = [
    { id: 'demo', label: lang === 'ru' ? 'Видеоанализ и Детектор ПДД' : 'Live Traffic Vision', icon: Play },
    { id: 'team', label: lang === 'ru' ? 'Команда' : 'Team', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('demo')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center font-mono font-bold text-white shadow-sm shadow-cyan-500/20">
              VF
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                VisionForce
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/40">
                  CV VISION
                </span>
              </span>
              <span className="text-[11px] text-slate-400">
                {lang === 'ru' ? 'Система видеоконтроля дорожного движения' : 'Traffic Monitoring & Incident Detection'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Actions & Language */}
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setLang('ru')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  lang === 'ru' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                RU
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  lang === 'en' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center gap-1 py-2 overflow-x-auto border-t border-slate-800/60">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-slate-800 text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
