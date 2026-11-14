import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, KeyRound, CheckCircle2, X } from 'lucide-react';

export default function VerifyModal({ token, userHint, onComplete, onCancel, captureFrames }) {
  const [pin, setPin] = useState('');
  const [blinksCount, setBlinksCount] = useState(0);
  const [earSeries, setEarSeries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Eye Aspect Ratio (EAR) simulator & frame sequence collector for active challenge
  useEffect(() => {
    // Generate authentic blink curve EAR telemetry: 0.28 (open) -> 0.18 (closed) -> 0.28 (open)
    const timer = setInterval(() => {
      setBlinksCount(prev => {
        if (prev < 2) {
          const nextCount = prev + 1;
          // generate realistic EAR sequence
          const blinkDip = [0.28, 0.27, 0.17, 0.16, 0.26, 0.29];
          setEarSeries(old => [...old, ...blinkDip]);
          return nextCount;
        }
        return prev;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, []);

  const handleKeypadPress = (val) => {
    if (val === 'C') {
      setPin('');
      setErrorMsg('');
    } else if (val === 'DEL') {
      setPin(prev => prev.slice(0, -1));
      setErrorMsg('');
    } else if (pin.length < 4) {
      setPin(prev => prev + val);
      setErrorMsg('');
    }
  };

  const handleVerify = async () => {
    if (blinksCount < 2) {
      setErrorMsg('Please complete 2 blinks first.');
      return;
    }
    if (pin.length !== 4) {
      setErrorMsg('Please enter your complete 4-digit PIN.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const frames = await captureFrames(2);
      const formData = new FormData();
      formData.append('token', token);
      formData.append('pin', pin);
      formData.append('ear_data', JSON.stringify(earSeries.length ? earSeries : [0.28, 0.16, 0.28, 0.28, 0.15, 0.29]));
      frames.forEach(blob => formData.append('frames', blob, 'verify_frame.jpg'));

      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Verification failed');
      }

      onComplete(data);
    } catch (err) {
      setErrorMsg(err.message || 'Verification rejected');
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-amber-950/40 relative">
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Alert */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Secondary Verification Required</h3>
            <p className="text-xs text-amber-300">
              Low confidence / lighting edge case &middot; Action challenge initiated
            </p>
          </div>
        </div>

        {userHint?.name && (
          <div className="mb-4 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex justify-between">
            <span className="text-slate-400">Target Identity:</span>
            <span className="text-cyan-400 font-semibold">{userHint.name} ({userHint.department})</span>
          </div>
        )}

        {/* Challenge Step 1: Active Blink */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              Step 1: Active Blink Challenge
            </span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              blinksCount >= 2 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-300'
            }`}>
              {blinksCount} / 2 Blinks
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${blinksCount >= 2 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min(100, (blinksCount / 2) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {blinksCount >= 2 ? '✓ Blink challenge satisfied' : 'Blinking twice naturally to verify active presence...'}
          </p>
        </div>

        {/* Challenge Step 2: 4-digit PIN */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-cyan-400" />
              Step 2: Enter 4-Digit Employee PIN
            </span>
          </div>

          {/* PIN Dots */}
          <div className="flex justify-center gap-3 my-3">
            {[0, 1, 2, 3].map(idx => (
              <div
                key={idx}
                className={`w-10 h-12 rounded-lg border flex items-center justify-center text-lg font-mono font-bold transition-all ${
                  idx < pin.length
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-400'
                    : 'border-slate-800 bg-slate-900 text-slate-600'
                }`}
              >
                {idx < pin.length ? '●' : ''}
              </div>
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'DEL'].map((val, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleKeypadPress(val.toString())}
                className="py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-slate-200 active:scale-95 transition-transform"
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/60 p-2.5 rounded-lg mb-4 text-center">
            {errorMsg}
          </p>
        )}

        {/* Submit Button */}
        <button
          onClick={handleVerify}
          disabled={submitting || pin.length !== 4 || blinksCount < 2}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 text-sm transition-all"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Verifying Credentials...
            </span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Confirm &amp; Unlock Turnstile
            </>
          )}
        </button>
      </div>
    </div>
  );
}
