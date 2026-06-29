'use client';

import React, { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Play, Square, Users, Clock, QrCode, Radio,
  MonitorPlay, ArrowLeft, Loader2, CheckCircle,
  ShieldCheck, AlertTriangle
} from 'lucide-react';
import canvasConfetti from 'canvas-confetti';
import { teacherApi, getApiBase, getToken } from '../../../utils/api';

// ── SockJS / Stomp are imported dynamically to avoid SSR issues ────
// We use the CDN-compatible import pattern with Next.js

interface AttendanceEntry {
  studentId: string;
  name: string;
  rollNumber: string;
  markedAt: string;
}

interface QrPayload {
  type: 'QR_ROTATE';
  token: string;
  sessionId: string;
  ttl: number;
}

interface SessionEndedPayload {
  type: 'SESSION_ENDED';
  sessionId: string;
  absentCount: number;
  presentCount: number;
}

interface AttendanceMarkedPayload {
  type: 'ATTENDANCE_MARKED';
  studentId: string;
  name: string;
  rollNumber: string;
  markedAt: string;
}

// ── Main Projector Component ───────────────────────────────────────
function ProjectorInner() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const sessionId   = searchParams.get('sessionId');

  // QR State
  const [qrToken, setQrToken]       = useState<string>('');
  const [timeLeft, setTimeLeft]      = useState<number>(60);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endingSummary, setEndingSummary] = useState<{ absentCount: number; presentCount: number } | null>(null);

  // Attendance feed
  const [feed, setFeed]             = useState<AttendanceEntry[]>([]);
  const feedRef                     = useRef<HTMLDivElement>(null);

  // Session header info
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // WebSocket & Timer refs
  const stompClientRef              = useRef<any>(null);
  const timerRef                    = useRef<NodeJS.Timeout | null>(null);
  const fallbackPollRef             = useRef<NodeJS.Timeout | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // ── Load session info on mount ────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    teacherApi.getSessions().then(sessions => {
      const s = sessions.find((s: any) => s.id === sessionId);
      setSessionInfo(s ?? null);
      setLoadingInfo(false);
    }).catch(() => setLoadingInfo(false));

    // Load existing feed (students who already scanned)
    teacherApi.getFeed(sessionId).then(data => setFeed(data)).catch(() => {});
  }, [sessionId]);

  // ── Countdown timer for QR visual ─────────────────────────────
  const startCountdown = useCallback((ttl: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(ttl);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── WebSocket Setup (STOMP over SockJS) ───────────────────────
  useEffect(() => {
    if (!sessionId) return;

    let client: any = null;

    const connectWs = async () => {
      // Dynamic import to avoid Next.js SSR errors
      const SockJS = (await import('sockjs-client')).default;
      const { Client } = await import('@stomp/stompjs');

      const headers: Record<string, string> = {};
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      client = new Client({
        webSocketFactory: () => new SockJS(`${getApiBase()}/ws`),
        connectHeaders: headers,
        debug: () => {}, // Suppress verbose logs
        onConnect: () => {
          setWsConnected(true);
          clearInterval(fallbackPollRef.current!);

          // Subscribe: QR rotation events
          client.subscribe(`/topic/session/${sessionId}/qr`, (msg: any) => {
            const payload: QrPayload = JSON.parse(msg.body);
            if (payload.type === 'QR_ROTATE') {
              setQrToken(payload.token);
              startCountdown(payload.ttl);
            }
          });

          // Subscribe: Session ended event
          client.subscribe(`/topic/session/${sessionId}`, (msg: any) => {
            const payload: SessionEndedPayload = JSON.parse(msg.body);
            if (payload.type === 'SESSION_ENDED') {
              setSessionEnded(true);
              setEndingSummary({ absentCount: payload.absentCount, presentCount: payload.presentCount });
              if (timerRef.current) clearInterval(timerRef.current);
            }
          });

          // Subscribe: New attendance entry
          client.subscribe(`/topic/session/${sessionId}/feed`, (msg: any) => {
            const payload: AttendanceMarkedPayload = JSON.parse(msg.body);
            if (payload.type === 'ATTENDANCE_MARKED') {
              setFeed(prev => {
                if (prev.some(e => e.studentId === payload.studentId)) return prev;
                canvasConfetti({ particleCount: 30, spread: 40, origin: { x: 0.85, y: 0.5 } });
                return [{ ...payload }, ...prev];
              });
            }
          });

          stompClientRef.current = client;
          console.log('✅ WebSocket connected to session:', sessionId);
        },
        onStompError: (frame: any) => {
          console.error('STOMP error', frame);
        },
        onWebSocketError: (event: any) => {
          console.warn('WebSocket disconnected, falling back to polling:', event);
          setWsConnected(false);
          startFallbackPolling();
        }
      });
      
      client.activate();
    };

    connectWs().catch(err => {
      console.error('WebSocket setup failed:', err);
      startFallbackPolling();
    });

    return () => {
      if (client?.active) client.deactivate();
      if (timerRef.current) clearInterval(timerRef.current);
      if (fallbackPollRef.current) clearInterval(fallbackPollRef.current);
    };
  }, [sessionId, startCountdown]);

  // ── Fallback: HTTP polling every 10s if WebSocket fails ───────
  const startFallbackPolling = useCallback(() => {
    if (!sessionId || fallbackPollRef.current) return;
    fallbackPollRef.current = setInterval(async () => {
      try {
        const data = await teacherApi.getQrToken(sessionId);
        setQrToken(data.token);
        startCountdown(data.ttl);
        const feedData = await teacherApi.getFeed(sessionId);
        setFeed(feedData);
      } catch { /* session probably ended */ }
    }, 10_000);
  }, [sessionId, startCountdown]);

  // ── End Session ───────────────────────────────────────────────
  const handleEndSession = useCallback(async () => {
    if (!sessionId || sessionEnded) return;
    if (!confirm('End session? All absent students will be auto-marked.')) return;
    try {
      const result = await teacherApi.endSession(sessionId);
      setSessionEnded(true);
      setEndingSummary({ absentCount: result.absentCount, presentCount: feed.length });
      if (timerRef.current) clearInterval(timerRef.current);
      if (stompClientRef.current?.active) stompClientRef.current.deactivate();
    } catch (e: any) {
      alert('Error ending session: ' + e.message);
    }
  }, [sessionId, sessionEnded, feed.length]);

  // ── QR URL for display ────────────────────────────────────────
  const qrDataPayload = qrToken
    ? encodeURIComponent(JSON.stringify({ sessionId, token: qrToken }))
    : '';
  const qrImageUrl = qrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${qrDataPayload}&bgcolor=ffffff&color=0f172a&qzone=2`
    : '';

  // ── Session Ended Screen ──────────────────────────────────────
  if (sessionEnded && endingSummary) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black text-slate-100 mb-2">Session Complete!</h2>
          <p className="text-slate-500 mb-8">Attendance has been finalized and saved to Supabase.</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
              <p className="text-4xl font-black text-emerald-400">{endingSummary.presentCount}</p>
              <p className="text-emerald-600 text-sm mt-1">Present</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6">
              <p className="text-4xl font-black text-rose-400">{endingSummary.absentCount}</p>
              <p className="text-rose-600 text-sm mt-1">Auto-Absent</p>
            </div>
          </div>
          <button onClick={() => router.push('/teacher')}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-xl transition-all cursor-pointer">
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  // ── Main Projector Screen ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Subtle BG glows */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/teacher')}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex items-center gap-3">
            <MonitorPlay className="w-6 h-6 text-indigo-400" />
            <div>
              {loadingInfo ? (
                <div className="h-5 w-40 bg-slate-800 rounded animate-pulse" />
              ) : (
                <h1 className="font-black text-slate-100 text-lg">
                  {sessionInfo?.title ?? 'Class Session'}
                </h1>
              )}
              <p className="text-xs text-slate-500">
                {sessionInfo?.subjectName} · {sessionInfo?.branchName} {sessionInfo?.yearLabel}
                {sessionInfo?.room && ` · ${sessionInfo.room}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* WS connection indicator */}
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {wsConnected ? 'WebSocket Live' : 'Polling Fallback'}
          </div>

          {/* Present count pill */}
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="font-black text-indigo-300">{feed.length}</span>
            <span className="text-indigo-500 text-xs">Present</span>
          </div>

          {/* End Session button */}
          <button
            onClick={handleEndSession}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 font-bold rounded-xl transition-all cursor-pointer text-sm shadow-lg shadow-rose-600/20">
            <Square className="w-4 h-4" /> End Session
          </button>
        </div>
      </header>

      {/* ── Main Split Layout ── */}
      <main className="flex-1 grid grid-cols-12 gap-0">

        {/* Left: QR Code Display ─────────────────────────────────── */}
        <section className="col-span-7 flex flex-col items-center justify-center p-12 border-r border-slate-800/60">
          {!qrToken ? (
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-500 text-sm">Waiting for first QR token from server…</p>
              <p className="text-slate-700 text-xs mt-2">The scheduler broadcasts every 60 seconds</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8">
              {/* QR Frame */}
              <div className="relative">
                {/* Glow ring */}
                <div className="absolute -inset-4 bg-indigo-500/10 rounded-3xl blur-xl" />

                <div className="relative bg-white p-5 rounded-3xl shadow-2xl shadow-indigo-500/20 ring-1 ring-indigo-500/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={qrToken}  // Force re-render on token change (prevents cached image)
                    src={qrImageUrl}
                    alt="Attendance QR Code"
                    className="w-80 h-80 object-contain"
                  />
                </div>

                {/* Timer badge */}
                <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full font-black text-sm flex items-center gap-2 shadow-xl border
                  ${timeLeft <= 3
                    ? 'bg-rose-900/80 border-rose-500/40 text-rose-300'
                    : 'bg-slate-900/90 border-indigo-500/30 text-indigo-300'}`}>
                  <Clock className={`w-4 h-4 ${timeLeft <= 3 ? 'text-rose-400' : 'text-indigo-400'}`} />
                  Refreshes in {timeLeft}s
                </div>
              </div>

              {/* Info text */}
              <div className="text-center max-w-sm mt-4">
                <div className="flex items-center justify-center gap-2 text-indigo-300 font-bold mb-2">
                  <Radio className="w-4 h-4 animate-pulse" />
                  Time-Sensitive QR Code Active
                </div>
                <p className="text-slate-500 text-sm">
                  Token rotates every 60 seconds via Upstash Redis.
                  Photo replays are automatically rejected.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Right: Live Attendance Feed ───────────────────────────── */}
        <section className="col-span-5 flex flex-col">
          <div className="px-6 py-5 border-b border-slate-800/60 flex items-center justify-between">
            <h2 className="font-bold text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Live Attendance Feed
            </h2>
            <span className="text-xs text-slate-600">Updates via WebSocket</span>
          </div>

          <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-2">
            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 text-slate-700">
                <QrCode className="w-10 h-10 mb-3" />
                <p className="text-sm font-semibold">Waiting for students to scan…</p>
                <p className="text-xs mt-1 text-slate-800">Show the QR code to your class</p>
              </div>
            ) : (
              feed.map((entry, i) => (
                <div
                  key={entry.studentId}
                  className="flex items-center gap-3 p-3.5 bg-slate-900/60 border border-slate-800/60 rounded-xl hover:border-emerald-500/20 transition-all"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 font-black text-emerald-400 text-sm">
                    {entry.name?.[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-200 text-sm truncate">{entry.name}</p>
                    <p className="text-xs text-slate-600">{entry.rollNumber}</p>
                  </div>

                  {/* Badge + time */}
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </span>
                    <p className="text-[10px] text-slate-700 mt-1">
                      {new Date(entry.markedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer stats */}
          {feed.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-800/60 bg-slate-900/30">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{feed.length} student{feed.length !== 1 ? 's' : ''} present</span>
                <span className="flex items-center gap-1 text-emerald-500">
                  <ShieldCheck className="w-3 h-3" /> Face + QR verified
                </span>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Export with Suspense (required for useSearchParams in Next.js) ─
export default function TeacherProjectorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <ProjectorInner />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
