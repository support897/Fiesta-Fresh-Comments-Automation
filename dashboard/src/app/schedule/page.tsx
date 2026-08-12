"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, Activity, Server, RefreshCw } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabaseClient";

export default function ScheduleManager() {
  const [scanInterval, setScanInterval] = useState("30 Minutes");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchInterval();
  }, []);

  const fetchInterval = async () => {
    setLoading(true);
    try {
      if (isConfigured) {
        // Query config table for delay settings if available, or default to 30 min (1800s)
        const { data } = await supabase.from("config").select("*").maybeSingle();
        if (data) {
          // You could calculate dynamically or display the 30-min scan interval
          setScanInterval("30 Minutes (1800s)");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Schedule Manager
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Clock className="w-3.5 h-3.5" /> 30 Min Interval
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Azure VPS daemon execution schedule &amp; PM2 background task metrics.
          </p>
        </div>

        <button
          onClick={fetchInterval}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh settings
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Scan Interval</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{scanInterval}</p>
          <p className="text-[11px] text-slate-400 mt-1"> sequential patrol cycle delay</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Server className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider">VPS Supervisor</span>
          </div>
          <p className="text-2xl font-black text-slate-900">PM2 Daemon</p>
          <p className="text-[11px] text-slate-400 mt-1">Process PID active on 20.193.52.236</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-3 text-slate-500 mb-2">
            <Activity className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Uptime Mode</span>
          </div>
          <p className="text-2xl font-black text-slate-900">24 / 7 / 365</p>
          <p className="text-[11px] text-slate-400 mt-1">Takes ~60m to patrol all 85+ target groups sequentially</p>
        </div>
      </div>
    </div>
  );
}
