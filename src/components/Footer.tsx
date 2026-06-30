import React from 'react';
import { Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-12 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-mono opacity-100">
      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
        <span className="text-slate-400 font-semibold">Powered by</span>
        <span className="text-indigo-950 font-bold px-2 py-0.5 rounded bg-indigo-200 border border-indigo-400/40 opacity-100">Gemini 2.5 Flash</span>
        <span className="text-slate-400">·</span>
        <span className="text-blue-950 font-bold px-2 py-0.5 rounded bg-blue-200 border border-blue-400/40 opacity-100">Google Calendar API</span>
        <span className="text-slate-400">·</span>
        <span className="text-emerald-950 font-bold px-2 py-0.5 rounded bg-emerald-200 border border-emerald-400/40 opacity-100">Google Maps Places</span>
        <span className="text-slate-400">·</span>
        <span className="text-amber-950 font-bold px-2 py-0.5 rounded bg-amber-200 border border-amber-400/40 opacity-100">Firebase Hosting</span>
      </div>

      <div className="text-slate-400 font-semibold opacity-100">
        Shipped with ⚡ 80-90% Buffer Engine
      </div>
    </footer>
  );
};
