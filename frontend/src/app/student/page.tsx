'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  ScanLine, BookOpen, CheckCircle, XCircle, Clock,
  Loader2, ShieldCheck, TrendingUp, Calendar, User, AlertCircle, BarChart2, LogOut
} from 'lucide-react';
import { studentApi } from '../../utils/api';

interface AttendanceRecord {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  markedAt: string;
  livenessPassed: boolean;
  faceSimilarity: number | null;
  verificationMethod: string;
  session: {
    id: string;
    title: string;
    subject: { name: string; code: string };
    scheduledAt: string;
  };
}

function StudentDashboardInner() {
  const router = useRouter();

  const [profile, setProfile]   = useState<any>(null);
  const [history, setHistory]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [prof, hist] = await Promise.all([
          studentApi.getProfile(),
          studentApi.getHistory(),
        ]);
        setProfile(prof);
        setHistory(hist);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const presentCount = history.filter(r => r.status === 'PRESENT').length;
  const absentCount  = history.filter(r => r.status === 'ABSENT').length;
  const percentage   = history.length > 0
    ? Math.round((presentCount / history.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <div className="fixed top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100">
                {profile?.fullName ?? 'Student Portal'}
              </h1>
              <p className="text-slate-500 text-sm">
                {profile?.rollNumber && `Roll: ${profile.rollNumber} · `}
                {profile?.year?.label} · {profile?.year?.branch?.name}
              </p>
            </div>
          </div>

          {/* Big scan button */}
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
              onClick={() => router.push('/student/reports')}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl transition-all cursor-pointer text-sm">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              Reports
            </button>
            <button
              onClick={() => router.push('/student/scanner')}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-bold rounded-2xl transition-all shadow-xl shadow-indigo-600/30 cursor-pointer">
              <ScanLine className="w-5 h-5" />
              Scan QR
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Face enrollment warning */}
        {profile && !profile.faceEnrolled && (
          <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3.5 bg-amber-950/40 border border-amber-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-300 font-bold text-sm">Face Not Enrolled</p>
                <p className="text-amber-500 text-xs">Register your face once to enable biometric QR attendance.</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/student/enroll')}
              className="flex-shrink-0 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-bold rounded-xl text-sm transition-all cursor-pointer">
              Enroll Now
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Present',    value: presentCount, icon: <CheckCircle className="w-5 h-5 text-emerald-400" />, color: 'emerald' },
            { label: 'Absent',     value: absentCount,  icon: <XCircle className="w-5 h-5 text-rose-400" />,    color: 'rose' },
            { label: 'Attendance', value: `${percentage}%`, icon: <TrendingUp className="w-5 h-5 text-indigo-400" />, color: 'indigo' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex items-center gap-4">
              <div className={`w-10 h-10 bg-${s.color}-500/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                {s.icon}
              </div>
              <div>
                <p className="text-xl font-black text-slate-100">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Attendance History */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
            Attendance History ({history.length} sessions)
          </h2>

          {history.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800/60">
              <BookOpen className="w-10 h-10 mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 font-semibold">No attendance records yet</p>
              <p className="text-slate-700 text-sm mt-1">Start by scanning the QR code in class</p>
              <button
                onClick={() => router.push('/student/scanner')}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer text-sm mx-auto">
                <ScanLine className="w-4 h-4" /> Scan First QR
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map(record => (
                <div key={record.id}
                  className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl hover:border-slate-700/60 transition-all">

                  {/* Status dot */}
                  <div className={`w-2 h-10 rounded-full flex-shrink-0 ${
                    record.status === 'PRESENT' ? 'bg-emerald-400' : 'bg-rose-400'
                  }`} />

                  {/* Session info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-200 truncate text-sm">
                      {record.session?.title ?? '—'}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        {record.session?.subject?.name ?? '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {record.session?.scheduledAt
                          ? new Date(record.session.scheduledAt).toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Verification method */}
                  {record.verificationMethod === 'QR_FACE_LIVENESS' && (
                    <div className="hidden sm:flex items-center gap-1 text-xs text-indigo-400">
                      <ShieldCheck className="w-3 h-3" />
                      Face + QR
                    </div>
                  )}

                  {/* Time */}
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      record.status === 'PRESENT'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    }`}>
                      {record.status}
                    </span>
                    <p className="text-[10px] text-slate-600 mt-1 flex items-center gap-1 justify-end">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(record.markedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <StudentDashboardInner />
    </Suspense>
  );
}
