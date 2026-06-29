import React from 'react';
import { TabType } from '../types';
import { motion } from 'motion/react';
import { Layers, Briefcase, User, Calendar, Heart } from 'lucide-react';

interface NavBarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  counts: Record<TabType, number>;
}

export const NavBar: React.FC<NavBarProps> = ({ activeTab, onSelectTab, counts }) => {
  const tabs: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'All', icon: Layers },
    { id: 'professional', label: 'Professional', icon: Briefcase },
    { id: 'personal', label: 'Personal', icon: User },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'wishlist', label: 'Wishlist', icon: Heart },
  ];

  return (
    <nav className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md overflow-x-auto no-scrollbar shadow-lg">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const count = counts[tab.id] || 0;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors shrink-0 ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-indigo-600 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
