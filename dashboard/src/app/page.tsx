"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { agoLabel, QueueRow } from "@/lib/queue";
import {
  ClipboardList,
  CheckCheck,
  Hourglass,
  AlertTriangle,
  Users,
  Play,
  Pause,
  RefreshCw,
  ChevronRight,
  Activity,
} from "lucide-react";

/* ── CEO Command Center ──────────────────────────────
   Mobile-first. 4 blocks, top to bottom:
   1. Status strip — is the machine on?
   2. Today tiles — 5 numbers max
   3. Needs attention — what needs me, red first
   4. 7-day trend — are we growing?
   ─────────────────────────────────────────────────── */

const HEARTBEAT_KEY = "__heartbeat__";
const HEARTBEAT_STALE_SECONDS = 300;
const STALE_WARNING_HOURS = 20; // drafts older than this go stale at 24h
const FRESH_HOURS = 24;

type AccountHealth = {
  key: string;
  label: string;
  initial: string;
  ok: boolean | null; // true = logged in, false = failing, null = unknown
  reason: string | null;
};

const ACCOUNTS = [
  { key: "projects.reports.ilse@gmail.com", label: "Projects Reports", initial: "P" },
  { key: "account3",                        label: "Website Booster",  initial: "W" },
];

function brisbaneTodayStart(): Date {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Brisbane" }));
  now.setHours(0, 0, 0, 0);
  return now;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [vpsOnline, setVpsOnline] = useState(false);
  const [vpsLastSeen, setVpsLastSeen] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountHealth[]>([]);
  const [draftsWaiting, setDraftsWaiting] = useState<QueueRow[]>([]);
  const [postedToday, setPostedToday] = useState(0);
  const [staleSoon, setStaleSoon] = useState<QueueRow[]>([]);
  const [trend, setTrend] = useState<{ day: string; drafts: number; posted: number }[]>([]);

  const load = useCallback(async () => {
    try {
      // Config — posting on/off
      const { data: config } = await supabase.from("config").select("id, bot_status").maybeSingle();
      if (config) {
        setIsActive(!!config.bot_status);
        setConfigId(config.id);
      }

      // Queue rows from the last 7 days — one query drives tiles, attention, trend
      const weekAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const { data: rows } = await supabase
        .from("comment_queue")
        .select("*")
        .gte("created_at", weekAgo)
        .order("created_at", { ascending: false })
        .limit(2000);
      const all = (rows ?? []) as QueueRow[];

      const todayStart = brisbaneTodayStart().toISOString();
      const waiting = all.filter((r) => r.status === "draft_ready" && r.account === "acc2");
      setDraftsWaiting(waiting);
      setPostedToday(all.filter((r) => r.status === "posted" && (r.posted_at ?? "") >= todayStart).length);

      const staleCutoff = new Date(Date.now() - STALE_WARNING_HOURS * 3600 * 1000).toISOString();
      setStaleSoon(
        waiting
          .filter((r) => r.created_at < staleCutoff)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
      );

      // 7-day trend buckets (Brisbane days)
      const buckets = new Map<string, { drafts: number; posted: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Australia/Brisbane" }));
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, { drafts: 0, posted: 0 });
      }
      for (const r of all) {
        const key = new Date(r.created_at).toISOString().slice(0, 10);
        const b = buckets.get(key);
        if (b) b.drafts++;
        if (r.status === "posted" && r.posted_at) {
          const pk = new Date(r.posted_at).toISOString().slice(0, 10);
          const pb = buckets.get(pk);
          if (pb) pb.posted++;
        }
      }
      setTrend(
        [...buckets.entries()].map(([day, v]) => ({
          day: new Date(day + "T00:00:00").toLocaleDateString("en-AU", { weekday: "short" }),
          ...v,
        }))
      );

      // VPS heartbeat + account health
      const { data: sessionRows } = await supabase.from("sessions").select("user_email, cookies, updated_at");
      let beacon: any = null;
      for (const row of sessionRows ?? []) {
        if (row.user_email === HEARTBEAT_KEY) {
          const cookies = Array.isArray(row.cookies) ? row.cookies : [];
          beacon = { payload: cookies[0] ?? null, updated_at: row.updated_at };
        }
      }
      const lastSeen = beacon?.payload?.ts ?? beacon?.updated_at ?? null;
      setVpsLastSeen(lastSeen);
      setVpsOnline(!!lastSeen && (Date.now() - new Date(lastSeen).getTime()) / 1000 < HEARTBEAT_STALE_SECONDS);

      const logins = (beacon?.payload?.logins ?? {}) as Record<string, { ok?: boolean; reason?: string }>;
      setAccounts(
        ACCOUNTS.map((a) => {
          const reported = logins[a.key];
          const row = (sessionRows ?? []).find((r: any) => r.user_email === a.key);
          const cookies = Array.isArray(row?.cookies) ? row.cookies : [];
          return {
            ...a,
            ok: typeof reported?.ok === "boolean" ? reported.ok : cookies.length > 0 ? null : false,
            reason: reported?.reason ?? null,
          };
        })
      );
    } catch (e) {
      console.error("load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ceo-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_queue" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "config" }, load)
      .subscribe();
    const iv = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [load]);

  const handleToggle = async () => {
    setTriggering(true);
    const next = !isActive;
    setIsActive(next);
    try {
      if (configId) await supabase.from("config").update({ bot_status: next }).eq("id", configId);
    } catch (e) { console.error(e); }
    finally { setTriggering(false); }
  };

  const healthyCount = accounts.filter((a) => a.ok === true).length;
  const attentionCount = staleSoon.length + accounts.filter((a) => a.ok === false).length;
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.drafts, t.posted)));

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse p-1">
        <div className="h-16 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
        </div>
        <div className="h-40 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* ── 1. STATUS STRIP ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className={cn("w-2.5 h-2.5 rounded-full", vpsOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
            <span className="text-sm font-bold text-slate-800">
              {vpsOnline ? "Machine is on" : "Machine is off"}
            </span>
            <span className="text-[11px] text-slate-400">
              {vpsLastSeen ? agoLabel(vpsLastSeen) : "no signal yet"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {accounts.map((a) => (
              <span
                key={a.key}
                title={`${a.label}: ${a.ok === true ? "logged in" : a.ok === false ? `failing — ${a.reason ?? "unknown"}` : "not verified"}`}
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border",
                  a.ok === true && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  a.ok === false && "bg-red-50 text-red-700 border-red-200",
                  a.ok === null && "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {a.initial}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleToggle}
            disabled={triggering}
            className={cn(
              "flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50",
              isActive
                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
            )}
          >
            {isActive ? <Pause size={16} /> : <Play size={16} className="fill-current" />}
            {triggering ? "UPDATING..." : isActive ? "PAUSE POSTING" : "RESUME POSTING"}
          </button>
          <button
            onClick={load}
            aria-label="Refresh"
            className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {!isActive && (
          <p className="text-[11px] text-red-600 font-semibold mt-2">
            Posting is paused — drafts keep collecting, nothing goes out.
          </p>
        )}
      </div>

      {/* ── 2. TODAY TILES (5 max) ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/queue" className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <ClipboardList size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Drafts waiting</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{draftsWaiting.length}</div>
          <div className="text-[11px] text-blue-600 font-semibold mt-0.5 flex items-center gap-0.5">
            Review <ChevronRight size={12} />
          </div>
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <CheckCheck size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Posted today</span>
          </div>
          <div className="text-3xl font-black text-slate-900">{postedToday}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Brisbane time</div>
        </div>

        <div className={cn("border rounded-2xl p-4 shadow-sm", staleSoon.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200")}>
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Hourglass size={14} className={staleSoon.length > 0 ? "text-amber-600" : ""} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Going stale</span>
          </div>
          <div className={cn("text-3xl font-black", staleSoon.length > 0 ? "text-amber-700" : "text-slate-900")}>
            {staleSoon.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">older than {STALE_WARNING_HOURS}h</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Accounts OK</span>
          </div>
          <div className="text-3xl font-black text-slate-900">
            {healthyCount}<span className="text-lg text-slate-400">/{accounts.length}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Facebook logins</div>
        </div>
      </div>

      {/* ── 3. NEEDS ATTENTION ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className={attentionCount > 0 ? "text-red-500" : "text-emerald-500"} />
          Needs attention
          {attentionCount > 0 && (
            <span className="ml-auto bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full">
              {attentionCount}
            </span>
          )}
        </h2>
        {attentionCount === 0 ? (
          <p className="text-xs text-slate-500 py-2">All clear — nothing needs you right now. 🎉</p>
        ) : (
          <div className="space-y-2">
            {accounts.filter((a) => a.ok === false).map((a) => (
              <Link
                key={a.key}
                href="/cookies"
                className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl active:scale-[0.99] transition-all"
              >
                <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center text-xs font-black shrink-0">
                  {a.initial}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-red-800">{a.label} login failing</p>
                  <p className="text-[11px] text-red-600 truncate">{a.reason ?? "Tap to fix cookies"}</p>
                </div>
                <ChevronRight size={14} className="ml-auto text-red-400 shrink-0" />
              </Link>
            ))}
            {staleSoon.slice(0, 5).map((d) => (
              <Link
                key={d.id}
                href="/queue"
                className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl active:scale-[0.99] transition-all"
              >
                <Hourglass size={16} className="text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-800 truncate">
                    Draft going stale — {agoLabel(d.created_at)} old
                  </p>
                  <p className="text-[11px] text-amber-600 truncate">{d.post_text.slice(0, 60)}…</p>
                </div>
                <ChevronRight size={14} className="ml-auto text-amber-400 shrink-0" />
              </Link>
            ))}
            {staleSoon.length > 5 && (
              <Link href="/queue" className="block text-center text-[11px] font-bold text-amber-700 py-1">
                + {staleSoon.length - 5} more in the queue
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── 4. 7-DAY TREND ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 flex items-center gap-2">
          <Activity size={14} className="text-blue-500" />
          Last 7 days
        </h2>
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 mb-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Drafts found</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Posted</span>
        </div>
        <div className="flex items-end justify-between gap-1.5 h-28">
          {trend.map((t, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
              <div className="flex items-end gap-0.5 h-20">
                <div
                  className="w-2.5 bg-blue-500 rounded-t"
                  style={{ height: `${Math.max(3, (t.drafts / maxTrend) * 80)}px` }}
                  title={`${t.drafts} drafts`}
                />
                <div
                  className="w-2.5 bg-emerald-500 rounded-t"
                  style={{ height: `${Math.max(3, (t.posted / maxTrend) * 80)}px` }}
                  title={`${t.posted} posted`}
                />
              </div>
              <span className="text-[9px] font-bold text-slate-400">{t.day}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-slate-400 pb-4">
        Times in Australia/Brisbane · drafts older than {FRESH_HOURS}h are never posted
      </p>
    </div>
  );
}
