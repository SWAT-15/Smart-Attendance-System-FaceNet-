'use client';

/**
 * Student Attendance Scanner — Phase 5
 *
 * Flow:
 *  STEP 1 (SCAN_QR)   → Camera open, jsQR decodes QR every frame → extracts {sessionId, token}
 *  STEP 2 (LIVENESS)  → TF.js MediaPipe FaceMesh runs challenge (BLINK / TURN_LEFT / TURN_RIGHT)
 *  STEP 3 (SUBMITTING)→ Captures face frame as base64 JPEG → POST to /api/student/attendance/submit
 *  STEP 4 (SUCCESS)   → Confetti + success screen
 *  STEP 5 (ERROR)     → Descriptive error with retry button
 *
 * Security: All 6 checks run server-side. The client only attests liveness.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ScanLine, Camera, RefreshCw, CheckCircle,
  AlertCircle, Eye, ArrowLeft, ShieldCheck, Loader2
} from 'lucide-react';
import { checkChallenge, LivenessChallenge } from '../../../utils/liveness';
import { studentApi } from '../../../utils/api';
import canvasConfetti from 'canvas-confetti';

// ── Types ──────────────────────────────────────────────────────────
type ScanStep = 'SCAN_QR' | 'LIVENESS' | 'SUBMITTING' | 'SUCCESS' | 'ERROR';

interface QrPayload {
  sessionId: string;
  token: string;
}

interface SuccessResult {
  message: string;
  similarity: string;
  markedAt: string;
}

// ── Challenge config ───────────────────────────────────────────────
const CHALLENGES: LivenessChallenge[] = ['BLINK', 'TURN_LEFT', 'TURN_RIGHT'];
const CHALLENGE_ICONS: Record<LivenessChallenge, string> = {
  BLINK: '👁️',
  TURN_LEFT: '⬅️',
  TURN_RIGHT: '➡️',
  NOD: '↕️',
};
const CHALLENGE_LABELS: Record<LivenessChallenge, string> = {
  BLINK: 'Blink Detection',
  TURN_LEFT: 'Head Turn — Left',
  TURN_RIGHT: 'Head Turn — Right',
  NOD: 'Head Nod',
};

// ── Main Component ─────────────────────────────────────────────────
export default function StudentScannerPage() {
  // Refs
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);   // hidden — for frame capture
  const qrCanvasRef    = useRef<HTMLCanvasElement>(null);   // hidden — for jsQR pixel data
  const streamRef      = useRef<MediaStream | null>(null);
  const detectorRef    = useRef<any>(null);
  const animFrameRef   = useRef<number | null>(null);
  const livenessActive = useRef(true);

  // State
  const [step, setStep]               = useState<ScanStep>('SCAN_QR');
  const [qrData, setQrData]           = useState<QrPayload | null>(null);
  const [challenge, setChallenge]     = useState<LivenessChallenge>('BLINK');
  const [progress, setProgress]       = useState(0);
  const [instruction, setInstruction] = useState('Point your camera at the QR code on the projector');
  const [modelLoading, setModelLoading] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);  // triggers detect loop
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState<SuccessResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [qrScanning, setQrScanning]   = useState(false);

  // ── Camera Access ──────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;
      // Attach to whatever video element is currently mounted (if any).
      // handleVideoRef will also attach it when a video element mounts.
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
      setCameraReady(true);
    } catch {
      setError('Camera access denied. Please allow camera access and refresh.');
      setStep('ERROR');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);



  // ── Callback ref: fires synchronously when any <video> element mounts ──
  // React unmounts the QR <video> and mounts a new LIVENESS <video> when
  // step changes. A callback ref runs immediately on mount (before effects),
  // so we can attach the stream right away — no timing issues.
  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(console.error);
    }
  }, []);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [startCamera, stopCamera]);

  // ── jsQR Scanner Loop ─────────────────────────────────────────
  // Runs continuously on SCAN_QR step, decodes QR from video frames
  useEffect(() => {
    if (step !== 'SCAN_QR' || !cameraReady) return;

    let active = true;
    setQrScanning(true);

    const scanFrame = async () => {
      if (!active) return;

      const video  = videoRef.current;
      const canvas = qrCanvasRef.current;
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { animFrameRef.current = requestAnimationFrame(scanFrame); return; }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      try {
        // Dynamic import to avoid SSR issues
        const jsQR = (await import('jsqr')).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code?.data) {
          // Try to parse the QR payload
          try {
            const payload: QrPayload = JSON.parse(code.data);
            if (payload.sessionId && payload.token) {
              active = false;
              setQrScanning(false);
              setQrData(payload);
              // Pick a random liveness challenge
              const picked = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
              setChallenge(picked);
              setStep('LIVENESS');
              return;
            }
          } catch {
            // Not valid JSON — ignore and keep scanning
          }
        }
      } catch { /* jsQR not yet loaded */ }

      if (active) animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
    return () => {
      active = false;
      setQrScanning(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [step, cameraReady]);

  // ── Load TF.js FaceMesh Model ─────────────────────────────────
  useEffect(() => {
    if (step !== 'LIVENESS') return;

    let cancelled = false;
    setModelLoading(true);
    setInstruction('Loading AI liveness model…');

    const loadModel = async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
        await tf.ready();
        console.log('[Liveness] TF.js backend:', tf.getBackend());

        const faceLandmarksDetection = await import('@tensorflow-models/face-landmarks-detection');
        const detector = await faceLandmarksDetection.createDetector(
          faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
          {
            runtime: 'tfjs' as const,
            refineLandmarks: true,
          }
        );
        console.log('[Liveness] Model loaded successfully');

        if (!cancelled) {
          detectorRef.current = detector;
          setDetectorReady(true);
          setModelLoading(false);
          setInstruction(`${CHALLENGE_ICONS[challenge]} ${CHALLENGE_LABELS[challenge]}`);
        }
      } catch (e) {
        console.error('[Liveness] Model load failed:', e);
        if (!cancelled) {
          setError(`Failed to load liveness model: ${e instanceof Error ? e.message : 'unknown error'}`);
          setStep('ERROR');
        }
      }
    };

    loadModel();
    return () => { cancelled = true; };
  }, [step, challenge]);

  // ── Liveness Detection Loop (estimateFaces polling) ───────────
  useEffect(() => {
    if (step !== 'LIVENESS' || !detectorRef.current || modelLoading || !detectorReady) return;

    livenessActive.current = true;
    let debounce: NodeJS.Timeout;
    let missedFrames = 0;      // consecutive frames with no face
    const MISS_TOLERANCE = 15; // show "not detected" only after this many misses
    let canvasSized = false;

    // Reusable offscreen canvas — dimensions set ONCE to avoid clearing
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    const detect = async () => {
      if (!livenessActive.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA || !offCtx) {
        debounce = setTimeout(detect, 200);
        return;
      }

      try {
        // Set canvas dimensions only once (resizing clears canvas & disrupts WebGL)
        if (!canvasSized || offCanvas.width !== video.videoWidth || offCanvas.height !== video.videoHeight) {
          offCanvas.width = video.videoWidth;
          offCanvas.height = video.videoHeight;
          canvasSized = true;
        }

        offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
        const faces = await detectorRef.current.estimateFaces(offCanvas);

        if (faces && faces.length > 0) {
          missedFrames = 0;
          const keypoints = faces[0].keypoints;
          const result = checkChallenge(keypoints, challenge);

          setProgress(result.progress);
          setInstruction(result.instruction);

          if (result.passed) {
            livenessActive.current = false;
            setProgress(100);
            setInstruction('✅ Liveness verified! Capturing face…');
            setStep('SUBMITTING');
            captureAndSubmit();
            return;
          }
        } else {
          missedFrames++;
          // Only show "not detected" after many consecutive misses
          if (missedFrames >= MISS_TOLERANCE) {
            setInstruction('👤 Face not detected — look straight at camera');
          }
          // Otherwise keep previous instruction/progress (face is just intermittently lost)
        }
      } catch (e) {
        console.error('[Liveness] Detection error:', e);
      }

      if (livenessActive.current) {
        debounce = setTimeout(detect, 200);  // ~5 fps — gives WebGL time per frame
      }
    };

    detect();
    return () => {
      livenessActive.current = false;
      clearTimeout(debounce);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, modelLoading, challenge, detectorReady]);

  // ── Face Capture + API Submit ──────────────────────────────────
  const captureAndSubmit = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !qrData) return;

    // Capture the current video frame as base64 JPEG
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const imageFrame = canvas.toDataURL('image/jpeg', 0.9);

    try {
      const result = await studentApi.submitAttendance({
        sessionId:     qrData.sessionId,
        qrToken:       qrData.token,
        imageFrame,
        livenessPassed: true,
        deviceInfo:    navigator.userAgent,
      });

      if (result.status === 'SUCCESS') {
        stopCamera();
        setSuccess({
          message:    result.message,
          similarity: result.similarity ?? '—',
          markedAt:   result.markedAt ?? new Date().toISOString(),
        });
        setStep('SUCCESS');
        canvasConfetti({ particleCount: 200, spread: 90, origin: { y: 0.5 } });
      } else {
        setError(result.message ?? 'Attendance marking failed.');
        setStep('ERROR');
      }
    } catch (e: any) {
      setError(e.message ?? 'Server error. Please try again.');
      setStep('ERROR');
    }
  }, [qrData, stopCamera]);

  // ── Reset ─────────────────────────────────────────────────────
  const handleRetry = () => {
    setStep('SCAN_QR');
    setQrData(null);
    setProgress(0);
    setError('');
    setSuccess(null);
    setModelLoading(false);
    setDetectorReady(false);
    livenessActive.current = true;
    detectorRef.current = null;
    startCamera();
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="fixed top-0 left-0 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-cyan-600/8 rounded-full blur-3xl pointer-events-none" />

      {/* Hidden canvases */}
      <canvas ref={canvasRef}    className="hidden" />
      <canvas ref={qrCanvasRef}  className="hidden" />

      {/* Card */}
      <div className="w-full max-w-sm bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl overflow-hidden relative z-10">

        {/* Header */}
        <div className="px-6 pt-8 pb-0 text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
            Smart Attendance
          </h1>
          <p className="text-slate-500 text-xs mt-1 mb-6">
            {step === 'SCAN_QR'   && 'Step 1 of 2 — Scan QR Code'}
            {step === 'LIVENESS'  && 'Step 2 of 2 — Liveness Check'}
            {step === 'SUBMITTING'&& 'Verifying identity…'}
            {step === 'SUCCESS'   && 'Attendance Confirmed!'}
            {step === 'ERROR'     && 'Verification Failed'}
          </p>
        </div>

        {/* ── STEP 1: QR Scanner ─────────────────────────────── */}
        {step === 'SCAN_QR' && (
          <div className="px-6 pb-8 flex flex-col items-center gap-6">
            {/* Camera viewport */}
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800">
              <video
                ref={handleVideoRef}
                autoPlay playsInline muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {/* Scan overlay corners */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-48 h-48">
                  {/* Corner brackets */}
                  {['top-0 left-0', 'top-0 right-0 rotate-90', 'bottom-0 right-0 rotate-180', 'bottom-0 left-0 -rotate-90'].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-8 h-8`}>
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                    </div>
                  ))}
                  {/* Scan line */}
                  <div className="absolute inset-x-2 top-1/2 h-0.5 bg-indigo-500/80 shadow-[0_0_10px_rgba(99,102,241,0.7)] animate-bounce" />
                </div>
              </div>

              {/* Camera status */}
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                  <div className="flex flex-col items-center gap-2">
                    <Camera className="w-8 h-8 text-slate-600 animate-pulse" />
                    <p className="text-xs text-slate-600">Starting camera…</p>
                  </div>
                </div>
              )}

              {/* Scanning indicator */}
              {cameraReady && qrScanning && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-950/70 px-3 py-1.5 rounded-full">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-indigo-300 font-semibold">Scanning for QR…</span>
                </div>
              )}
            </div>

            <p className="text-slate-500 text-xs text-center">
              Point your camera at the <strong className="text-slate-300">QR code on the projector</strong>. It will be detected automatically.
            </p>
          </div>
        )}

        {/* ── STEP 2: Liveness Check ─────────────────────────── */}
        {step === 'LIVENESS' && (
          <div className="px-6 pb-8 flex flex-col items-center gap-5">
            {/* Circular camera with progress ring */}
            <div className="relative w-56 h-56">
              {/* Progress ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 224 224">
                <circle cx="112" cy="112" r="104" stroke="rgba(99,102,241,0.1)" strokeWidth="8" fill="none" />
                <circle
                  cx="112" cy="112" r="104"
                  stroke={progress >= 100 ? '#10b981' : '#6366f1'}
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={653.12}
                  strokeDashoffset={653.12 - (653.12 * progress) / 100}
                  className="transition-all duration-150"
                />
              </svg>

              {/* Camera circle */}
              <div className="absolute inset-3 rounded-full overflow-hidden border-2 border-slate-800">
                <video
                  ref={handleVideoRef}
                  autoPlay playsInline muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>

              {/* Loading overlay */}
              {modelLoading && (
                <div className="absolute inset-3 rounded-full bg-slate-950/80 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <span className="text-[10px] text-slate-500">Loading AI model…</span>
                </div>
              )}
            </div>

            {/* Challenge label */}
            <div className="text-center space-y-2">
              <span className="text-2xl">{CHALLENGE_ICONS[challenge]}</span>
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full inline-flex">
                <span className="text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  {CHALLENGE_LABELS[challenge]}
                </span>
              </div>
              <p className="text-slate-200 font-bold text-sm">{instruction}</p>
            </div>

            {/* Progress bar */}
            <div className="w-full">
              <div className="flex justify-between text-[10px] text-slate-600 mb-1.5">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Submitting ─────────────────────────────── */}
        {step === 'SUBMITTING' && (
          <div className="px-6 pb-10 flex flex-col items-center gap-5 pt-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                <RefreshCw className="w-9 h-9 text-indigo-400 animate-spin" />
              </div>
              <div className="absolute -inset-2 rounded-full border border-indigo-500/10 animate-ping" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-200">Verifying Identity…</h3>
              <p className="text-slate-500 text-xs mt-1.5">Running FaceNet similarity check</p>
            </div>
            <div className="w-full space-y-2">
              {['QR Token validation', 'Liveness confirmation', 'FaceNet matching'].map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-xs text-slate-500">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4: SUCCESS ────────────────────────────────── */}
        {step === 'SUCCESS' && success && (
          <div className="px-6 pb-8 flex flex-col items-center gap-5 pt-2">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <div className="absolute -inset-1 rounded-full bg-emerald-500/5 animate-ping" />
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-black text-emerald-400">Verified Present!</h2>
              <p className="text-slate-500 text-xs mt-1.5">Your attendance has been recorded</p>
            </div>

            <div className="w-full bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Face similarity</span>
                <span className="font-bold text-emerald-400">{success.similarity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Marked at</span>
                <span className="font-bold text-slate-300 text-xs">
                  {new Date(success.markedAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Present
                </span>
              </div>
            </div>

            <p className="text-slate-600 text-xs text-center">You can safely close this tab.</p>
          </div>
        )}

        {/* ── STEP 5: ERROR ──────────────────────────────────── */}
        {step === 'ERROR' && (
          <div className="px-6 pb-8 flex flex-col items-center gap-5 pt-2">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-rose-400" />
            </div>

            <div className="text-center">
              <h2 className="text-xl font-black text-rose-400">Verification Failed</h2>
              <p className="text-slate-400 text-sm mt-2 max-w-xs">{error}</p>
            </div>

            <button
              onClick={handleRetry}
              className="w-full py-3.5 bg-rose-600/20 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 font-bold rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

      </div>

      {/* Footer note */}
      <p className="text-slate-700 text-[10px] mt-6 text-center max-w-xs">
        Secured by QR token rotation · FaceNet biometric verification · On-device liveness detection
      </p>
    </div>
  );
}

export const dynamic = 'force-dynamic';
