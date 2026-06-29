'use client';

/**
 * Student Reports Page — /student/reports
 *
 * Shows per-subject attendance breakdown:
 *  - Subject name + code
 *  - Present / Absent counts
 *  - % with animated progress bar (red < 75%, amber 75-85%, green > 85%)
 *  - Low-attendance warning badge
 *  - Overall attendance summary card at top
 *  - SVG bar chart visualizing the per-subject %
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, BookOpen, CheckCircle, XCircle,
  AlertTriangle, Loader2, ArrowLeft, BarChart2,
  ShieldCheck, Award
} from 'lucide-react';
import { studentApi } from '../../../utils/api';

interface SubjectReport {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
  belowThreshold: boolean;
}

// Color logic
const pctColor = (pct: number) => {
  if (pct >= 85) return { bar: '#10b981', text: 'text-emerald-400', bg: 'bg-emerald-500' };
  if (pct >= 75) return { bar: '#f59e0b', text: 'text-amber-400',   bg: 'bg-amber-500' };
  return            { bar: '#f43f5e', text: 'text-rose-400',    bg: 'bg-rose-500' };
};

// Mini inline SVG bar chart
function BarChart({ data }: { data: SubjectReport[] }) {
  if (!data.length) return null;
  const barWidth = Math.min(40, Math.floor(480 / data.length) - 6);
  const maxH = 80;

  return (
    <svg width="100%" height={maxH + 30} viewBox={`0 0 ${data.length * (barWidth + 8)} ${maxH + 30}`}>
      {data.map((s, i) => {
        const x = i * (barWidth + 8);
        const h = Math.max(4, (s.percentage / 100) * maxH);
        const y = maxH - h;
        const color = pctColor(s.percentage).bar;
        return (
          <g key={s.subjectId}>
            <rect x={x} y={y} width={barWidth} height={h} rx={4} fill={color} fillOpacity={0.85} />
            <text x={x + barWidth / 2} y={maxH + 14} textAnchor="middle" fontSize={8} fill="#64748b">
              {s.subjectCode.length > 5 ? s.subjectCode.slice(0, 5) : s.subjectCode}
            </text>
            <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize={8} fill={color} fontWeight="bold">
              {s.percentage}%
            </text>
          </g>
        );
      })}
      {/* 75% line */}
      <line x1={0} y1={maxH * 0.25} x2={data.length * (barWidth + 8)} y2={maxH * 0.25}
        stroke="#ef4444" strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
    </svg>
  );
}

export default function StudentReportsPage() {
  const router = useRouter();
  const [data, setData]       = useState<SubjectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'}/reports/student/me`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` } }
        );
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json());
      } catch (e: any) {
        setError(e.message ?? 'Failed to load report');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Overall stats
  const totalSessions = data.reduce((a, s) => a + s.totalSessions, 0);
  const totalPresent  = data.reduce((a, s) => a + s.presentCount, 0);
  const totalAbsent   = data.reduce((a, s) => a + s.absentCount, 0);
  const overallPct    = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;
  const lowCount      = data.filter(s => s.belowThreshold).length;
  const topSubject    = data.length > 0
    ? [...data].sort((a, b) => b.percentage - a.percentage)[0]
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <div className="fixed top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2.5 hover:bg-slate-800 rounded-xl transition-all cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-100">My Attendance Report</h1>
              <p className="text-slate-500 text-sm">Subject-wise breakdown</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 px-4 py-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Overall',   value: `${overallPct}%`, icon: <TrendingUp className="w-4 h-4 text-indigo-400" />, highlight: true },
            { label: 'Present',   value: totalPresent, icon: <CheckCircle className="w-4 h-4 text-emerald-400" /> },
            { label: 'Absent',    value: totalAbsent,  icon: <XCircle className="w-4 h-4 text-rose-400" /> },
            { label: 'At Risk',   value: lowCount,     icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> },
          ].map(card => (
            <div key={card.label}
              className={`rounded-2xl p-4 border ${card.highlight
                ? 'bg-indigo-600/10 border-indigo-500/30'
                : 'bg-slate-900/50 border-slate-800'}`}>
              <div className="flex items-center gap-2 mb-2">{card.icon}
                <span className="text-slate-500 text-xs">{card.label}</span>
              </div>
              <p className={`text-2xl font-black ${card.highlight ? 'text-indigo-300' : 'text-slate-100'}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* Overall progress ring */}
        <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-6">
          {/* SVG ring */}
          <div className="relative flex-shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="8"/>
              <circle cx="40" cy="40" r="32" fill="none"
                stroke={pctColor(overallPct).bar}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={201.06}
                strokeDashoffset={201.06 - (201.06 * overallPct / 100)}
                transform="rotate(-90 40 40)"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-black ${pctColor(overallPct).text}`}>{overallPct}%</span>
            </div>
          </div>
          <div>
            <h3 className="font-black text-slate-200">Overall Attendance</h3>
            <p className="text-slate-500 text-sm mt-0.5">
              {totalPresent} present out of {totalSessions} sessions across {data.length} subjects
            </p>
            {topSubject && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
                <Award className="w-3.5 h-3.5" />
                Best: {topSubject.subjectName} ({topSubject.percentage}%)
              </div>
            )}
          </div>
        </div>

        {/* Low attendance alert */}
        {lowCount > 0 && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3.5 bg-amber-950/40 border border-amber-500/30 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold text-sm">Low Attendance Warning</p>
              <p className="text-amber-600 text-xs mt-0.5">
                You are below 75% in {lowCount} subject{lowCount > 1 ? 's' : ''}.
                Minimum 75% attendance is typically required for exam eligibility.
              </p>
            </div>
          </div>
        )}

        {/* Bar chart */}
        {data.length > 0 && (
          <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
            <p className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Subject Comparison
            </p>
            <BarChart data={data} />
            <p className="text-[10px] text-slate-600 mt-1">— — — 75% minimum threshold</p>
          </div>
        )}

        {/* Subject cards */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Per Subject Breakdown ({data.length})
          </h2>
          {data.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-slate-800">
              <BookOpen className="w-10 h-10 mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 font-semibold">No sessions recorded yet</p>
              <p className="text-slate-700 text-sm mt-1">Attend your first class to see your report</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map(subject => {
                const colors = pctColor(subject.percentage);
                return (
                  <div key={subject.subjectId}
                    className={`bg-slate-900/50 border rounded-2xl p-5 transition-all ${
                      subject.belowThreshold ? 'border-rose-500/20' : 'border-slate-800'}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-100">{subject.subjectName}</p>
                          <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-500 font-mono">
                            {subject.subjectCode}
                          </span>
                          {subject.belowThreshold && (
                            <span className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                              ⚠ AT RISK
                            </span>
                          )}
                          {subject.percentage >= 85 && (
                            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                              ✓ EXCELLENT
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            {subject.presentCount} present
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" />
                            {subject.absentCount} absent
                          </span>
                          <span>{subject.totalSessions} total sessions</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-2xl font-black ${colors.text}`}>
                          {subject.percentage}%
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5">attendance</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                      {/* 75% threshold marker */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-slate-600/80" style={{ left: '75%' }} />
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${subject.percentage}%`,
                          background: `linear-gradient(90deg, ${colors.bar}aa, ${colors.bar})`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-700 mt-1">
                      <span>0%</span>
                      <span className="text-slate-600">75% min</span>
                      <span>100%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
