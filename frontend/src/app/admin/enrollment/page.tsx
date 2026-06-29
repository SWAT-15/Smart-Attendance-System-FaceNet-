'use client';

/**
 * Admin Face Enrollment Dashboard — /admin/enrollment
 *
 * Features:
 *  - Lists all students with their face enrollment status
 *  - Filter: All / Enrolled / Not Enrolled
 *  - Per-student: open webcam capture modal → extract FaceNet embedding → save
 *  - Per-student: reset enrollment (delete embedding)
 *  - Bulk view: progress bar showing % enrolled
 *  - File upload fallback (if admin has a photo of the student)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera, CheckCircle, XCircle, Search, RefreshCw,
  Loader2, ShieldCheck, Users, AlertCircle, Upload,
  X, RotateCcw, TrendingUp
} from 'lucide-react';
import { adminApi, enrollmentApi } from '../../../utils/api';
import canvasConfetti from 'canvas-confetti';

interface Student {
  id: string;
  fullName: string;
  email: string;
  rollNumber: string;
  faceEnrolled: boolean;
  yearLabel: string;
  branchName: string;
  isEnabled: boolean;
}

type FilterTab = 'ALL' | 'ENROLLED' | 'PENDING';

// ── Webcam Capture Modal ────────────────────────────────────────────
function CaptureModal({
  student,
  onClose,
  onSuccess,
}: {
  student: Student;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [captured, setCaptured]     = useState<string>('');
  const [countdown, setCountdown]   = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [cameraReady, setReady]     = useState(false);
  const [useUpload, setUseUpload]   = useState(false);

  // Start camera on mount
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setUseUpload(true); // fallback to file upload
      }
    };
    if (!useUpload) start();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, [useUpload]);

  const startCountdown = () => {
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c -= 1;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(interval);
        captureFrame();
      }
    }, 1000);
  };

  const captureFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0);
    ctx.restore();
    setCaptured(canvas.toDataURL('image/jpeg', 0.95));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCaptured(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleEnroll = async () => {
    if (!captured) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await enrollmentApi.adminEnroll(student.id, captured);
      if (result.status === 'SUCCESS') {
        canvasConfetti({ particleCount: 80, spread: 50, origin: { y: 0.4 } });
        onSuccess();
      } else {
        setError(result.message ?? 'Enrollment failed.');
      }
    } catch (e: any) {
      setError(e.message ?? 'Server error. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-black text-slate-100">Enroll Face</h3>
            <p className="text-xs text-slate-500 mt-0.5">{student.fullName} · {student.rollNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-all cursor-pointer">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="p-6 space-y-4">
          {/* Tab: webcam vs upload */}
          <div className="flex gap-2">
            <button
              onClick={() => { setUseUpload(false); setCaptured(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${!useUpload ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              <Camera className="w-4 h-4 inline mr-1.5" /> Webcam
            </button>
            <button
              onClick={() => { setUseUpload(true); setCaptured(''); streamRef.current?.getTracks().forEach(t => t.stop()); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${useUpload ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              <Upload className="w-4 h-4 inline mr-1.5" /> Upload Photo
            </button>
          </div>

          {/* Webcam view */}
          {!useUpload && !captured && (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              {/* Oval face guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-44 rounded-full border-2 border-indigo-400/50 shadow-[0_0_16px_rgba(99,102,241,0.3)]" />
              </div>
              {/* Countdown overlay */}
              {countdown > 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-5xl font-black text-white">{countdown}</span>
                </div>
              )}
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Webcam capture button */}
          {!useUpload && !captured && (
            <button
              onClick={startCountdown}
              disabled={!cameraReady || countdown > 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" />
              {countdown > 0 ? `Capturing in ${countdown}…` : 'Capture Photo'}
            </button>
          )}

          {/* File upload */}
          {useUpload && !captured && (
            <label className="block w-full aspect-[4/3] rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-indigo-400">
              <Upload className="w-10 h-10" />
              <p className="text-sm font-semibold">Click to upload student photo</p>
              <p className="text-xs text-slate-600">JPG, PNG — clear frontal face</p>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          )}

          {/* Preview + confirm */}
          {captured && (
            <>
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={captured} alt="Face capture" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-emerald-900/80 px-2 py-1 rounded-full text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Ready
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-rose-950/50 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setCaptured('')}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Retake
                </button>
                <button
                  onClick={handleEnroll}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-1.5">
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  {submitting ? 'Enrolling…' : 'Confirm & Enroll'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Admin Enrollment Page ─────────────────────────────────────
export default function AdminEnrollmentPage() {
  const [students, setStudents]         = useState<Student[]>([]);
  const [filter, setFilter]             = useState<FilterTab>('ALL');
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [enrollTarget, setEnrollTarget] = useState<Student | null>(null);
  const [resetting, setResetting]       = useState<string | null>(null);
  const [toast, setToast]               = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getStudents();
      setStudents(data as Student[]);
    } catch (e: any) {
      showToast('error', e.message ?? 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReset = async (studentId: string, name: string) => {
    if (!confirm(`Clear face enrollment for ${name}? They must re-enroll before attending class.`)) return;
    setResetting(studentId);
    try {
      await enrollmentApi.resetEnrollment(studentId);
      showToast('success', `Enrollment cleared for ${name}`);
      load();
    } catch (e: any) {
      showToast('error', e.message ?? 'Reset failed');
    } finally {
      setResetting(null);
    }
  };

  // Compute stats
  const enrolledCount = students.filter(s => s.faceEnrolled).length;
  const pendingCount  = students.filter(s => !s.faceEnrolled).length;
  const enrolledPct   = students.length > 0 ? Math.round((enrolledCount / students.length) * 100) : 0;

  // Apply filter + search
  const filtered = students.filter(s => {
    const matchSearch = !search ||
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'ALL'      ? true :
      filter === 'ENROLLED' ? s.faceEnrolled :
      !s.faceEnrolled;
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      <div className="fixed top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold
          ${toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/90 border-rose-500/40 text-rose-300'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Enroll modal */}
      {enrollTarget && (
        <CaptureModal
          student={enrollTarget}
          onClose={() => setEnrollTarget(null)}
          onSuccess={() => {
            setEnrollTarget(null);
            showToast('success', `${enrollTarget.fullName} enrolled successfully!`);
            load();
          }}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-100">Face Enrollment</h1>
              <p className="text-slate-500 text-sm">Register student biometrics for QR attendance</p>
            </div>
          </div>
          <button onClick={load} className="p-2.5 hover:bg-slate-800 rounded-xl transition-all cursor-pointer">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </header>

        {/* Stats + Progress */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xl font-black">{students.length}</p>
              <p className="text-xs text-slate-500">Total Students</p>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xl font-black text-emerald-400">{enrolledCount}</p>
              <p className="text-xs text-slate-500">Enrolled</p>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-xl font-black text-amber-400">{pendingCount}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Enrollment Progress
            </div>
            <span className="font-black text-indigo-400">{enrolledPct}%</span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${enrolledPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-600 mt-1.5">
            {enrolledCount} of {students.length} students have their face registered
          </p>
        </div>

        {/* Filter tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2">
            {([['ALL', 'All'], ['ENROLLED', 'Enrolled'], ['PENDING', 'Pending']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  filter === key
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or roll number…"
              className="w-full bg-slate-900/60 border border-slate-800 focus:border-indigo-500 focus:outline-none rounded-xl px-4 py-2 pl-9 text-sm text-slate-100" />
          </div>
        </div>

        {/* Student list */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading students…</span>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-slate-600">
                <Users className="w-10 h-10 mx-auto mb-3" />
                <p className="text-sm">No students match the current filter</p>
              </div>
            ) : (
              filtered.map(student => (
                <div key={student.id}
                  className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl hover:border-slate-700 transition-all group">

                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm
                    ${student.faceEnrolled
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border border-slate-700 text-slate-400'}`}>
                    {student.fullName?.[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-200 truncate">{student.fullName}</p>
                    <p className="text-xs text-slate-500">{student.rollNumber} · {student.branchName} {student.yearLabel}</p>
                  </div>

                  {/* Status badge */}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 flex items-center gap-1.5 ${
                    student.faceEnrolled
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                    {student.faceEnrolled
                      ? <><CheckCircle className="w-3 h-3" /> Enrolled</>
                      : <><XCircle className="w-3 h-3" /> Pending</>}
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEnrollTarget(student)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer text-xs shadow-lg shadow-indigo-600/20">
                      <Camera className="w-3.5 h-3.5" />
                      {student.faceEnrolled ? 'Re-enroll' : 'Enroll'}
                    </button>
                    {student.faceEnrolled && (
                      <button
                        onClick={() => handleReset(student.id, student.fullName)}
                        disabled={resetting === student.id}
                        className="p-2 bg-slate-800 hover:bg-rose-950/50 hover:border-rose-500/30 border border-slate-700 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-rose-400">
                        {resetting === student.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <RotateCcw className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
