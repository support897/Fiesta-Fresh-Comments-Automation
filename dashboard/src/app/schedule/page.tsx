"use client";

import React from "react";
import { Calendar, Clock, Activity, Cpu, Server } from "lucide-react";

export default function ScheduleManager() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Schedule Manager
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Clock className="w-3.5 h-3.5" /> 60s Interval Ticker
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Azure VPS daemon execution schedule & PM2 background task metrics.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold uppercase">Scan Interval</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">60 Seconds</p>
          <p className="text-[11px] text-slate-400 mt-1">Continuous group patrol frequency</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Server className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold uppercase">VPS Supervisor</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">PM2 Daemon</p>
          <p className="text-[11px] text-slate-400 mt-1">Process PID active on 20.193.52.236</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold uppercase">Uptime Mode</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">24 / 7 / 365</p>
          <p className="text-[11px] text-slate-400 mt-1">Xvfb Headed Chrome Environment</p>
        </div>
      </div>
    </div>
  );
}
