"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, Lock, Globe, AlertTriangle } from "lucide-react";

/**
 * Live per-account templates and posting rules.
 *
 * This page used to hardcode the reply text in the component, which meant the
 * dashboard could show a template the bot was not actually using. The single
 * source of truth is now /opt/fiesta/bot/accounts.config.json on the VPS; the
 * bot publishes the config it has loaded in its heartbeat row, and this page
 * renders that. If the numbers here look wrong, fix the VPS file — not this page.
 */

const HEARTBEAT_KEY = "__heartbeat__";
const HEARTBEAT_STALE_SECONDS = 300;

type AccountRule = {
  label: string;
  email: string;
  role: "main_reply" | "url_drop" | string;
  template: string;
  maxCommentsPerDay: number;
  minMinutesBetweenComments: number;
};

export default function TemplatesManager() {
  const [accounts, setAccounts] = React.useState<AccountRule[] | null>(null);
  const [beatTs, setBeatTs] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("cookies, updated_at")
        .eq("user_email", HEARTBEAT_KEY)
        .maybeSingle();
      if (cancelled) return;
      const beat = Array.isArray(data?.cookies) ? (data!.cookies as any[])[0] : null;
      setAccounts(Array.isArray(beat?.accounts) ? beat.accounts : null);
      setBeatTs(beat?.ts ?? data?.updated_at ?? null);
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const fresh = !!beatTs && (Date.now() - new Date(beatTs).getTime()) / 1000 < HEARTBEAT_STALE_SECONDS;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Comment Templates &amp; Posting Rules
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                fresh
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              {fresh ? "Live from VPS" : "Stale — bot not reporting"}
            </span>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Read straight from what the bot has loaded (<code>accounts.config.json</code> on the VPS).
            {beatTs && ` Last reported ${new Date(beatTs).toLocaleString("en-AU")}.`}
          </p>
        </div>
      </div>

      {loading && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 text-sm text-slate-500">
          Loading the live configuration…
        </div>
      )}

      {!loading && !accounts && (
        <div className="bg-white p-6 rounded-3xl border border-amber-200 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" /> No configuration reported
          </div>
          <p className="text-xs text-slate-600">
            The bot has not published its account rules yet. It publishes them with every heartbeat
            (once a minute), so either the service is down or it is running an older build.
          </p>
        </div>
      )}

      {accounts?.map((a) => {
        const isDrop = a.role === "url_drop";
        return (
          <div key={a.email} className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {isDrop ? <Globe className="w-5 h-5 text-indigo-600" /> : <ShieldCheck className="w-5 h-5 text-blue-600" />}
                <h3 className="text-base font-extrabold text-slate-900">{a.label}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1 rounded-full">
                  {isDrop ? "URL drop" : "Main reply"}
                </span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                  max {a.maxCommentsPerDay}/day
                </span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
                  {a.minMinutesBetweenComments} min gap
                </span>
              </div>
            </div>

            <div
              className={
                isDrop
                  ? "p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl font-mono text-sm font-bold text-indigo-900 select-all"
                  : "p-5 bg-slate-50 border border-slate-200 rounded-2xl font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap"
              }
            >
              {a.template}
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              Posted as <b>{a.email}</b>. Daily cap and minimum gap are enforced on the VPS against
              real (non dry-run) replies from the last 24 hours.
            </p>
          </div>
        );
      })}
    </div>
  );
}
