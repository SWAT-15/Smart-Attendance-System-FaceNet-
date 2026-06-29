'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogIn, AlertCircle } from 'lucide-react';
import { getApiBase, getToken } from '../../utils/api';

export default function LoginPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');

  // If already logged in, redirect away from login page
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const roles: string[] = payload.roles || [];
          if (roles.includes('ROLE_ADMIN')) {
            router.replace('/admin');
          } else if (roles.includes('ROLE_TEACHER')) {
            router.replace('/teacher');
          } else {
            router.replace('/student');
          }
        }
      } catch (e) {
        console.error('Failed to parse active token', e);
      }
    }
  }, [router]);

  const handleGoogleLogin = () => {
    const apiBase = getApiBase();
    // Redirect browser directly to Google OAuth2 endpoint on Spring Boot
    window.location.href = `${apiBase}/oauth2/authorization/google`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-10 shadow-2xl relative z-10 text-center">
        {/* Logo */}
        <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl flex justify-center items-center mx-auto mb-6 shadow-lg shadow-indigo-600/20">
          <ShieldCheck className="w-9 h-9 text-slate-100" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
          Welcome Back
        </h1>
        <p className="text-slate-400 text-xs mt-2 max-w-xs mx-auto">
          Securely sign in to the Attendance System using your Google credentials.
        </p>

        {/* Action Button */}
        <div className="mt-8">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-violet-500/50 text-slate-200 font-bold rounded-2xl shadow-xl hover:shadow-violet-600/5 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer group"
          >
            <LogIn className="w-5 h-5 text-slate-400 group-hover:text-violet-400 transition-colors" />
            <span>Sign in with Google</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-slate-800/60 text-[10px] text-slate-600">
          College Domain Policy Enforcement Active
        </div>
      </div>
    </div>
  );
}
