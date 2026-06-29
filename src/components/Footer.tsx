import React from 'react';
import { Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-12 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
      <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
        <span>Powered by</span>
        <span className="text-indigo-400 font-semibold px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-500/20">Gemini 2.0 Flash</span>
        <span>·</span>
        <span className="text-blue-400 font-semibold px-2 py-0.5 rounded bg-blue-950/50 border border-blue-500/20">Google Calendar API</span>
        <span>·</span>
        <span className="text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/20">Google Maps Places</span>
        <span>·</span>
        <span className="text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-950/50 border border-amber-500/20">Firebase Hosting</span>
      </div>

      <div className="text-slate-500">
        Shipped with ⚡ 80-90% Buffer Engine
      </div>
    </footer>
  );
};
