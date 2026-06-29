'use client';

/**
 * Teacher Reports Page — /teacher/reports
 *
 * Two-panel layout:
 *  LEFT (list): All teacher sessions with quick stats (date, subject, present/absent, %)
 *  RIGHT (detail): Click a session → full attendance sheet table + CSV export
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, BarChart2, CheckCircle, XCircle,
  Download, Loader2, Users, Calendar,
  BookOpen, TrendingUp, ChevronRight
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

interface SessionSummary {
  sessionId: string;
  sessionTitle: string;
  subjectName: string;
  subjectCode: string;
  scheduledAt: string;
  status: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  attendancePercentage: number;
}

interface SheetEntry {
  studentId: string;
  fullName: string;
  rollNumber: string;
  branchName: string;
  yearLabel: string;
  status: string;
  markedAt: string | null;
  faceSimilarity: number | null;
  livenessPassed: boolean;
  verificationMethod: string;
}

interface SessionReport extends SessionSummary {
  teacherName: string;
  startedAt: string | null;
  endedAt: string | null;
  entries: SheetEntry[];
}

const statusColor = (status: string) => ({
  ACTIVE:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  ENDED:      'text-slate-400 bg-slate-800/60 border-slate-700',
  SCHEDULED:  'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
}[status] ?? 'text-slate-400 bg-slate-800 border-slate-700');

const pct2color = (p: number) =>
  p >= 85 ? 'text-emerald-400' : p >= 75 ? 'text-amber-400' : 'text-rose-400';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` };
}

export default function TeacherReportsPage() {
  const router = useRouter();

  const [sessions, setSessions]     = useState<SessionSummary[]>([]);
  const [selected, setSelected]     = useState<SessionReport | null>(null);
  const [loading, setLoading]       = useState(true);
  const [detailLoading, setDetail]  = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/reports/teacher/sessions`, { headers: authHeaders() });
        if (!res.ok) throw new Error(await res.text());
        setSessions(await res.json());
      } catch (e: any) {
        setError(e.message ?? 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openSession = useCallback(async (sessionId: string) => {
    setDetail(true);
    setSelected(null);
    try {
      const res = await fetch(`${API}/reports/session/${sessionId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      setSelected(await res.json());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load session detail');
    } finally {
      setDetail(false);
    }
  }, []);

  const downloadCsv = useCallback(async (sessionId: string, title: string) => {
    setExporting(true);
    try {
      const res = await fetch(`${API}/reports/session/${sessionId}/export`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `attendance-${title.replace(/\s+/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="fixed top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top bar */}
      <header className="border-b border-slate-800/60 px-6 py-4 flex items-center gap-4 z-10 bg-slate-950/80 backdrop-blur sticky top-0">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-xl transition-all cursor-pointer">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-black text-lg text-slate-100">Session Reports</h1>
        </div>
        {sessions.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">{sessions.length} sessions</span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Session list ─────────────────────────────────── */}
        <aside className="w-80 flex-shrink-0 border-r border-slate-800/60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 text-rose-400 text-sm">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-600">
              <BookOpen className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">No sessions yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sessions.map(s => (
                <button
                  key={s.sessionId}
                  onClick={() => openSession(s.sessionId)}
                  className={`w-full text-left p-4 rounded-xl transition-all cursor-pointer group border ${
                    selected?.sessionId === s.sessionId
                      ? 'bg-indigo-600/10 border-indigo-500/30'
                      : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700/50'
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="font-bold text-slate-200 text-sm truncate">{s.sessionTitle}</p>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0 group-hover:text-slate-400 transition-colors" />
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {s.subjectName} · {new Date(s.scheduledAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusColor(s.status)}`}>
                      {s.status}
                    </span>
                    <span className={`text-xs font-black ml-auto ${pct2color(s.attendancePercentage)}`}>
                      {s.attendancePercentage}%
                    </span>
                    <span className="text-xs text-slate-600">
                      {s.presentCount}/{s.totalStudents}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── RIGHT: Session detail ──────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center h-full gap-3">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
              <span className="text-slate-500 text-sm">Loading session report…</span>
            </div>
          ) : !selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3">
              <BarChart2 className="w-12 h-12" />
              <p className="font-semibold">Select a session to view its report</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Session meta */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-100">{selected.sessionTitle}</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    {selected.subjectName} ({selected.subjectCode}) ·{' '}
                    {new Date(selected.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => downloadCsv(selected.sessionId, selected.sessionTitle)}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 font-bold rounded-xl transition-all cursor-pointer text-sm flex-shrink-0">
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export CSV
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'Total',    value: selected.totalStudents,        icon: <Users className="w-4 h-4 text-slate-400" /> },
                  { label: 'Present',  value: selected.presentCount,         icon: <CheckCircle className="w-4 h-4 text-emerald-400" /> },
                  { label: 'Absent',   value: selected.absentCount,          icon: <XCircle className="w-4 h-4 text-rose-400" /> },
                  { label: 'Rate',     value: `${selected.attendancePercentage}%`, icon: <TrendingUp className="w-4 h-4 text-indigo-400" /> },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">{stat.icon}
                      <span className="text-xs text-slate-500">{stat.label}</span>
                    </div>
                    <p className="text-xl font-black text-slate-100">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mb-6 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${selected.attendancePercentage}%`,
                    background: selected.attendancePercentage >= 75
                      ? 'linear-gradient(90deg,#10b981,#059669)'
                      : 'linear-gradient(90deg,#f59e0b,#d97706)',
                  }}
                />
              </div>

              {/* Attendance sheet table */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-400">
                    Attendance Sheet ({selected.entries?.length ?? 0} students)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-600 text-xs">
                        <th className="text-left px-4 py-3 font-semibold">Roll No.</th>
                        <th className="text-left px-4 py-3 font-semibold">Name</th>
                        <th className="text-left px-4 py-3 font-semibold">Branch/Year</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                        <th className="text-left px-4 py-3 font-semibold">Marked At</th>
                        <th className="text-center px-4 py-3 font-semibold">Face Match</th>
                        <th className="text-center px-4 py-3 font-semibold">Liveness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.entries ?? []).map((entry, i) => (
                        <tr key={entry.studentId}
                          className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${
                            i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{entry.rollNumber}</td>
                          <td className="px-4 py-3 font-semibold text-slate-200">{entry.fullName}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{entry.branchName} · {entry.yearLabel}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                              entry.status === 'PRESENT'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                              {entry.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {entry.markedAt ? new Date(entry.markedAt).toLocaleTimeString() : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-bold">
                            {entry.faceSimilarity != null
                              ? <span className="text-indigo-400">{Math.round(entry.faceSimilarity * 100)}%</span>
                              : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-sm">
                            {entry.livenessPassed
                              ? <span className="text-emerald-400">✓</span>
                              : <span className="text-slate-700">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
