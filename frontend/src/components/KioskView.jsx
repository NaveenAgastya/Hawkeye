import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, ShieldCheck, ShieldAlert, AlertTriangle, Clock, RefreshCw, User, Check, DoorClosed, DoorOpen, Zap } from 'lucide-react';
import VerifyModal from './VerifyModal';

export default function KioskView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [result, setResult] = useState(null);
  const [verifySession, setVerifySession] = useState(null);
  const [latencyHistory, setLatencyHistory] = useState([]);

  // Initialize Webcam
  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
        }
      } catch (err) {
        console.error('Webcam error:', err);
        setCameraError('Camera access required. Please allow webcam permissions in your browser or connect a webcam.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Frame Capture helper
  const captureFrames = useCallback(async (count = 3) => {
    if (!videoRef.current || !canvasRef.current) return [];
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');

    const frames = [];
    for (let i = 0; i < count; i++) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.90));
      if (blob) frames.push(blob);
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, 60)); // 60ms gap between frames
      }
    }
    return frames;
  }, []);

  // Main Scan Routine
  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setResult(null);

    try {
      const frames = await captureFrames(3);
      if (frames.length === 0) {
        throw new Error('Could not capture frame from camera.');
      }

      const formData = new FormData();
      frames.forEach((f, idx) => formData.append('frames', f, `frame_${idx}.jpg`));

      const res = await fetch('/api/authenticate', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      setResult(data);
      if (data.ms) {
        setLatencyHistory(prev => [data.ms, ...prev.slice(0, 4)]);
      }

      if (data.decision === 'REQUEST_VERIFICATION') {
        setVerifySession({
          token: data.token,
          userHint: data.user_hint
        });
      }
    } catch (err) {
      console.error('Scan error:', err);
      setResult({
        decision: 'DENY',
        reason: err.message || 'Network error communicating with authentication engine.',
        door_status: 'LOCKED',
        ms: 0
      });
    } finally {
      setScanning(false);
    }
  };

  // Periodic Auto-scan loop if enabled
  useEffect(() => {
    if (!autoScan || scanning || verifySession) return;
    const interval = setInterval(() => {
      handleScan();
    }, 3500);
    return () => clearInterval(interval);
  }, [autoScan, scanning, verifySession]);

  const handleVerifyComplete = (verifiedData) => {
    setVerifySession(null);
    setResult(verifiedData);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Primary Video / HUD Viewport (7 Cols) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl aspect-[4/3] flex items-center justify-center">
          {/* Webcam Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />

          {/* Fallback Camera Placeholder if webcam unavailable */}
          {!streamActive && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
              <Camera className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
              <p className="text-sm font-semibold text-slate-300 mb-1">
                {cameraError || 'Connecting Camera Sensor...'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm">
                Ensure camera permissions are granted. For evaluation test sets, check the "Logs &amp; Benchmark" tab.
              </p>
            </div>
          )}

          {/* Futuristic HUD Targeting Reticle */}
          <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between">
            {/* Top HUD metrics */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs font-mono text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>SCRFD + ArcFace 512d</span>
              </div>
              <div className="bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Target &le; 2.0s</span>
              </div>
            </div>

            {/* Center Reticle Face Box */}
            <div className="self-center relative w-64 h-72 border-2 border-dashed border-cyan-500/40 rounded-3xl flex items-center justify-center overflow-hidden">
              {/* Corner Brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-cyan-400 rounded-br-xl" />

              {/* Scanning Laser Beam */}
              {scanning && (
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-scanline shadow-[0_0_15px_rgba(0,178,254,0.8)]" />
              )}

              <span className="text-[11px] text-cyan-300/70 font-mono tracking-widest uppercase bg-slate-950/60 px-2 py-0.5 rounded">
                Align Face
              </span>
            </div>

            {/* Bottom HUD metadata */}
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span className="bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded border border-slate-800">
                MiniFASNetV2 + V1SE
              </span>
              <span className="bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded border border-slate-800">
                Passive Moiré / Glare Check
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className={`flex-1 py-4 rounded-2xl font-bold text-white text-base shadow-xl flex items-center justify-center gap-3 transition-all ${
              scanning
                ? 'bg-slate-800 cursor-wait'
                : 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 active:scale-[0.99] shadow-cyan-900/30'
            }`}
          >
            {scanning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Analyzing Biometrics &amp; Liveness...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 text-cyan-300 fill-cyan-300" />
                <span>Scan Face to Enter</span>
              </>
            )}
          </button>

          <button
            onClick={() => setAutoScan(!autoScan)}
            className={`px-4 py-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 transition-all ${
              autoScan
                ? 'bg-cyan-950/60 border-cyan-600 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoScan ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
            Auto-Scan
          </button>
        </div>
      </div>

      {/* Decision Status & Turnstile Feedback (5 Cols) */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        {/* Turnstile Physical Barrier HUD */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${
              result?.decision === 'ALLOW' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {result?.decision === 'ALLOW' ? <DoorOpen className="w-6 h-6" /> : <DoorClosed className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">Turnstile State</p>
              <h4 className={`text-base font-bold font-mono ${
                result?.decision === 'ALLOW' ? 'text-emerald-400' : 'text-slate-300'
              }`}>
                {result?.decision === 'ALLOW' ? 'UNLOCKED (OPEN)' : 'LOCKED (SECURE)'}
              </h4>
            </div>
          </div>
          {result?.ms ? (
            <div className="text-right">
              <span className="text-[11px] text-slate-400 font-mono">Decision Latency</span>
              <p className={`text-sm font-bold font-mono ${result.ms <= 2000 ? 'text-cyan-400' : 'text-amber-400'}`}>
                {result.ms} ms
              </p>
            </div>
          ) : null}
        </div>

        {/* Real-time Decision Card */}
        {result ? (
          <div
            className={`border rounded-3xl p-6 transition-all duration-300 ${
              result.decision === 'ALLOW'
                ? 'bg-emerald-950/30 border-emerald-500/50 glow-green'
                : result.decision === 'REQUEST_VERIFICATION'
                ? 'bg-amber-950/30 border-amber-500/50 glow-amber'
                : 'bg-red-950/30 border-red-500/50 glow-red'
            }`}
          >
            {/* Outcome Badge */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`p-3 rounded-2xl ${
                  result.decision === 'ALLOW'
                    ? 'bg-emerald-500 text-slate-950'
                    : result.decision === 'REQUEST_VERIFICATION'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-red-500 text-white'
                }`}
              >
                {result.decision === 'ALLOW' && <ShieldCheck className="w-8 h-8" />}
                {result.decision === 'REQUEST_VERIFICATION' && <AlertTriangle className="w-8 h-8" />}
                {result.decision === 'DENY' && <ShieldAlert className="w-8 h-8" />}
              </div>

              <div>
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-400">
                  Authentication Outcome
                </span>
                <h3
                  className={`text-2xl font-black tracking-wide ${
                    result.decision === 'ALLOW'
                      ? 'text-emerald-400'
                      : result.decision === 'REQUEST_VERIFICATION'
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {result.decision.replace('_', ' ')}
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-300 mb-4 leading-relaxed">
              {result.reason}
            </p>

            {/* Employee ID Badge Card on ALLOW */}
            {result.user && (
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-4 mb-4 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden border border-slate-700 flex-shrink-0">
                  {result.user.photo ? (
                    <img src={result.user.photo} alt={result.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-slate-500 m-auto mt-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-base truncate">{result.user.name}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                      ID: {result.user.employee_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{result.user.department}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.user.doors?.slice(0, 2).map((d, i) => (
                      <span key={i} className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded text-cyan-300 border border-slate-800">
                        ✓ {d}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Biometric & Anti-Spoof Signals Breakdown */}
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block mb-1">Liveness Confidence</span>
                <span className={`text-base font-bold ${
                  result.liveness >= 0.85 ? 'text-emerald-400' : result.liveness >= 0.50 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {result.liveness ? `${(result.liveness * 100).toFixed(1)}%` : '0.0%'}
                </span>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block mb-1">Face Match Score</span>
                <span className={`text-base font-bold ${
                  result.similarity >= 0.45 ? 'text-emerald-400' : result.similarity >= 0.32 ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {result.similarity ? result.similarity.toFixed(2) : '0.00'}
                </span>
              </div>
            </div>

            {result.spoof_type && result.spoof_type !== 'Real' && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-950/50 border border-red-800/60 text-xs text-red-300 flex items-center justify-between">
                <span>Detected Attack Species:</span>
                <span className="font-bold font-mono uppercase">{result.spoof_type}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-4 text-slate-500">
              <Camera className="w-8 h-8" />
            </div>
            <h4 className="font-bold text-slate-300 text-base mb-1">Kiosk Sensor Ready</h4>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Step in front of the camera and press <strong className="text-cyan-400">Scan Face to Enter</strong> to authenticate your credential.
            </p>
          </div>
        )}

        {/* Latency History Meter */}
        {latencyHistory.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-mono text-slate-400">Recent Decision Latencies (&le; 2000 ms)</span>
              <span className="text-xs font-mono font-bold text-emerald-400">Target Compliant</span>
            </div>
            <div className="flex gap-2 items-end h-12 pt-2">
              {latencyHistory.map((ms, idx) => {
                const heightPct = Math.min(100, Math.max(15, (ms / 2000) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t transition-all ${
                        ms <= 1000 ? 'bg-emerald-500' : ms <= 2000 ? 'bg-cyan-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[10px] font-mono text-slate-400">{Math.round(ms)}ms</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Secondary Verification Modal */}
      {verifySession && (
        <VerifyModal
          token={verifySession.token}
          userHint={verifySession.userHint}
          captureFrames={captureFrames}
          onComplete={handleVerifyComplete}
          onCancel={() => setVerifySession(null)}
        />
      )}
    </div>
  );
}
