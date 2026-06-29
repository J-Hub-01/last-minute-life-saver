import React, { useState } from 'react';
import { Storage } from '../utils/storage';
import { NotificationEngine } from '../utils/notifications';
import { googleSignIn } from '../utils/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Calendar, ArrowRight, Check, ShieldCheck } from 'lucide-react';

interface OnboardingModalProps {
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [dob, setDob] = useState<string>('2002-06-28');
  const [calendarConnected, setCalendarConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const calculateAge = (dateStr: string): number => {
    if (!dateStr) return 0;
    const today = new Date();
    const birthDate = new Date(dateStr);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  const handleConnectCalendar = async () => {
    setIsConnecting(true);
    try {
      const result = await googleSignIn();
      if (result && result.accessToken) {
        setCalendarConnected(true);
        NotificationEngine.addToast({ title: 'Connected!', message: 'Jarvis now has access to your Google Calendar.', type: 'success' });
      } else {
        NotificationEngine.addToast({ title: 'Connection Failed', message: 'Please ensure you accepted the OAuth prompt.', type: 'error' });
      }
    } catch (err) {
      console.error('Connection Error:', err);
      NotificationEngine.addToast({ title: 'Connection Error', message: 'An error occurred while connecting.', type: 'error' });
    } finally {
      setIsConnecting(false);
    }
  };

  const age = calculateAge(dob);

  const handleFinish = () => {
    Storage.setUser({
      name: name.trim() || 'Alex Rivera',
      email: email.trim(),
      dob: dob || '2002-06-28',
      age,
      onboarded: true,
      calendarConnected
    });
    Storage.seedDefaultDemoDataIfEmpty();
    NotificationEngine.requestPermission();
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950 overflow-hidden">
      {/* Ambient background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-xl w-full glass-panel rounded-3xl p-8 md:p-12 shadow-2xl border-slate-800">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="text-center flex flex-col items-center gap-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-indigo-400 font-semibold">Vibe2Ship Hackathon 2026</span>
                <h1 className="text-3xl md:text-4xl font-extrabold font-display tracking-tight text-slate-50 mt-2 leading-tight">
                  The Last-Minute <br className="hidden sm:block"/> Life Saver
                </h1>
                <p className="text-slate-400 mt-4 text-base md:text-lg max-w-md mx-auto leading-relaxed">
                  Your AI companion that makes sure you never miss what matters.
                </p>
              </div>
              <button
                onClick={() => setStep(2)}
                className="mt-4 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] transition-all duration-300 flex items-center gap-3 group"
              >
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono font-bold">1</div>
                <div>
                  <h2 className="text-2xl font-bold font-display text-slate-50">Let's personalize Jarvis</h2>
                  <p className="text-sm text-slate-400">Tell us a bit about yourself.</p>
                </div>
              </div>

              {name.trim() && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-indigo-300 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  Nice to meet you, <strong className="text-slate-50 font-medium">{name}</strong>!
                </motion.div>
              )}

              <div className="flex flex-col gap-4 mt-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jays Sawant"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jays@example.com"
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-50 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-50 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  {dob && (
                    <span className="text-xs text-cyan-400 mt-2 block font-mono">
                      ⚡ Calculated Age: <strong className="text-slate-50">{age} years old</strong> (Used for birthday celebration 🎉)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
                <button onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-slate-50 transition-colors">Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!name.trim()}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all flex items-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono font-bold">2</div>
                <div>
                  <h2 className="text-2xl font-bold font-display text-slate-50">Connect Google Calendar</h2>
                  <p className="text-sm text-slate-400">Sync meetings and smart reminders.</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-700 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-cyan-400">
                  <Calendar className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-slate-50 font-semibold text-base">Google Calendar Sync</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    We'll sync your events and send smart reminders 25 hours & 1 hour prior.
                  </p>
                </div>
                <button
                  onClick={handleConnectCalendar}
                  disabled={isConnecting}
                  className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
                    calendarConnected
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-50 text-slate-950 hover:bg-slate-100 shadow-md'
                  }`}
                >
                  {isConnecting ? (
                    'Connecting...'
                  ) : calendarConnected ? (
                    <>
                      <Check className="w-4 h-4" /> Connected to Google
                    </>
                  ) : (
                    'Connect Google Calendar'
                  )}
                </button>
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-800">
                <button onClick={() => setStep(2)} className="text-sm text-slate-400 hover:text-slate-50 transition-colors">Back</button>
                <div className="flex items-center gap-3">
                  <button onClick={() => setStep(4)} className="text-sm text-slate-400 hover:text-slate-50 px-3 py-2">Skip for now</button>
                  <button
                    onClick={() => setStep(4)}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all flex items-center gap-2"
                  >
                    Next Step
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center flex flex-col items-center gap-6"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <ShieldCheck className="w-9 h-9" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold font-display text-slate-50">
                  You're all set, {name || 'Friend'}!
                </h2>
                <p className="text-slate-400 mt-2 text-base max-w-md mx-auto">
                  Let's make sure you never miss a deadline again.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 text-xs text-left w-full flex items-center gap-3 font-mono">
                <span className="text-xl">⚡</span>
                <span>AI 80-90% Time Buffer Engine & Jarvis Autonomous Agent active.</span>
              </div>

              <button
                onClick={handleFinish}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-lg shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all duration-300 flex items-center justify-center gap-3 mt-4"
              >
                Enter Jarvis Dashboard
                <Sparkles className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
