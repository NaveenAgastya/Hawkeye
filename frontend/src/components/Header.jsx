import React from 'react';
import { Shield, UserPlus, FileSpreadsheet, Lock } from 'lucide-react';

export default function Header({ currentTab, setCurrentTab, backendOnline }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-cyan-600 to-blue-700 p-2 rounded-xl shadow-lg shadow-cyan-900/30">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wider text-white text-lg font-mono">HID</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold uppercase tracking-wider">
              Liveness &amp; Auth
            </span>
          </div>
          <p className="text-xs text-slate-400">Physical Access Kiosk &middot; Decision latency &le; 2.0s</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
        <button
          onClick={() => setCurrentTab('kiosk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentTab === 'kiosk'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Entry Kiosk</span>
        </button>

        <button
          onClick={() => setCurrentTab('register')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentTab === 'register'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Enroll Employee</span>
        </button>

        <button
          onClick={() => setCurrentTab('admin')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentTab === 'admin'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Logs &amp; Benchmark</span>
        </button>
      </nav>

      {/* Backend Status indicator */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
          <span className={`w-2.5 h-2.5 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-slate-300 font-medium">
            {backendOnline ? 'Engine Online' : 'Engine Connecting...'}
          </span>
        </div>
      </div>
    </header>
  );
}
