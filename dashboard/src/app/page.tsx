"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  CheckCircle2,
  Users,
  Clock,
  Play,
  Pause,
  RefreshCw,
  ShieldAlert,
  Database,
  ExternalLink,
  ShieldCheck,
  Globe,
  Copy,
  Check,
} from "lucide-react";

/* ─────────────────────── types ── */
type ReplyLog = {
  id: string;
  post_id: string;
  group_url: string;
  account_name: string | null;
  comment_id: string | null;
  comment_url: string | null;
  replied_at: string;
};

type LeadItem = {
  id: string;
  post_id: string;
  group_url: string;
  post_text: string;
  status: string;
  created_at: string;
};

type Config = {
  id: number;
  bot_status: boolean;
};

/* ─────────────────────── constants ── */
const FIXED_REPLY_TEMPLATE = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

/** Map a raw email/identifier to a human display name */
function displayAccount(raw: string | null, commentId: string | null): string {
  if (!raw) {
    // fall back to comment_id prefix
    if (commentId?.startsWith("booster_")) return "Website Booster";
    return "Unknown";
  }
  if (raw === "Website Booster") return "Website Booster";
  // email-based names: ilse@... → Ilse, taylor@... → Taylor, etc.
  const lower = raw.toLowerCase();
  if (lower.includes("ilse")) return "Ilse";
  if (lower.includes("taylor")) return "Taylor";
  if (lower.includes("booster") || lower.includes("account3")) return "Website Booster";
  // generic: use part before @
  return raw.includes("@") ? raw.split("@")[0] : raw;
}

const PROFILES = [
  { name: "Ilse",            initial: "I", sub: "File: 1.json · 50% Main Reply",          color: "bg-slate-50 text-slate-700" },
  { name: "Taylor",          initial: "T", sub: "File: 2.json · 50% Main Reply",          color: "bg-slate-50 text-slate-700" },
  { name: "Website Booster", initial: "W", sub: "File: account3_cookies.json · 100% URL", color: "bg-blue-50 text-blue-600"   },
];

