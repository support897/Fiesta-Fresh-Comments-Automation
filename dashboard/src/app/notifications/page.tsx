"use client";

import React from "react";
import { Bell, CheckCircle2, ShieldCheck, Activity } from "lucide-react";

export default function Notifications() {
  const events = [
    {
      title: "50/50 Multi-Account Rotation Enforced",
      desc: "Equal split active between ilse2taylor@gmail.com and projects.reports.ilse@gmail.com.",
      time: "Just now",
      type: "system",
    },
    {
      title: "Fixed 200% Guarantee Reply Locked",
      desc: "Comment template set to exact fixed response text with zero variations.",
      time: "10 mins ago",
      type: "system",
    },
    {
      title: "Azure VPS Daemon Online",
      desc: "Playwright Headed Chrome running continuously on PM2.",
      time: "1 hour ago",
      type: "vps",
    },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" /> Notifications & Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time audit log of bot events, account rotations, and template enforcements.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 divide-y divide-slate-100">
        {events.map((evt, idx) => (
          <div key={idx} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl mt-0.5">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-900">{evt.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{evt.desc}</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 inline-block">{evt.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
