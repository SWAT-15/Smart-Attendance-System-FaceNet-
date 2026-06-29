'use client';

/**
 * Admin Analytics / Reports — /admin/reports
 *
 * System-wide overview:
 *  - Total students, sessions, overall % 
 *  - Enrolled vs. pending face enrollment
 *  - Present vs. absent total marks
 *  - Branch-wise student distribution
 *  - Animated SVG donut for overall attendance
 *  - Per-branch horizontal bar chart
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Users, BookOpen, CheckCircle, XCircle,
  ShieldCheck, TrendingUp, AlertCircle, BarChart2,
  Loader2, Clock
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

interface BranchStat {
  branchName: string;
  totalStudents: number;
}

interface AdminOverview {
  totalStudents: number;
  enrolledStudents: number;
  totalSessions: number;
  totalPresentMarks: number;
  totalAbsentMarks: number;
  overallAttendancePct: number;
  branchStats: BranchStat[];
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` };
}

// SVG Donut chart
function DonutChart({ value, size = 120 }: { value: number; size?: number }) {
  const r = size / 2 - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * value) / 100;
  const color = value >= 75 ? '#10b981' : value >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth={10} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        className="transition-all duration-1000"
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color} fontSize={size * 0.15} fontWeight="bold">
        {value}%
      </text>
    </svg>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [data, setData]       = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/reports/admin/overview`, { headers: authHeaders() });
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
      } catch (e: any) {
        setError(e.message ?? 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  const enrollPct = data && data.totalStudents > 0
    ? Math.round((data.enrolledStudents / data.totalStudents) * 100)
    : 0;

  const maxBranchStudents = data?.branchStats.length
    ? Math.max(...data.branchStats.map(b => b.totalStudents), 1)
    : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <div className="fixed top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-64 h-64 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <header className="mb-8 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2.5 hover:bg-slate-800 rounded-xl transition-all cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-100">System Analytics</h1>
              <p className="text-slate-500 text-sm">Institution-wide attendance overview</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {data && (
          <>
            {/* Key Metrics — top row */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Total Students',   value: data.totalStudents,    icon: <Users className="w-5 h-5 text-indigo-400" />,   accent: 'indigo' },
                { label: 'Total Sessions',   value: data.totalSessions,    icon: <BookOpen className="w-5 h-5 text-violet-400" />, accent: 'violet' },
                { label: 'Present Records',  value: data.totalPresentMarks, icon: <CheckCircle className="w-5 h-5 text-emerald-400" />, accent: 'emerald' },
                { label: 'Absent Records',   value: data.totalAbsentMarks,  icon: <XCircle className="w-5 h-5 text-rose-400" />,    accent: 'rose' },
                { label: 'Face Enrolled',    value: data.enrolledStudents,  icon: <ShieldCheck className="w-5 h-5 text-cyan-400" />,  accent: 'cyan' },
                { label: 'Pending Enroll',   value: data.totalStudents - data.enrolledStudents, icon: <AlertCircle className="w-5 h-5 text-amber-400" />, accent: 'amber' },
              ].map(card => (
                <div key={card.label} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-slate-800/80 flex items-center justify-center flex-shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-100">{card.value.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Main analytics row */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">

              {/* Overall attendance donut */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex items-center gap-6">
                <DonutChart value={data.overallAttendancePct} size={120} />
                <div>
                  <h3 className="font-black text-slate-200 text-lg">Overall Attendance</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {data.totalPresentMarks.toLocaleString()} present out of{' '}
                    {(data.totalPresentMarks + data.totalAbsentMarks).toLocaleString()} total marks
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                      Present: {data.totalPresentMarks.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-400">
                      <div className="w-2 h-2 bg-rose-400 rounded-full" />
                      Absent: {data.totalAbsentMarks.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Face enrollment progress */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-black text-slate-200">Face Enrollment Status</h3>
                </div>

                <div className="flex items-end gap-4 mb-4">
                  <DonutChart value={enrollPct} size={96} />
                  <div className="pb-2">
                    <p className="text-sm text-slate-400">
                      <span className="text-xl font-black text-cyan-400">{data.enrolledStudents}</span>
                      <span className="text-slate-600"> / {data.totalStudents}</span> enrolled
                    </p>
                    {data.totalStudents - data.enrolledStudents > 0 && (
                      <p className="text-xs text-amber-500 mt-1">
                        {data.totalStudents - data.enrolledStudents} students cannot attend until enrolled
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => router.push('/admin/enrollment')}
                  className="w-full py-2.5 bg-cyan-600/10 border border-cyan-500/20 hover:bg-cyan-500/15 text-cyan-400 font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Manage Face Enrollment
                </button>
              </div>
            </div>

            {/* Branch breakdown */}
            {data.branchStats.length > 0 && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-black text-slate-200">Branch Distribution</h3>
                </div>
                <div className="space-y-4">
                  {data.branchStats.map(branch => {
                    const widthPct = Math.round((branch.totalStudents / maxBranchStudents) * 100);
                    return (
                      <div key={branch.branchName}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-semibold text-slate-300">{branch.branchName}</span>
                          <span className="text-slate-500 font-mono">{branch.totalStudents} students</span>
                        </div>
                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-700"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Manage Students', path: '/admin', icon: <Users className="w-4 h-4" />, color: 'indigo' },
                { label: 'Face Enrollment', path: '/admin/enrollment', icon: <ShieldCheck className="w-4 h-4" />, color: 'cyan' },
                { label: 'Active Sessions', path: '/teacher', icon: <Clock className="w-4 h-4" />, color: 'violet' },
              ].map(link => (
                <button
                  key={link.path}
                  onClick={() => router.push(link.path)}
                  className="flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all cursor-pointer text-left group">
                  <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-slate-200 transition-colors">
                    {link.icon}
                  </div>
                  <span className="text-sm font-bold text-slate-400 group-hover:text-slate-200 transition-colors">
                    {link.label}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
