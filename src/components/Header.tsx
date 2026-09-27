import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  BarChart2,
  Cpu,
  FileText,
  Calculator,
  Code2,
  Users,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Layers
} from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: 'en' | 'ru';
  setLang: (lang: 'en' | 'ru') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, lang, setLang }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    {
      id: 'demo',
      label: lang === 'ru' ? 'Live Demo' : 'Live Demo',
      sub: lang === 'ru' ? 'Детекция, .mp4, таймлайн и риски' : 'Real-time detector, .mp4 & risk curves',
      icon: Play,
      badge: '60 FPS'
    },
    {
      id: 'eda',
      label: lang === 'ru' ? 'EDA & Инсайты' : 'EDA & Insights',
      sub: lang === 'ru' ? 'Анализ классов, гомография IPM' : 'Class balance, ground-plane IPM',
      icon: BarChart2
    },
    {
      id: 'approach',
      label: lang === 'ru' ? 'Архитектура & Абляции' : 'Approach & Ablations',
      sub: lang === 'ru' ? 'YOLOv8 + ByteTrack, сравнения' : 'YOLOv8 + ByteTrack pipeline',
      icon: Cpu
    },
    {
      id: 'report',
      label: lang === 'ru' ? 'Технический отчет' : 'Technical Report',
      sub: lang === 'ru' ? 'Что сработало, что нет, roadmap' : 'What worked, what failed & next steps',
      icon: FileText
    },
    {
      id: 'evaluation',
      label: lang === 'ru' ? 'Оценка (evaluate.py)' : 'Evaluation Harness',
      sub: lang === 'ru' ? 'Score A, Score B и расчет метрик' : 'Official mAP & F1-alarm evaluator',
      icon: Calculator
    },
    {
      id: 'repo',
      label: lang === 'ru' ? 'Код и веса' : 'Code & Weights',
      sub: lang === 'ru' ? 'solution.py, weights, predictions' : 'solution.py, models, JSON predictions',
      icon: Code2
    },
    {
      id: 'team',
      label: lang === 'ru' ? 'Команда' : 'Team',
      sub: lang === 'ru' ? 'Состав команды и контакты' : 'Team members, roles & portfolio',
      icon: Users
    },
  ];

  const currentNav = navItems.find(i => i.id === activeTab) || navItems[0];
  const CurrentIcon = currentNav.icon;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Brand Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer shrink-0"
            onClick={() => handleSelectTab('demo')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-sky-600 to-indigo-600 flex items-center justify-center font-mono font-bold text-white shadow-md shadow-cyan-500/20 ring-1 ring-white/10">
              VF
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                VisionForce
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/40">
                  CV
                </span>
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                {lang === 'ru' ? 'Интеллектуальный видеомониторинг ПДД' : 'Intelligent Traffic Surveillance'}
              </span>
            </div>
          </div>

          {/* Quick Switcher / Section Accordion Dropdown (Primary Navigation on All Sizes) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-cyan-500/60 text-slate-200 hover:text-white transition-all shadow-sm group"
            >
              <CurrentIcon className="w-4 h-4 text-cyan-400" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                  {currentNav.label}
                  <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">
                    {lang === 'ru' ? 'Раздел' : 'Section'}
                  </span>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu (Раскладушка всех разделов) */}
            {isMenuOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-slate-900/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl p-2.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-white/10">
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    {lang === 'ru' ? 'Все разделы системы' : 'All System Sections'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">7 {lang === 'ru' ? 'страниц' : 'pages'}</span>
                </div>

                <div className="grid grid-cols-1 gap-1 pt-1.5 max-h-[75vh] overflow-y-auto">
                  {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all ${
                          isActive
                            ? 'bg-cyan-500/15 border border-cyan-500/40 text-white shadow-sm'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className={`p-2 rounded-lg mt-0.5 ${isActive ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                              {item.label}
                            </span>
                            {item.badge && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {item.sub}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Horizontal Bar (Quick Direct Access) */}
          <nav className="hidden lg:flex items-center gap-1 overflow-hidden">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
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

          {/* Language toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0">
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
    </header>
  );
};

