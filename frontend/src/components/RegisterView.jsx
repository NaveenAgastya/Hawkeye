import React, { useRef, useState, useEffect } from 'react';
import { Camera, UserPlus, CheckCircle2, AlertCircle, Shield, RefreshCw } from 'lucide-react';

const DEPARTMENTS = ["Engineering", "Security", "Executive", "Operations", "General"];

export default function RegisterView({ onUserAdded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [employeeId, setEmployeeId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
        }
      } catch (err) {
        console.error('Camera error:', err);
      }
    };

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const captureFrames = async (count = 3) => {
    if (!videoRef.current || !canvasRef.current) return [];
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');

    const frames = [];
    for (let i = 0; i < count; i++) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.90));
      if (blob) frames.push(blob);
      if (i < count - 1) await new Promise(r => setTimeout(r, 60));
    }
    return frames;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessData(null);

    if (!name.trim() || !employeeId.trim()) {
      setErrorMsg('Please fill in all employee identification fields.');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg('PIN must be exactly 4 numeric digits.');
      return;
    }

    setLoading(true);

    try {
      const frames = await captureFrames(3);
      if (frames.length === 0) {
        throw new Error('Camera frame capture failed.');
      }

      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('department', department);
      formData.append('employee_id', employeeId.trim());
      formData.append('pin', pin.trim());
      frames.forEach((f, idx) => formData.append('frames', f, `reg_frame_${idx}.jpg`));

      const res = await fetch('/api/register', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Enrollment rejected.');
      }

      setSuccessData(data);
      setName('');
      setEmployeeId('');
      setPin('');
      if (onUserAdded) onUserAdded();
    } catch (err) {
      setErrorMsg(err.message || 'Enrollment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-cyan-600/10 text-cyan-400 border border-cyan-500/30">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Employee Biometric Enrollment</h2>
            <p className="text-xs text-slate-400">
              Live face capture with anti-spoof protection &middot; Fernet AES-128 encrypted storage
            </p>
          </div>
        </div>

        {successData && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-emerald-400 text-base">Biometric Enrollment Successful</h4>
              <p className="text-xs text-slate-300 mt-1">
                Employee <strong className="text-white">{successData.name}</strong> ({successData.employee_id}) is enrolled.
                Liveness confidence: <strong>{(successData.liveness * 100).toFixed(1)}%</strong>.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {successData.doors?.map((door, idx) => (
                  <span key={idx} className="text-[11px] font-mono bg-slate-950 px-2.5 py-1 rounded-lg text-emerald-300 border border-emerald-900">
                    ✓ {door}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center gap-3 text-xs text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Camera View for enrollment */}
          <div className="md:col-span-5 flex flex-col gap-3">
            <div className="relative aspect-[4/3] bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute inset-0 border-2 border-dashed border-cyan-500/30 rounded-2xl pointer-events-none m-3 flex items-center justify-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 bg-slate-950/70 px-2 py-0.5 rounded">
                  Face Silhouette
                </span>
              </div>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Only authentic, live faces can be enrolled. Photo attacks will be rejected.</span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Alex Chen"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Employee ID
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  placeholder="e.g. HID-84920"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                4-Digit Emergency / Fallback PIN
              </label>
              <input
                type="password"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono tracking-widest"
                required
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Required for step-up active verification (scrypt-hashed with per-user salt).
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 font-bold text-white text-sm shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Checking Bona Fide Liveness &amp; Enrolling...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>Capture Photo &amp; Register Biometrics</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
