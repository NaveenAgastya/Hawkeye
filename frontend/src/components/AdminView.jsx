import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, ShieldAlert, Users, Play, Clock, CheckCircle2, AlertTriangle, XCircle, Trash2, RefreshCw } from 'lucide-react';

export default function AdminView() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, logsRes, usersRes] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch(`/api/logs?limit=50${outcomeFilter ? `&outcome=${outcomeFilter}` : ''}`).then(r => r.json()),
        fetch('/api/users').then(r => r.json())
      ]);
      setStats(statsRes);
      setLogs(logsRes);
      setUsers(usersRes);
    } catch (err) {
      console.error('Fetch admin error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [outcomeFilter]);

  const handleDeleteUser = async (uid) => {
    if (!confirm('Are you sure you want to revoke this user credential?')) return;
    try {
      await fetch(`/api/users/${uid}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const handleRunBenchmark = async () => {
    setBenchmarkLoading(true);
    setBenchmarkResult(null);
    try {
      const res = await fetch('/api/benchmark/run', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setBenchmarkResult(data.report);
      } else {
        alert(data.detail || 'Benchmark failed');
      }
    } catch (err) {
      alert('Benchmark execution error');
    } finally {
      setBenchmarkLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 flex flex-col gap-8">
      {/* Top Header & Benchmark Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
            Audit Logs, Metrics &amp; Benchmarks
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time biometric telemetry, attack classification, and ISO/IEC 30107-3 reporting
          </p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={benchmarkLoading}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all disabled:opacity-50"
        >
          {benchmarkLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Running Evaluation Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Run Presentation Attack Benchmark</span>
            </>
          )}
        </button>
      </div>

      {/* Benchmark Report Modal/Card if executed */}
      {benchmarkResult && (
        <div className="bg-slate-900/95 border border-cyan-500/50 rounded-3xl p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ISO/IEC 30107-3 Benchmark Report
              </h3>
              <p className="text-xs text-cyan-300">
                Automated evaluation across Bona Fide and 4 Presentation Attack species
              </p>
            </div>
            <button
              onClick={() => setBenchmarkResult(null)}
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono">BPCER (False Rejection)</span>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {(benchmarkResult.bpcer * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono">Mean Decision Latency</span>
              <p className="text-xl font-bold font-mono text-cyan-400">
                {benchmarkResult.latency?.mean_ms} ms
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono">95th Percentile Latency</span>
              <p className="text-xl font-bold font-mono text-cyan-300">
                {benchmarkResult.latency?.p95_ms} ms
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono">&le; 2.0s Compliance</span>
              <p className="text-xl font-bold font-mono text-emerald-400">
                {benchmarkResult.latency?.compliant ? 'PASS (100%)' : 'FAIL'}
              </p>
            </div>
          </div>

          {/* Scenario Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 px-3">Attack Scenario</th>
                  <th className="py-2 px-3">Samples</th>
                  <th className="py-2 px-3">APCER (False Acceptance)</th>
                  <th className="py-2 px-3">Detection Rate</th>
                  <th className="py-2 px-3">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(benchmarkResult.attack_scenarios || {}).map(([name, sc], idx) => (
                  <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-white font-semibold capitalize">{name.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 text-slate-300">{sc.n}</td>
                    <td className={`py-2.5 px-3 font-bold ${sc.apcer <= 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(sc.apcer * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">
                      {(sc.detection_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{sc.avg_latency_ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPI Overview Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 font-mono">Total Authentications</span>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono">{stats.total_attempts}</h3>
            <span className="text-[11px] text-emerald-400 mt-1 block">Pass rate: {stats.pass_rate_pct}%</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 font-mono">ALLOW / VERIFY / DENY</span>
            <div className="flex items-baseline gap-2 mt-1 font-mono">
              <span className="text-emerald-400 font-bold text-lg">{stats.allow_count}</span>
              <span className="text-slate-500">/</span>
              <span className="text-amber-400 font-bold text-lg">{stats.verify_count}</span>
              <span className="text-slate-500">/</span>
              <span className="text-red-400 font-bold text-lg">{stats.deny_count}</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Tri-state access decisions</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 font-mono">Avg Decision Time</span>
            <h3 className="text-2xl font-bold text-cyan-400 mt-1 font-mono">{stats.avg_latency_ms} ms</h3>
            <span className="text-[11px] text-emerald-400 mt-1 block">&le; 2000 ms SLA Met</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
            <span className="text-xs text-slate-400 font-mono">Registered Employees</span>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono">{stats.registered_users}</h3>
            <span className="text-[11px] text-slate-400 mt-1 block">Encrypted biometric vault</span>
          </div>
        </div>
      )}

      {/* Main Grid: Enrolled Users & Live Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Enrolled Users (4 Cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Enrolled Employees ({users.length})
            </h3>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[460px] overflow-y-auto pr-1">
            {users.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                No users registered yet. Enroll in the "Enroll Employee" tab.
              </p>
            ) : (
              users.map(u => (
                <div key={u.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={`/photos/${u.photo}`}
                      alt={u.name}
                      className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-slate-700 flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{u.name}</p>
                      <span className="text-[10px] font-mono text-cyan-400">{u.employee_id} &middot; {u.department}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteUser(u.id)}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-900 transition-colors"
                    title="Revoke access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Log Table (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Live Access Audit Log
            </h3>

            {/* Filter buttons */}
            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {['', 'ALLOW', 'REQUEST_VERIFICATION', 'DENY'].map(f => (
                <button
                  key={f}
                  onClick={() => setOutcomeFilter(f)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    outcomeFilter === f ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === '' ? 'All' : f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Decision</th>
                  <th className="py-2.5 px-3">Live / Match</th>
                  <th className="py-2.5 px-3">Latency</th>
                  <th className="py-2.5 px-3">Attack / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No access attempts recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const timeStr = new Date(log.ts * 1000).toLocaleTimeString();
                    return (
                      <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-400">{timeStr}</td>
                        <td className="py-2.5 px-3 text-white font-semibold">
                          {log.name || 'Unregistered Face'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            log.outcome === 'ALLOW'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : log.outcome === 'REQUEST_VERIFICATION'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-red-950 text-red-400 border border-red-800'
                          }`}>
                            {log.outcome}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {log.live ? `${(log.live * 100).toFixed(0)}%` : '0%'} / {log.sim ? log.sim.toFixed(2) : '-'}
                        </td>
                        <td className={`py-2.5 px-3 font-bold ${log.ms <= 2000 ? 'text-cyan-400' : 'text-amber-400'}`}>
                          {log.ms} ms
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs" title={log.reason}>
                          {log.spoof_type && log.spoof_type !== 'Real' && (
                            <span className="text-red-400 font-bold mr-1">[{log.spoof_type}]</span>
                          )}
                          {log.reason}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
