"use client";

import React from "react";
import { FileText, ShieldCheck, Lock } from "lucide-react";

export default function TemplatesManager() {
  const fixedTemplate = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Post Templates & Auto-Reply Rules
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock className="w-3.5 h-3.5" /> Enforced Fixed Reply
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Current active response message posted automatically by the Azure VPS bot.
          </p>
        </div>
      </div>

      {/* Template Card */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">
              200% Happiness Guarantee Response (Fixed Template)
            </h3>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-3 py-1 rounded-full">
            Active for Both Accounts (50/50 Split)
          </span>
        </div>

        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
          {fixedTemplate}
        </div>

        <p className="text-[11px] text-slate-400">
          This message is strictly locked for <b>ilse2taylor@gmail.com</b> and <b>projects.reports.ilse@gmail.com</b> to guarantee zero variations.
        </p>
      </div>
    </div>
  );
}
