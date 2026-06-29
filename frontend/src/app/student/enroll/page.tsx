'use client';

/**
 * Student Face Enrollment — /student/enroll
 *
 * Guided 3-step flow:
 *  STEP 1 (CAMERA)     → Webcam preview with face detection guide overlay
 *  STEP 2 (CAPTURE)    → Countdown → capture best frame → preview
 *  STEP 3 (SUBMITTING) → Sends base64 to /api/student/enroll-face → FaceNet embeds
 *  STEP 4 (SUCCESS)    → Enrollment confirmed, redirect to scanner
 *  STEP 5 (ERROR)      → Descriptive error with retry
 *
 * Tips shown on-screen guide students to get the best facial capture:
 *  - Adequate lighting
 *  - Direct frontal gaze
 *  - Remove glasses/mask
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera, CheckCircle, AlertCircle, RefreshCw,
  ArrowRight, Loader2, ShieldCheck, ScanLine,
  Sun, Eye, User
} from 'lucide-react';
import { studentApi } from '../../../utils/api';
import canvasConfetti from 'canvas-confetti';

type EnrollStep = 'CAMERA' | 'COUNTDOWN' | 'PREVIEW' | 'SUBMITTING' | 'SUCCESS' | 'ERROR';

const TIPS = [
  { icon: <Sun className="w-4 h-4 text-amber-400" />,  text: 'Face a light source — avoid backlight' },
  { icon: <Eye className="w-4 h-4 text-indigo-400" />,  text: 'Look directly at the camera lens' },
  { icon: <User className="w-4 h-4 text-violet-400" />, text: 'Remove glasses, masks, or hats' },
];

export default function StudentEnrollPage() {
  const router = useRouter();

  // Refs
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  // State
  const [step, setStep]             = useState<EnrollStep>('CAMERA');
  const [capturedImage, setCaptured] = useState<string>('');
  const [countdown, setCountdown]   = useState(3);
  const [error, setError]           = useState('');
  const [cameraReady, setReady]     = useState(false);
  const [enrolledAt, setEnrolledAt] = useState('');

  // ── Camera lifecycle ─────────────────────────────────────────
  const startCamera = useCallback(async () => {
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
      setError('Camera access denied. Please allow camera access and refresh the page.');
      setStep('ERROR');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // ── Capture via countdown ────────────────────────────────────
  const startCapture = useCallback(() => {
    setStep('COUNTDOWN');
    setCountdown(3);

    let count = 3;
    const tick = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(tick);
        capture();
      }
    }, 1000);
  }, []); // eslint-disable-line

  const capture = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror to match what user sees
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCaptured(dataUrl);
    setStep('PREVIEW');
  }, []);

  // ── Submit to backend ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!capturedImage) return;
    setStep('SUBMITTING');
    stopCamera();

    try {
      const result = await studentApi.selfEnrollFace(capturedImage);
      if (result.status === 'SUCCESS') {
        setEnrolledAt(result.enrolledAt ?? new Date().toISOString());
        setStep('SUCCESS');
        canvasConfetti({ particleCount: 180, spread: 80, origin: { y: 0.45 } });
      } else {
        setError(result.message ?? 'Enrollment failed.');
        setStep('ERROR');
      }
    } catch (e: any) {
      setError(e.message ?? 'Server error. Please try again.');
      setStep('ERROR');
    }
  }, [capturedImage, stopCamera]);

  // ── Retry ─────────────────────────────────────────────────────
  const retry = useCallback(() => {
    setCaptured('');
    setError('');
    setStep('CAMERA');
    startCamera();
  }, [startCamera]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* BG glows */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-600/8 rounded-full blur-3xl pointer-events-none" />

      <canvas ref={canvasRef} className="hidden" />

      <div className="w-full max-w-md z-10">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-600/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-100">Face Enrollment</h1>
          <p className="text-slate-500 text-sm mt-1">Register your face once to enable QR attendance</p>
        </div>

        {/* Tips (always shown in CAMERA step) */}
        {step === 'CAMERA' && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {TIPS.map((tip, i) => (
              <div key={i} className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-3 text-center">
                <div className="flex justify-center mb-1.5">{tip.icon}</div>
                <p className="text-slate-400 text-[10px] leading-snug">{tip.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden">

          {/* ── CAMERA / COUNTDOWN ─────────────────────────────── */}
          {(step === 'CAMERA' || step === 'COUNTDOWN') && (
            <div className="flex flex-col items-center p-6 gap-5">
              {/* Camera view with oval guide */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {/* Face position oval overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-52 rounded-full border-2 border-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.3)]" />
                </div>

                {/* Countdown overlay */}
                {step === 'COUNTDOWN' && (
                  <div className="absolute inset-0 bg-slate-950/60 flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full bg-indigo-600/30 border-4 border-indigo-400 flex items-center justify-center">
                      <span className="text-4xl font-black text-white">{countdown}</span>
                    </div>
                    <p className="text-slate-300 font-bold text-sm">Hold still…</p>
                  </div>
                )}

                {/* Camera not ready */}
                {!cameraReady && step !== 'COUNTDOWN' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  </div>
                )}

                {/* Corner decorations */}
                <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-indigo-400/50 rounded-tl-md" />
                <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-indigo-400/50 rounded-tr-md" />
                <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-indigo-400/50 rounded-bl-md" />
                <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-indigo-400/50 rounded-br-md" />
              </div>

              <p className="text-slate-500 text-xs text-center">
                Align your face inside the oval frame, then tap Capture
              </p>

              <button
                onClick={startCapture}
                disabled={!cameraReady || step === 'COUNTDOWN'}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 font-bold rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 text-sm">
                <Camera className="w-5 h-5" />
                {step === 'COUNTDOWN' ? `Capturing in ${countdown}…` : 'Capture Photo'}
              </button>
            </div>
          )}

          {/* ── PREVIEW ────────────────────────────────────────── */}
          {step === 'PREVIEW' && (
            <div className="flex flex-col items-center p-6 gap-5">
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-slate-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-slate-950/80 px-2 py-1 rounded-full text-xs text-indigo-300 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Captured
                </div>
              </div>

              <p className="text-slate-400 text-sm text-center">
                Is your face clearly visible, well-lit, and front-facing?
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={retry}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 font-bold rounded-2xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Retake
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold rounded-2xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
                  <ArrowRight className="w-4 h-4" /> Use This Photo
                </button>
              </div>
            </div>
          )}

          {/* ── SUBMITTING ─────────────────────────────────────── */}
          {step === 'SUBMITTING' && (
            <div className="flex flex-col items-center p-10 gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                  <RefreshCw className="w-9 h-9 text-indigo-400 animate-spin" />
                </div>
                <div className="absolute -inset-2 rounded-full border border-indigo-500/10 animate-ping" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-slate-200">Extracting face features…</h3>
                <p className="text-slate-500 text-xs mt-1.5">FaceNet is generating your 512-dim embedding</p>
              </div>
              <div className="w-full space-y-2 mt-2">
                {['Detecting face landmarks', 'Computing embedding vector', 'Saving to Supabase'].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-500">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SUCCESS ────────────────────────────────────────── */}
          {step === 'SUCCESS' && (
            <div className="flex flex-col items-center p-8 gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black text-emerald-400">Enrollment Complete!</h2>
                <p className="text-slate-500 text-sm mt-2">Your face is now registered in the system</p>
                {enrolledAt && (
                  <p className="text-slate-600 text-xs mt-1">
                    Enrolled at {new Date(enrolledAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="w-full bg-slate-950/50 border border-slate-800/60 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300">Face embedding stored (512 dimensions)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300">Biometric verification enabled</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <ScanLine className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <span className="text-slate-300">Ready to scan QR codes in class</span>
                </div>
              </div>

              <button
                onClick={() => router.push('/student/scanner')}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 font-bold rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
                <ScanLine className="w-5 h-5" /> Go to QR Scanner
              </button>
            </div>
          )}

          {/* ── ERROR ──────────────────────────────────────────── */}
          {step === 'ERROR' && (
            <div className="flex flex-col items-center p-8 gap-5">
              <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-rose-400" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black text-rose-400">Enrollment Failed</h2>
                <p className="text-slate-400 text-sm mt-2 max-w-xs leading-relaxed">{error}</p>
              </div>
              <button
                onClick={retry}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
