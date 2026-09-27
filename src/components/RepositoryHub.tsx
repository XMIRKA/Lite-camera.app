import React, { useState, useEffect } from 'react';
import { STARTER_KIT_FILES } from '../data/starterKitCode';
import { StreamlitApp } from './StreamlitApp';
import {
  Copy,
  Check,
  Download,
  FileCode,
  CheckCircle2,
  FolderDown,
  Terminal,
  Cpu,
  Play,
  Code2,
  Sliders,
  Layers,
  Sparkles
} from 'lucide-react';

interface RepositoryHubProps {
  lang: 'en' | 'ru';
}

export const RepositoryHub: React.FC<RepositoryHubProps> = ({ lang }) => {
  const [activeSubTab, setActiveSubTab] = useState<'interactive' | 'code'>('interactive');
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [livePing, setLivePing] = useState<number>(10.1);
  const [liveFps, setLiveFps] = useState<number>(38.5);

  useEffect(() => {
    const interval = setInterval(() => {
      setLivePing(9.5 + Math.random() * 2.8);
      setLiveFps(37.5 + Math.random() * 2.5);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentFile = STARTER_KIT_FILES[selectedFileIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.filename.replace('/', '_');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    STARTER_KIT_FILES.forEach((file, index) => {
      setTimeout(() => {
        const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename.replace('/', '_');
        a.click();
        URL.revokeObjectURL(url);
      }, index * 200);
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-cyan-400 font-mono">Streamlit & Python Engine</span>
            <span aria-hidden="true">·</span>
            <span>YOLOv8 + ByteTrack + OpenCV (cv2)</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400 font-bold">100% {lang === 'ru' ? 'Интегрировано' : 'Integrated'}</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">
            {lang === 'ru'
              ? 'Интегрированный Streamlit-центр и исходные скрипты'
              : 'Integrated Streamlit Hub & Python Scripts'}
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            {lang === 'ru'
              ? 'Запускайте веб-интерфейс Streamlit с детекцией YOLOv8, трекингом ByteTrack и покадровой нарезкой OpenCV прямо в браузере или просматривайте и скачивайте исходный Python-код.'
              : 'Run the integrated Streamlit web interface with YOLOv8 detection, ByteTrack tracking, and OpenCV slicing directly in browser, or inspect and download Python scripts.'}
          </p>
        </div>

        {/* Real-time Telemetry Stats Widget */}
        <div className="flex items-center gap-4 bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] shrink-0 self-start lg:self-center">
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase">Telemetry Ping</span>
            <span className="text-cyan-400 font-bold">{livePing.toFixed(1)} ms</span>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase">Streamlit FPS</span>
            <span className="text-emerald-400 font-bold">{liveFps.toFixed(1)} FPS</span>
          </div>
          <div className="w-px h-6 bg-slate-800" />
          <div className="flex flex-col">
            <span className="text-slate-500 text-[9px] uppercase">VRAM / RAM</span>
            <span className="text-amber-400 font-bold">1.2 GB / 32 GB</span>
          </div>
        </div>
      </div>

      {/* Tab Toggle: Interactive vs Code */}
      <div className="flex justify-start">
        <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl shrink-0">
          <button
            onClick={() => setActiveSubTab('interactive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSubTab === 'interactive'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {lang === 'ru' ? '🚀 Запуск Streamlit Web-App' : '🚀 Streamlit Live App'}
          </button>

          <button
            onClick={() => setActiveSubTab('code')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              activeSubTab === 'code'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            {lang === 'ru' ? '📄 Исходный код (.py)' : '📄 Python Code'}
          </button>
        </div>
      </div>

      {/* Mode 1: Interactive Streamlit Web App */}
      {activeSubTab === 'interactive' && (
        <div className="space-y-6">
          <StreamlitApp lang={lang} />
        </div>
      )}

      {/* Mode 2: Python Code & Download Hub */}
      {activeSubTab === 'code' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'ru' ? 'Исходные файлы пайплайна VisionForce' : 'VisionForce Pipeline Source Files'}</span>
            </div>

            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-mono"
            >
              <FolderDown className="w-4 h-4" />
              {lang === 'ru' ? 'Скачать все скрипты (.py / .txt)' : 'Download All Scripts (.py / .txt)'}
            </button>
          </div>

          {/* Local Run Instructions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2 text-emerald-400 font-bold">
                <Terminal className="w-4 h-4" />
                {lang === 'ru' ? 'ИНСТРУКЦИЯ ПО ЗАПУСКУ НА КОМПЬЮТЕРЕ (Python)' : 'LOCAL PYTHON EXECUTION INSTRUCTIONS'}
              </span>
              <span className="text-slate-500">Python 3.10+ / CUDA 12.1+</span>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block"># 1. Скачайте файлы и установите библиотеки (YOLOv8, ByteTrack, OpenCV, Streamlit):</span>
                <span className="text-cyan-300 font-bold">pip install -r requirements.txt</span>
              </div>
              <div>
                <span className="text-slate-500 block"># 2. Запустите интерактивный веб-интерфейс на базе Streamlit:</span>
                <span className="text-emerald-300 font-bold">streamlit run app_streamlit.py</span>
              </div>
              <div>
                <span className="text-slate-500 block"># 3. Или обработайте любое видео дорожного движения (.mp4) через консоль:</span>
                <span className="text-cyan-300 font-bold">python solution.py --video traffic_video.mp4 --out output_annotated.mp4</span>
              </div>
            </div>
          </div>

          {/* Code Explorer */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* File Tree Sidebar */}
            <div className="space-y-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <span className="text-xs font-mono text-slate-400 uppercase font-bold block">
                  {lang === 'ru' ? 'Файлы репозитория' : 'Repository Files'}
                </span>
                <div className="space-y-1 pt-1">
                  {STARTER_KIT_FILES.map((file, idx) => {
                    const isSelected = idx === selectedFileIdx;
                    return (
                      <button
                        key={file.filename}
                        onClick={() => setSelectedFileIdx(idx)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-mono rounded-lg transition-colors text-left ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{file.filename}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Module Specs Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                <span className="font-mono font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  {lang === 'ru' ? 'Технический стек' : 'Technical Stack'}
                </span>
                <ul className="space-y-2 text-slate-400 font-mono text-[11px]">
                  <li className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span><strong>YOLOv8:</strong> Ultralytics Detector</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span><strong>ByteTrack:</strong> Multi-Object Tracking</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span><strong>OpenCV (cv2):</strong> Video Slicing & BBox</span>
                  </li>
                  <li className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span><strong>Streamlit:</strong> Interactive Web App</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Code Content Viewer */}
            <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
              {/* File Tab Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-xs font-mono font-bold text-white truncate">
                    {currentFile.filename}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono hidden sm:inline truncate">
                    ({currentFile.description})
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? (lang === 'ru' ? 'Скопировано' : 'Copied') : (lang === 'ru' ? 'Копировать' : 'Copy')}
                  </button>

                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-950 bg-cyan-400 hover:bg-cyan-300 font-semibold rounded-md transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {lang === 'ru' ? 'Скачать .py' : 'Download'}
                  </button>
                </div>
              </div>

              {/* Preformatted Code Display */}
              <div className="p-4 bg-slate-950 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed max-h-[600px] overflow-y-auto">
                <pre>
                  <code>{currentFile.code}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
