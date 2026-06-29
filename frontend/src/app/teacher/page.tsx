'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MonitorPlay, Plus, Play, Calendar, Clock, Users,
  BookOpen, Layers, CheckCircle, XCircle, Loader2,
  ChevronRight, Radio, LayoutDashboard, LogOut
} from 'lucide-react';
import { teacherApi } from '../../utils/api';

// ── Types ──────────────────────────────────────────────────────────
type SessionStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface Session {
  id: string;
  title: string;
  room: string;
  status: SessionStatus;
  subjectName: string;
  subjectCode: string;
  yearLabel: string;
  branchName: string;
  scheduledAt: string;
  startedAt: string | null;
  presentCount: number;
}

// ── Status display helpers ─────────────────────────────────────────
const STATUS_CONFIG: Record<SessionStatus, { label: string; classes: string; icon: React.ReactNode }> = {
  SCHEDULED: {
    label: 'Scheduled',
    classes: 'bg-slate-700/50 border-slate-600/50 text-slate-300',
    icon: <Calendar className="w-3 h-3" />,
  },
  ACTIVE: {
    label: 'Live',
    classes: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400',
    icon: <Radio className="w-3 h-3 animate-pulse" />,
  },
  COMPLETED: {
    label: 'Completed',
    classes: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    icon: <XCircle className="w-3 h-3" />,
  },
};

function StatusBadge({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.SCHEDULED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full border ${cfg.classes}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function TeacherPortalPage() {
  const router = useRouter();

  const [sessions, setSessions]   = useState<Session[]>([]);
  const [subjects, setSubjects]   = useState<any[]>([]);
  const [years, setYears]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [starting, setStarting]   = useState<string | null>(null);
  const [toast, setToast]         = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [form, setForm] = useState({
    title: '',
    room: '',
    subjectId: '',
    yearId: '',
    scheduledAt: new Date().toISOString().slice(0, 16),
  });

  // ── Helpers ──────────────────────────────────────────────────────
  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sub, y] = await Promise.all([
        teacherApi.getSessions(),
        teacherApi.getSubjects(),
        teacherApi.getYears(),
      ]);
      setSessions(s as Session[]);
      setSubjects(sub);
      setYears(y);
    } catch (e: any) {
      showToast('error', e.message ?? 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Create Session ────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await teacherApi.createSession({
        ...form,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      showToast('success', `Session "${form.title}" created!`);
      setShowForm(false);
      setForm({ title: '', room: '', subjectId: '', yearId: '', scheduledAt: new Date().toISOString().slice(0, 16) });
      loadData();
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setCreating(false);
    }
  };

  // ── Start Session → navigate to projector ─────────────────────
  const handleStart = async (session: Session) => {
    if (session.status === 'ACTIVE') {
      router.push(`/teacher/projector?sessionId=${session.id}`);
      return;
    }
    setStarting(session.id);
    try {
      await teacherApi.startSession(session.id);
      showToast('success', 'Session started! Opening projector…');
      setTimeout(() => router.push(`/teacher/projector?sessionId=${session.id}`), 800);
    } catch (e: any) {
      showToast('error', e.message);
      setStarting(null);
    }
  };

  // ── Session Stats ──────────────────────────────────────────────
  const activeCount    = sessions.filter(s => s.status === 'ACTIVE').length;
  const scheduledCount = sessions.filter(s => s.status === 'SCHEDULED').length;
  const completedCount = sessions.filter(s => s.status === 'COMPLETED').length;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {/* BG glow */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold
          ${toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/40 text-rose-300'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <MonitorPlay className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100">Teacher Portal</h1>
              <p className="text-slate-500 text-sm">Manage your class sessions and QR attendance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('token');
                router.replace('/login');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/20 hover:border-rose-500/50 rounded-xl text-rose-300 transition-all cursor-pointer text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer">
              <Plus className="w-4 h-4" /> New Session
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Live Now', value: activeCount, icon: <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />, color: 'emerald' },
            { label: 'Scheduled', value: scheduledCount, icon: <Calendar className="w-5 h-5 text-amber-400" />, color: 'amber' },
            { label: 'Completed', value: completedCount, icon: <CheckCircle className="w-5 h-5 text-indigo-400" />, color: 'indigo' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
              <div className={`w-10 h-10 bg-${stat.color}-500/10 rounded-xl flex items-center justify-center`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xl font-black text-slate-100">{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Create Session Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-xl font-black text-slate-100 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" /> Create Class Session
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Session Title</label>
                  <input required value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Lecture 12 – Binary Trees"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Room / Location</label>
                  <input value={form.room}
                    onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                    placeholder="e.g. Lab-3 or Zoom link"
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Subject</label>
                    <select required value={form.subjectId}
                      onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100">
                      <option value="">Select subject…</option>
                      {subjects.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Year Group</label>
                    <select required value={form.yearId}
                      onChange={e => setForm(f => ({ ...f, yearId: e.target.value }))}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100">
                      <option value="">Select year…</option>
                      {years.map((y: any) => (
                        <option key={y.id} value={y.id}>{y.branch?.name} — {y.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Scheduled At</label>
                  <input type="datetime-local" value={form.scheduledAt}
                    onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-100" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl transition-all cursor-pointer text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2">
                    {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Session'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sessions List */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            Your Sessions ({sessions.length})
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Loading sessions…</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/60">
              <MonitorPlay className="w-12 h-12 mx-auto text-slate-700 mb-4" />
              <p className="text-slate-400 font-semibold">No sessions yet</p>
              <p className="text-slate-600 text-sm mt-1">Create your first session to begin taking attendance</p>
              <button onClick={() => setShowForm(true)}
                className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer text-sm">
                Create First Session
              </button>
            </div>
          ) : (
            sessions.map(session => (
              <div key={session.id}
                className="group flex items-center gap-5 p-5 bg-slate-900/50 border border-slate-800/80 rounded-2xl hover:border-indigo-500/30 transition-all">

                {/* Status indicator bar */}
                <div className={`w-1 h-14 rounded-full flex-shrink-0 ${
                  session.status === 'ACTIVE'     ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' :
                  session.status === 'SCHEDULED'  ? 'bg-amber-400/60' :
                  session.status === 'COMPLETED'  ? 'bg-indigo-400/60' : 'bg-slate-700'
                }`} />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-slate-100 truncate">{session.title}</h3>
                    <StatusBadge status={session.status} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {session.subjectName}</span>
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {session.branchName} · {session.yearLabel}</span>
                    {session.room && <span className="flex items-center gap-1"><LayoutDashboard className="w-3 h-3" /> {session.room}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(session.scheduledAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Present count */}
                {session.status !== 'SCHEDULED' && (
                  <div className="text-center flex-shrink-0">
                    <p className="text-xl font-black text-slate-200">{session.presentCount}</p>
                    <p className="text-[10px] text-slate-600 uppercase tracking-wider">Present</p>
                  </div>
                )}

                {/* Action button */}
                <div className="flex-shrink-0">
                  {(session.status === 'SCHEDULED' || session.status === 'ACTIVE') ? (
                    <button
                      onClick={() => handleStart(session)}
                      disabled={starting === session.id}
                      className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer text-sm
                        ${session.status === 'ACTIVE'
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                          : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}`}
                    >
                      {starting === session.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : session.status === 'ACTIVE'
                          ? <><Radio className="w-4 h-4" /> Open Projector</>
                          : <><Play className="w-4 h-4" /> Start Session</>}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-slate-600 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{session.presentCount} marked</span>
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