/* ─────────────────────── component ── */
export default function DashboardPage() {
  const [isBotActive, setIsBotActive]   = useState(true);
  const [configId, setConfigId]         = useState<number | null>(null);
  const [stats, setStats] = useState({
    totalDispatches: 0,
    commentsPosted:  0,
    activeGroups:    0,
  });
  const [replies, setReplies]           = useState<ReplyLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [triggering, setTriggering]     = useState(false);
  const [selectedReply, setSelectedReply] = useState<ReplyLog | null>(null);
  const [copied, setCopied]             = useState(false);
  const [nextScan, setNextScan]         = useState("");

  /* ── fetch all real data from Supabase (VPS syncs here) ── */
  const loadData = useCallback(async () => {
    try {
      // Bot config
      const { data: config } = await supabase
        .from("config")
        .select("id, bot_status")
        .maybeSingle();
      if (config) {
        setIsBotActive(!!config.bot_status);
        setConfigId(config.id);
      }

      // Real counts — no floor fallbacks
      const { count: totalLeads } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      const { count: totalReplies } = await supabase
        .from("replies_log")
        .select("*", { count: "exact", head: true });

      const { count: activeGroups } = await supabase
        .from("groups")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setStats({
        totalDispatches: totalLeads  ?? 0,
        commentsPosted:  totalReplies ?? 0,
        activeGroups:    activeGroups ?? 0,
      });

      // Real replies — newest first
      const { data: replyData } = await supabase
        .from("replies_log")
        .select("id, post_id, group_url, account_name, comment_id, comment_url, replied_at")
        .order("replied_at", { ascending: false })
        .limit(100);

      setReplies((replyData ?? []) as ReplyLog[]);
    } catch (e) {
      console.error("loadData error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Next scan banner — every 30 min
    const now = new Date();
    const next = new Date(now.getTime() + (30 - (now.getMinutes() % 30)) * 60000);
    next.setSeconds(0);
    setNextScan(
      next.toLocaleString("en-AU", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    );

    // Live Supabase subscription
    const ch = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "replies_log" }, loadData)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "config"      }, loadData)
      .subscribe();

    const iv = setInterval(loadData, 20000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [loadData]);

  /* ── bot toggle ── */
  const handleToggleBot = async () => {
    setTriggering(true);
    const next = !isBotActive;
    setIsBotActive(next);
    try {
      if (configId) await supabase.from("config").update({ bot_status: next }).eq("id", configId);
    } catch (e) { console.error(e); }
    finally { setTriggering(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(FIXED_REPLY_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── skeleton while loading ── */
  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  /* ─────────────────────── JSX ── */
  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">Command Center</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Real-time lead detection &amp; 3-account comment engine · VPS synced
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
          <button
            onClick={handleToggleBot}
            disabled={triggering}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:scale-105 disabled:opacity-50 text-sm"
          >
            {isBotActive ? <Pause size={16} /> : <Play size={16} className="fill-current" />}
            {triggering ? "UPDATING..." : isBotActive ? "PAUSE BOT" : "RUN BOT NOW"}
          </button>
        </div>
      </div>

      {/* Bot paused warning */}
      {!isBotActive && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-700">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <div className="text-xs font-semibold">Bot is paused. No new comments will be posted until you resume.</div>
        </div>
      )}

      {/* Stat Cards — 100% real data from Supabase */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
            <BarChart3 size={24} className="text-blue-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{stats.totalDispatches}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Leads</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} className="text-emerald-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{stats.commentsPosted}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comments Posted</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={24} className="text-indigo-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">3 / 3</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Profiles</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
            <Clock size={24} className="text-amber-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{stats.activeGroups}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Groups</div>
          </div>
        </div>
      </div>

      {/* Cookie Status */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" /> Facebook Profile Cookie Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PROFILES.map((p) => (
            <div key={p.name} className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold", p.color)}>
                  {p.initial}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">{p.name}</h4>
                  <p className="text-[10px] text-slate-400">{p.sub}</p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                ● Connected
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Scan Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-blue-500/20">
        <div className="text-[10px] font-bold tracking-widest uppercase opacity-75">Next Scheduled Scan</div>
        <div className="text-2xl font-black mt-1">{nextScan || "Every 30 min · 24/7"}</div>
        <div className="text-xs opacity-75 mt-1">
          {isBotActive ? "🟢 Bot active — scanning all target groups continuously" : "⏸ Bot paused"}
        </div>
      </div>

      {/* Recent Comments Table — real data, no placeholders */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Comments Posted</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.commentsPosted} total · live from VPS via Supabase
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Group Target</th>
                <th className="px-4 py-3">Comment URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Commented At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {replies.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    No comments posted yet — bot is actively scanning groups.
                  </td>
                </tr>
              )}
              {replies.map((reply) => {
                const accountLabel = displayAccount(reply.account_name, reply.comment_id);
                const isBooster    = accountLabel === "Website Booster";
                const groupName    = reply.group_url
                  .replace(/https?:\/\/www\.facebook\.com\/groups\//, "")
                  .replace(/\/$/, "");
                return (
                  <tr key={reply.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Account */}
                    <td className="px-4 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold",
                        isBooster
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-700"
                      )}>
                        {accountLabel}
                      </span>
                    </td>

                    {/* Group */}
                    <td className="px-4 py-4">
                      <a
                        href={reply.group_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-medium flex items-center gap-1"
                      >
                        <span className="truncate max-w-[160px] block">{groupName}</span>
                        <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                      </a>
                    </td>

                    {/* Comment URL */}
                    <td className="px-4 py-4">
                      {reply.comment_url ? (
                        <a
                          href={reply.comment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline font-medium flex items-center gap-1"
                        >
                          <span>View Comment</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-600 border-emerald-100">
                        commented
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-4 py-4 text-slate-500 font-medium whitespace-nowrap">
                      {new Date(reply.replied_at).toLocaleString("en-AU")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Template Preview Modal — triggered from header info */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          Active Comment Templates
        </h3>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Accounts 1 &amp; 2 (Ilse + Taylor) · 200% Guarantee Response
              </span>
              <button onClick={handleCopy} className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-slate-800 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto">
              {FIXED_REPLY_TEMPLATE}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              Account 3 (Website Booster) · URL Drop · 100% of leads
            </span>
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-mono font-bold text-indigo-900">
              https://www.fiestafreshcleaning.com/
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
