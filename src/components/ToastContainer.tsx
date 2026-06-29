import React, { useEffect, useState } from 'react';
import { NotificationEngine, ToastMessage } from '../utils/notifications';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Sparkles, CheckCircle2, Info, X, Heart } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return NotificationEngine.subscribe(setToasts);
  }, []);

  const getIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'urgent':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />;
      case 'missed':
        return <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'ai':
        return <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'wishlist':
        return <Heart className="w-5 h-5 text-pink-400 shrink-0 animate-pulse" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastMessage['type']) => {
    switch (type) {
      case 'urgent': return 'border-amber-500/50 bg-amber-950/80 text-amber-100 shadow-amber-500/20';
      case 'missed': return 'border-rose-500/50 bg-rose-950/80 text-rose-100 shadow-rose-500/20';
      case 'ai': return 'border-indigo-500/50 bg-indigo-950/90 text-indigo-100 shadow-indigo-500/30';
      case 'success': return 'border-emerald-500/50 bg-emerald-950/80 text-emerald-100 shadow-emerald-500/20';
      case 'wishlist': return 'border-pink-500/50 bg-pink-950/80 text-pink-100 shadow-pink-500/20';
      case 'error': return 'border-rose-600/50 bg-rose-950/90 text-rose-100 shadow-rose-600/20';
      default: return 'border-cyan-500/50 bg-slate-900/90 text-slate-100 shadow-cyan-500/20';
    }
  };

  return (
    <div className="fixed bottom-24 left-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className={`pointer-events-auto p-4 rounded-xl border backdrop-blur-md shadow-lg flex items-start gap-3 cursor-pointer group ${getBorderColor(toast.type)}`}
            onClick={() => {
              toast.onClick?.();
              NotificationEngine.removeToast(toast.id);
            }}
          >
            {getIcon(toast.type)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold tracking-wide truncate">{toast.title}</h4>
                <span className="text-[10px] opacity-70 font-mono shrink-0">{toast.timestamp}</span>
              </div>
              <p className="text-xs mt-1 leading-relaxed opacity-90 font-sans break-words">{toast.message}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                NotificationEngine.removeToast(toast.id);
              }}
              className="opacity-40 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
