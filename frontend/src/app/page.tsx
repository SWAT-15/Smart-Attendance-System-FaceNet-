import Link from 'next/link';
import { ShieldAlert, MonitorPlay, ScanLine, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background radial gradients */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-4xl bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-10 shadow-2xl relative z-10 text-center">
        
        {/* Logo and title */}
        <div className="mb-10">
          <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl flex justify-center items-center mx-auto mb-6 shadow-lg shadow-indigo-600/20">
            <ShieldCheck className="w-9 h-9 text-slate-100" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
            Smart Attendance System
          </h1>
          <p className="text-slate-400 text-sm mt-3 max-w-md mx-auto">
            High-integrity verification utilizing time-sensitive dynamic QR codes, active client-side liveness detection, and FaceNet matching.
          </p>
        </div>

        {/* Roles Portals selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          
          {/* Student Scanner Link */}
          <Link 
            href="/student/scanner"
            className="group flex flex-col justify-between items-center p-8 bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/60 hover:border-cyan-500/40 rounded-2xl transition-all duration-300 transform hover:scale-103 shadow-lg shadow-black/30"
          >
            <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex justify-center items-center mb-6 group-hover:bg-cyan-500/20 transition-all">
              <ScanLine className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-200">Student Portal</h3>
              <p className="text-xs text-slate-500 mt-2">Scan projected QR codes and verify with liveness webcam matches.</p>
            </div>
            <span className="mt-6 text-xs text-cyan-400 font-bold tracking-wider group-hover:translate-x-1 transition-all">
              Open Scanner →
            </span>
          </Link>

          {/* Teacher Projector Link */}
          <Link 
            href="/teacher/projector"
            className="group flex flex-col justify-between items-center p-8 bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/60 hover:border-indigo-500/40 rounded-2xl transition-all duration-300 transform hover:scale-103 shadow-lg shadow-black/30"
          >
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex justify-center items-center mb-6 group-hover:bg-indigo-500/20 transition-all">
              <MonitorPlay className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-200">Teacher Portal</h3>
              <p className="text-xs text-slate-500 mt-2">Activate attendance schedules and project dynamic security QR codes.</p>
            </div>
            <span className="mt-6 text-xs text-indigo-400 font-bold tracking-wider group-hover:translate-x-1 transition-all">
              Open Projector →
            </span>
          </Link>

          {/* Admin Dashboard Link */}
          <Link 
            href="/admin"
            className="group flex flex-col justify-between items-center p-8 bg-slate-950/60 hover:bg-slate-950/80 border border-slate-800/60 hover:border-purple-500/40 rounded-2xl transition-all duration-300 transform hover:scale-103 shadow-lg shadow-black/30"
          >
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex justify-center items-center mb-6 group-hover:bg-purple-500/20 transition-all">
              <ShieldAlert className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-200">Admin Console</h3>
              <p className="text-xs text-slate-500 mt-2">Onboard dataset records, configure branch categories, and monitor status logs.</p>
            </div>
            <span className="mt-6 text-xs text-purple-400 font-bold tracking-wider group-hover:translate-x-1 transition-all">
              Open Console →
            </span>
          </Link>

        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-800/60 text-xs text-slate-600 flex justify-between items-center">
          <span>Smart Attendance Engine v1.0.0</span>
          <span>College Domain Integration Mode Active</span>
        </div>

      </div>
    </div>
  );
}
