import React from 'react';
import { X, Keyboard, ShieldAlert, Cpu, Video, Sliders, CheckCircle2 } from 'lucide-react';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'ru';
}

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  const hotkeys = [
    { key: 'Пробел / K', descRu: 'Воспроизведение / Пауза', descEn: 'Play / Pause video' },
    { key: '← / [ / J', descRu: 'Перемотка назад на 1 кадр (-1k / -0.04с)', descEn: 'Step backward 1 frame (-1k)' },
    { key: '→ / ] / L', descRu: 'Перемотка вперед на 1 кадр (+1k / +0.04с)', descEn: 'Step forward 1 frame (+1k)' },
    { key: 'Shift + ← / →', descRu: 'Перемотка на 1 секунду назад / вперед', descEn: 'Seek -1s / +1s' },
    { key: '0 ... 9', descRu: 'Быстрый переход к 0% ... 90% видео', descEn: 'Jump to 0% ... 90% timeline' },
    { key: 'C', descRu: 'Включить / скрыть геометрию сплошных линий', descEn: 'Toggle lane geometry overlay' },
    { key: 'B', descRu: 'Включить / скрыть рамки детекции объектов', descEn: 'Toggle bounding boxes' },
    { key: 'R', descRu: 'Включить / скрыть скоростной радар', descEn: 'Toggle speed radar tags' },
    { key: 'H / ?', descRu: 'Открыть / закрыть это окно инструкций', descEn: 'Toggle hotkeys & help modal' }
  ];

  const pddRules = [
    {
      titleRu: '🚦 Мульти-светофорный контроль перекрестка (ПДД 6.2 - 6.15)',
      descRu: 'Система детектирует все светофоры в кадре и анализирует цвет каждой секции (Красный, Желтый, Зеленый). При отсутствии прямой видимости одного из светофоров его фаза логически вычисляется через матрицу бесконфликтных фаз (если Главное направление Красный ➔ Поперечное Зеленый).'
    },
    {
      titleRu: '📐 Математический расчет скорости (Homography / IPM)',
      descRu: 'Скорость рассчитывается по проективному преобразованию контакта колес с дорогой в метры без синтетических рамок (v = Δd / Δt * 3.6 км/ч).'
    },
    {
      titleRu: '⚠️ Детекция сплошных и опасных сближений (TTC)',
      descRu: 'Пересечение сплошной фиксируется векторным пересечением 2D отрезков колес с разметкой. Опасность столкновения рассчитывается по Time-To-Collision (TTC < 1.8с).'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl text-slate-200">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {lang === 'ru' ? 'Горячие клавиши и Руководство' : 'Keyboard Shortcuts & System Guide'}
              </h2>
              <p className="text-xs text-slate-400">
                {lang === 'ru' ? 'Управление воспроизведением и правила видеоанализа' : 'Playback controls and computer vision features'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 text-xs">
          {/* Shortcuts Grid */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
              <Keyboard className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'ru' ? 'Горячие клавиши управления' : 'Navigation Hotkeys'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {hotkeys.map((h, i) => (
                <div
                  key={i}
                  className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-3"
                >
                  <span className="text-slate-300 font-medium">
                    {lang === 'ru' ? h.descRu : h.descEn}
                  </span>
                  <kbd className="px-2 py-1 bg-slate-800 text-cyan-300 border border-slate-700 rounded font-mono font-bold text-[11px] shrink-0 shadow-sm">
                    {h.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Logic & System Specifications */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>{lang === 'ru' ? 'Принципы работы алгоритмов' : 'Core System Principles'}</span>
            </h3>

            <div className="space-y-2.5">
              {pddRules.map((rule, idx) => (
                <div key={idx} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{rule.titleRu}</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    {rule.descRu}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            {lang === 'ru' ? 'Понятно, закрыть' : 'Got it, close'}
          </button>
        </div>
      </div>
    </div>
  );
};
