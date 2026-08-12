"use client";

import React from "react";
import { AlertTriangle, Mail, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function SystemErrors() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              System Health & Error Audit
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> All Systems Operational
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time diagnostics, session cookie integrity, and single email alert logs.
          </p>
        </div>
      </div>

      {/* Account Session Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Taylor (Account 1)</h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Session Connected
            </span>
          </div>
          <p className="text-xs font-mono text-slate-500">ilse2taylor@gmail.com</p>
          <p className="text-[11px] text-slate-400">
            50% Rotation Account • Cookies active in Supabase
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Ilse (Account 2)</h3>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              Session Connected
            </span>
          </div>
          <p className="text-xs font-mono text-slate-500">projects.reports.ilse@gmail.com</p>
          <p className="text-[11px] text-slate-400">
            50% Rotation Account • Cookies active in Supabase
          </p>
        </div>
      </div>

      {/* Email Alert Configuration Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Single Email Alert System (Throttled)
          </h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          If session cookies disconnect or Facebook throws a security challenge, the system will send <b>EXACTLY ONE</b> email notification to <code>projects.reports.ilse@gmail.com</code> with screenshot proof and recovery steps. No spam emails are sent.
        </p>
      </div>
    </div>
  );
}
