import React, { useEffect, useState } from 'react';
import { Storage } from '../utils/storage';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Sparkles, Gift, X } from 'lucide-react';

interface BirthdayModalProps {
  userName: string;
  onClose: () => void;
}

export const BirthdayModal: React.FC<BirthdayModalProps> = ({ userName, onClose }) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [quote, setQuote] = useState<string>('May this new trip around the sun be your most productive and fulfilling yet.');

  useEffect(() => {
    // Fire Confetti
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Fetch Gemini quote
    fetch('/api/ai/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: `birthday celebration for ${userName}` })
    })
      .then(res => res.json())
      .then(data => {
        if (data.quote) setQuote(data.quote);
      })
      .catch(() => {});
  }, [userName]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl overflow-hidden"
      >
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative max-w-lg w-full rounded-3xl p-8 md:p-12 text-center border border-pink-500/30 bg-gradient-to-b from-slate-900 to-indigo-950 shadow-[0_0_80px_rgba(236,72,153,0.3)]"
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-slate-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.5)] animate-bounce">
            <Gift className="w-10 h-10 text-white" />
          </div>

          <span className="text-xs font-mono uppercase tracking-widest text-pink-400 font-semibold mt-6 block">Special Celebration</span>

          <h2 className="text-3xl md:text-4xl font-extrabold font-display text-slate-50 mt-2 leading-tight">
            Happy Birthday, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-cyan-300 to-indigo-400">
              {userName}! 🎉
            </span>
          </h2>

          <p className="text-slate-300 mt-4 text-base leading-relaxed">
            Wishing you a wonderful day filled with joy, inspiration, and effortless productivity.
          </p>

          <div className="mt-6 p-5 rounded-2xl bg-white/5 border border-white/10 text-left relative">
            <Sparkles className="w-5 h-5 text-amber-300 absolute -top-2.5 -right-2.5 bg-slate-900 rounded-full p-0.5" />
            <p className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-1">Gemini AI Birthday Blessing:</p>
            <p className="text-sm italic text-cyan-200 font-sans">"{quote}"</p>
          </div>

          <button
            onClick={onClose}
            className="mt-8 w-full py-4 rounded-xl bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-bold text-base shadow-[0_0_30px_rgba(236,72,153,0.4)] transition-all"
          >
            Have a good day
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
