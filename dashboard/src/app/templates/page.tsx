"use client";

import React from "react";
import { FileText, ShieldCheck, Lock, Globe } from "lucide-react";

export default function TemplatesManager() {
  const fixedTemplate = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

  const boosterTemplate = `https://www.fiestafreshcleaning.com/`;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Post Templates & Auto-Reply Rules
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock className="w-3.5 h-3.5" /> Enforced Templates
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Active auto-reply templates enforced automatically across all 3 Facebook accounts.
          </p>
        </div>
      </div>

      {/* Primary 200% Guarantee Template Card */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              Accounts 1 & 2: 200% Happiness Guarantee Response (50/50 Split)
            </h3>
          </div>
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-3 py-1 rounded-full">
            Active (Ilse & Taylor)
          </span>
        </div>

        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
          {fixedTemplate}
        </div>

        <p className="text-[11px] text-slate-400 font-medium">
          Strictly locked for <b>ilse2taylor@gmail.com</b> and <b>projects.reports.ilse@gmail.com</b> (50/50 round-robin).
        </p>
      </div>

      {/* Account 3 Website Booster Template Card */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              Account 3: Website URL Booster Comment (100% of Approved Posts)
            </h3>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-3 py-1 rounded-full">
            Active (100% Coverage)
          </span>
        </div>

        <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl font-mono text-sm font-bold text-indigo-900 select-all">
          {boosterTemplate}
        </div>

        <p className="text-[11px] text-slate-400 font-medium">
          Comments EXACTLY ONCE on 100% of approved posts, 5 seconds right after Account 1 or 2 comments. Zero text variations.
        </p>
      </div>
    </div>
  );
}
