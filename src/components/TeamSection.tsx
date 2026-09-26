import React from 'react';
import { TEAM_MEMBERS } from '../data/competitionData';
import { Github, Crown, Code2, Cpu, Sparkles, Layers, ShieldCheck } from 'lucide-react';

interface TeamSectionProps {
  lang: 'en' | 'ru';
}

export const TeamSection: React.FC<TeamSectionProps> = ({ lang }) => {
  // Helper to get initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  const memberGradients = [
    'from-cyan-600 via-indigo-600 to-violet-700',
    'from-emerald-600 via-teal-600 to-cyan-700',
    'from-amber-600 via-orange-600 to-rose-700',
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-cyan-400 font-mono">Team VisionForce</span>
          <span aria-hidden="true">·</span>
          <span>Core Engineering Team</span>
          <span aria-hidden="true">·</span>
          <span>Computer Vision &amp; Robotics</span>
        </div>
        <h2 className="text-2xl font-bold text-white mt-1">
          {lang === 'ru' ? 'Разработчики системы: Team VisionForce' : 'Authors & Creators: Team VisionForce'}
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          {lang === 'ru'
            ? 'Инженерная команда создателей системы видеомониторинга дорожного движения VisionForce.'
            : 'Engineering team behind the VisionForce real-time traffic video analytics platform.'}
        </p>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TEAM_MEMBERS.map((member, idx) => {
          const isCaptain = idx === 0 || member.name.includes('Alisherov Mirkamol');
          const gradient = memberGradients[idx % memberGradients.length];

          return (
            <div
              key={member.name}
              className={`bg-slate-900 border rounded-2xl overflow-hidden p-6 flex flex-col justify-between shadow-xl transition-all duration-300 relative ${
                isCaptain
                  ? 'border-cyan-500/50 shadow-cyan-950/40 hover:border-cyan-400 ring-1 ring-cyan-500/20'
                  : 'border-slate-800 hover:border-slate-700 shadow-slate-950/40'
              }`}
            >
              {/* Captain Badge Glow */}
              {isCaptain && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold shadow-sm">
                  <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>El Capitano</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Member Avatar & Header */}
                <div className="flex items-center gap-4">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${gradient} flex items-center justify-center font-mono font-extrabold text-xl text-white shadow-lg shrink-0 border border-white/20`}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div className="pr-16">
                    <h3 className="text-lg font-bold text-white leading-tight">
                      {member.name}
                    </h3>
                    <span className="text-xs font-mono text-cyan-400 block mt-1 font-semibold">
                      {member.role}
                    </span>
                  </div>
                </div>

                {/* Bio */}
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {member.bio}
                </p>

                {/* Engineering Contribution */}
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/90 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                    {lang === 'ru' ? 'Вклад в проект' : 'Project Contribution'}
                  </span>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    {member.contribution}
                  </p>
                </div>

                {/* Core Focus Areas */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    {lang === 'ru' ? 'Ключевые модули' : 'Core Modules'}
                  </span>
                  <div className="space-y-1.5">
                    {member.previousProjects.map(proj => (
                      <div
                        key={proj.title}
                        className="text-xs p-2 rounded-lg bg-slate-950/60 border border-slate-800/60"
                      >
                        <strong className="text-cyan-300 font-mono block text-[11px] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                          {proj.title}
                        </strong>
                        <span className="text-slate-400 text-[11px] leading-tight block mt-0.5">
                          {proj.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Links / Socials */}
              <div className="pt-4 mt-5 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] text-slate-400">VisionForce CV Team</span>
                </div>

                {member.github && (
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors text-xs"
                  >
                    <Github className="w-3.5 h-3.5" />
                    <span>GitHub</span>
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
