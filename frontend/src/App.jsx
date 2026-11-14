import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import KioskView from './components/KioskView';
import RegisterView from './components/RegisterView';
import AdminView from './components/AdminView';

export default function App() {
  const [currentTab, setCurrentTab] = useState('kiosk');
  const [backendOnline, setBackendOnline] = useState(false);

  // Periodic health check against FastAPI
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('/api/stats');
        setBackendOnline(res.ok);
      } catch (err) {
        setBackendOnline(false);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        backendOnline={backendOnline}
      />

      <main className="flex-1 py-6">
        {currentTab === 'kiosk' && <KioskView />}
        {currentTab === 'register' && (
          <RegisterView onUserAdded={() => setCurrentTab('kiosk')} />
        )}
        {currentTab === 'admin' && <AdminView />}
      </main>

      {/* Footer bar */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-3 text-center text-xs font-mono text-slate-500">
        HID Hackathon 2026 &middot; Physical Entry Kiosk Liveness Detection &middot; Target Latency &le; 2.0s
      </footer>
    </div>
  );
}
