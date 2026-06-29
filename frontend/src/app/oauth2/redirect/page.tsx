'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';

function OAuth2RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // Save token in both keys for compatibility
      localStorage.setItem('jwt_token', token);
      localStorage.setItem('token', token);

      try {
        // Parse the JWT to redirect based on roles
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
        } else {
          router.replace('/?error=INVALID_TOKEN');
        }
      } catch (e) {
        console.error('Failed to parse JWT payload', e);
        router.replace('/?error=PARSE_FAILED');
      }
    } else {
      router.replace('/?error=TOKEN_MISSING');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative z-10 text-center flex flex-col items-center">
        <div className="w-12 h-12 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl flex justify-center items-center mb-6 shadow-md">
          <ShieldCheck className="w-6 h-6 text-slate-100" />
        </div>
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-200">Verifying session...</h2>
        <p className="text-slate-500 text-xs mt-2">Connecting secure Google authentication credentials to your database.</p>
      </div>
    </div>
  );
}

export default function OAuth2RedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <OAuth2RedirectInner />
    </Suspense>
  );
}
