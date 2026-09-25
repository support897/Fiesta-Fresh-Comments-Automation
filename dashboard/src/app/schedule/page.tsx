"use client";

import React, { useState, useEffect } from "react";
import { Calendar, Clock, Activity, Server, RefreshCw } from "lucide-react";
import { supabase, isConfigured } from "@/lib/supabaseClient";

type ScheduleRow = {
  name: string;
  what: string;
  where: string;
  when: string;
  icon: React.ReactNode;
  color: string;
};

const SCHEDULES: ScheduleRow[] = [
  {
    name: "Draft Patrol",
    what: "Scans Facebook groups, classifies posts, stores comment drafts. Never posts.",
    where: "Muse's VM (not the VPS)",
    when: "Every 3 hours",
    icon: <Activity className="w-4 h-4 text-blue-600" />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    name: "Queue Poster",
    what: "Posts approved drafts: Account 3 drops the site link first, then Account 2 posts the comment.",
    where: "VPS · fiesta-bot.service (systemd)",
    when: "Runs continuously when unpaused",
    icon: <Server className="w-4 h-4 text-emerald-600" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    name: "Weekly Report",
    what: "Emails a summary of drafts found, comments posted, and failures.",
    where: "Muse's VM",
    when: "Wednesdays 8:00am Brisbane",
    icon: <Calendar className="w-4 h-4 text-purple-600" />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

export default function ScheduleManager() {
  const [botActive, setBotActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      if (isConfigured) {
        const { data } = await supabase.from("config").select("bot_status").maybeSingle();
        if (data) setBotActive(!!data.bot_status);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Schedule Manager
            </h1>
            {botActive !== null && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${botActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                <Clock className="w-3.5 h-3.5" /> {botActive ? "Posting ON" : "Posting PAUSED"}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500">
            What runs, where it runs, and how often. Times in Australia/Brisbane.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh status
        </button>
      </div>

      {/* Schedule Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SCHEDULES.map((s) => (
          <div key={s.name} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-3 text-slate-500 mb-2">
              {s.icon}
              <span className="text-xs font-bold uppercase tracking-wider">{s.name}</span>
            </div>
            <p className="text-lg font-black text-slate-900">{s.when}</p>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{s.what}</p>
            <p className={`text-[11px] font-bold mt-3 inline-block px-2.5 py-1 rounded-lg border ${s.color}`}>
              {s.where}
            </p>
          </div>
        ))}
      </div>

      {/* Quiet hours note */}
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
        <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Quiet hours
        </h3>
        <p className="text-xs text-amber-800 leading-relaxed">
          The poster never posts between 11:00pm and 5:00am Brisbane time.
          Drafts older than 24 hours are never posted — they go stale and are skipped.
        </p>
      </div>
    </div>
  );
}
