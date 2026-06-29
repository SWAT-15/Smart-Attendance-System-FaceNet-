'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, AlertTriangle, ArrowLeft } from 'lucide-react';

function AuthErrorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');

  let title = "Authentication Failed";
  let description = "An unexpected error occurred during Google Sign-In. Please try again.";

  if (errorCode === 'OAUTH_FAILED') {
    title = "Google OAuth Handshake Failed";
    description = "Spring Security was unable to verify your Google identity token. This typically happens if the Client Secret or ID in your configuration is incorrect, or if the redirect URI is not authorized.";
  } else if (errorCode === 'DOMAIN_NOT_ALLOWED') {
    title = "Email Domain Restricted";
    description = "Your Google email domain is not authorized. The system is locked to institutional email domains. Please verify the ALLOWED_EMAIL_DOMAINS setting.";
  } else if (errorCode === 'EMAIL_MISSING') {
    title = "Google Email Missing";
    description = "No email address was returned by Google. Ensure you grant profile and email permissions on sign-in.";
  } else if (errorCode === 'ACCOUNT_DISABLED') {
    title = "Account Suspended";
    description = "Your user account is currently disabled. Please contact your system administrator for assistance.";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-10 shadow-2xl relative z-10 text-center">
        {/* Error Icon */}
        <div className="w-16 h-16 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex justify-center items-center mx-auto mb-6 shadow-lg shadow-rose-600/5">
          <ShieldAlert className="w-9 h-9 text-rose-400" />
        </div>

        {/* Title & Description */}
        <h1 className="text-2xl font-black bg-gradient-to-r from-rose-400 via-pink-300 to-amber-400 bg-clip-text text-transparent tracking-tight">
          {title}
        </h1>
        <p className="text-slate-400 text-xs mt-3 leading-relaxed">
          {description}
        </p>

        {/* Diagnostic Code */}
        {errorCode && (
          <div className="mt-6 px-4 py-2 bg-slate-950/60 border border-slate-850 rounded-xl inline-block text-[10px] text-slate-500 font-mono tracking-wider">
            ERROR CODE: {errorCode}
          </div>
        )}

        {/* Back to Login Button */}
        <div className="mt-8">
          <button
            onClick={() => router.replace('/login')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-slate-200 font-bold rounded-2xl shadow-xl transition-all cursor-pointer text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Login</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 text-rose-400 border-2 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthErrorInner />
    </Suspense>
  );
}
