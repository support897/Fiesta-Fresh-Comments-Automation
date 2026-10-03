"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Cookie,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  Info,
  Bell,
  BellOff,
} from "lucide-react";

const ACCOUNTS = [
  {
    key: "projects.reports.ilse@gmail.com",
    label: "Account 2 — Projects Reports",
    description: "Main commenting account (posts draft replies)",
    color: "indigo",
    emoji: "💬",
    supabaseEmail: "projects.reports.ilse@gmail.com",
  },
  {
    key: "account3",
    label: "Account 3 — Website Booster",
    description: "Posts the website link on leads",
    color: "emerald",
    emoji: "🌐",
    supabaseEmail: "account3",
  },
  {
    key: "ilse2taylor@gmail.com",
    label: "Account 1 — Ilse Placencia",
    description: "Disabled (legacy)",
    color: "blue",
    emoji: "👤",
    supabaseEmail: "ilse2taylor@gmail.com",
  },
];

type SessionStatus = {
  email: string;
  cookies: any[] | null;
  updated_at: string | null;
  verified: boolean | null;
  verified_at: string | null;
};

type UploadState = "idle" | "loading" | "verifying" | "success" | "error";

export default function CookiesPage() {
  const [sessions, setSessions] = useState<Record<string, SessionStatus>>({});
  const [jsonInputs, setJsonInputs] = useState<Record<string, string>>({});
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [showJson, setShowJson] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const notifiedRef = useRef<Record<string, boolean>>({});

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("user_email, cookies, updated_at, verified, verified_at");

      if (error) throw error;

      const map: Record<string, SessionStatus> = {};
      for (const row of data || []) {
        map[row.user_email] = {
          email: row.user_email,
          cookies: row.cookies,
          updated_at: row.updated_at,
          verified: row.verified ?? null,
          verified_at: row.verified_at ?? null,
        };
      }
      setSessions(map);

      // Check for dead sessions and notify ONCE
      for (const acc of ACCOUNTS) {
        const s = map[acc.supabaseEmail];
        if (s && s.verified === false && !notifiedRef.current[acc.supabaseEmail]) {
          notifiedRef.current[acc.supabaseEmail] = true;
          sendDeadNotification(acc.label);
        }
        if (s && s.verified === true) {
          notifiedRef.current[acc.supabaseEmail] = false; // reset when back alive
        }
      }
    } catch (e) {
      console.error("Failed to load sessions:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, [fetchSessions]);

  const sendDeadNotification = (accountLabel: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🔴 Facebook cookies expired", {
        body: `${accountLabel} session is down. Paste fresh cookies in the dashboard.`,
        tag: `cookies-down-${accountLabel}`,
      });
    }
  };

  const requestNotifPermission = async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    }
  };

  const verifySession = async (supabaseEmail: string): Promise<{ valid: boolean; reason: string; error?: string }> => {
    try {
      const res = await fetch("/api/cookies/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: supabaseEmail }),
      });
      const data = await res.json();
      return { valid: data.valid === true, reason: data.reason || "", error: data.error };
    } catch {
      return { valid: false, reason: "request_failed" };
    }
  };

  const reasonMessage = (reason: string, error?: string): string => {
    if (error) return error;
    switch (reason) {
      case "facebook_deleted_session":
        return "Cookies saved, but Facebook deleted this session (dead cookies). Export fresh cookies and try again.";
      case "redirected_to_login":
        return "Cookies saved, but Facebook bounced us to the login page (dead cookies). Export fresh cookies and try again.";
      case "login_page_served":
        return "Cookies saved, but Facebook served a logged-out page (dead cookies). Export fresh cookies and try again.";
      case "inconclusive":
        return "Cookies saved, but Facebook's reply was unclear — marked as unknown, not guessed. The posting bot will confirm on its next run.";
      case "request_blocked":
        return "Cookies saved, but Facebook blocked the check request itself (not your cookies). Try Check now again in a minute.";
      default:
        return "Cookies saved but could not be confirmed live. Export fresh cookies and try again.";
    }
  };

  const handleUpload = async (accountKey: string, supabaseEmail: string) => {
    const raw = jsonInputs[accountKey]?.trim();
    if (!raw) {
      setUploadErrors((prev) => ({ ...prev, [accountKey]: "Paste your cookie JSON first." }));
      return;
    }

    let parsed: any[];
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error("Must be a JSON array of cookies.");
      if (parsed.length === 0) throw new Error("Cookie array is empty.");
      for (const c of parsed) {
        if (!c.name || c.value === undefined) throw new Error(`Cookie missing 'name' or 'value'.`);
      }
      // Must have c_user and xs
      const names = parsed.map((c: any) => c.name);
      if (!names.includes("c_user") || !names.includes("xs")) {
        throw new Error("Cookies must include 'c_user' and 'xs' (are you logged in?).");
      }
    } catch (e: any) {
      setUploadErrors((prev) => ({ ...prev, [accountKey]: `Invalid: ${e.message}` }));
      setUploadStates((prev) => ({ ...prev, [accountKey]: "error" }));
      return;
    }

    setUploadErrors((prev) => ({ ...prev, [accountKey]: "" }));
    setUploadStates((prev) => ({ ...prev, [accountKey]: "loading" }));

    try {
      // Save to Supabase
      const { error } = await supabase.from("sessions").upsert(
        {
          user_email: supabaseEmail,
          cookies: parsed,
          updated_at: new Date().toISOString(),
          verified: null, // reset until verified
        },
        { onConflict: "user_email" }
      );
      if (error) throw error;

      // Verify it REALLY works
      setUploadStates((prev) => ({ ...prev, [accountKey]: "verifying" }));
      const check = await verifySession(supabaseEmail);

      if (!check.valid) {
        setUploadErrors((prev) => ({
          ...prev,
          [accountKey]: reasonMessage(check.reason, check.error),
        }));
        setUploadStates((prev) => ({ ...prev, [accountKey]: "error" }));
        await fetchSessions();
        return;
      }

      setUploadStates((prev) => ({ ...prev, [accountKey]: "success" }));
      setJsonInputs((prev) => ({ ...prev, [accountKey]: "" }));
      await fetchSessions();

      setTimeout(() => {
        setUploadStates((prev) => ({ ...prev, [accountKey]: "idle" }));
      }, 4000);
    } catch (e: any) {
      setUploadErrors((prev) => ({ ...prev, [accountKey]: `Failed: ${e.message}` }));
      setUploadStates((prev) => ({ ...prev, [accountKey]: "error" }));
    }
  };

  const handleCheckNow = async (accountKey: string, supabaseEmail: string) => {
    setUploadStates((prev) => ({ ...prev, [accountKey]: "verifying" }));
    await verifySession(supabaseEmail);
    await fetchSessions();
    setUploadStates((prev) => ({ ...prev, [accountKey]: "idle" }));
  };

  const handleClearSession = async (accountKey: string, supabaseEmail: string) => {
    if (!confirm(`Clear cookies for ${accountKey}?`)) return;
    try {
      await supabase.from("sessions").upsert(
        { user_email: supabaseEmail, cookies: [], updated_at: new Date().toISOString(), verified: false },
        { onConflict: "user_email" }
      );
      await fetchSessions();
    } catch (e) {
      console.error("Clear failed:", e);
    }
  };

  const colorMap: Record<string, string> = {
    blue: "border-blue-100 bg-blue-50/30",
    indigo: "border-indigo-100 bg-indigo-50/30",
    emerald: "border-emerald-100 bg-emerald-50/30",
  };

  const buttonMap: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-700",
    indigo: "bg-indigo-600 hover:bg-indigo-700",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 font-sans">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
              <Cookie size={26} className="text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cookie Manager</h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                Paste fresh cookies per account — verified live before marked active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notifPermission !== "granted" && (
              <button
                onClick={requestNotifPermission}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
              >
                <Bell size={14} /> Enable expiry alerts
              </button>
            )}
            <button
              onClick={fetchSessions}
              disabled={isLoading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* How-to instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed space-y-2">
            <p className="font-bold">How to get your cookies (2 minutes):</p>
            <ol className="list-decimal ml-5 space-y-1 text-amber-800">
              <li>Install the <strong>"Cookie-Editor"</strong> extension (Chrome Web Store, free).</li>
              <li>Go to <strong>facebook.com</strong> and log in to the account.</li>
              <li>Click the Cookie-Editor icon → click <strong>Export</strong> (copies JSON).</li>
              <li>Paste the JSON in the box below for that account → click <strong>Save & Verify</strong>.</li>
              <li>It turns green <strong>only if Facebook accepts them</strong> — not just saved.</li>
            </ol>
            <p className="text-xs text-amber-700 pt-1">
              💡 Cookies expire when you keep using Facebook. If a session dies, you'll get one phone notification — then paste fresh ones here.
            </p>
          </div>
        </div>
      </div>

      {/* Account Cards */}
      <div className="space-y-6">
        {ACCOUNTS.map((account) => {
          const session = sessions[account.supabaseEmail];
          const cookieCount = session?.cookies?.length ?? 0;
          const hasCookies = cookieCount > 0;
          // Active ONLY if verified true — not just saved
          const isLive = session?.verified === true;
          const isDead = hasCookies && session?.verified === false;
          const isJsonVisible = showJson[account.key] ?? false;
          const state = uploadStates[account.key] ?? "idle";

          return (
            <div key={account.key} className={`bg-white border rounded-3xl p-6 shadow-sm space-y-5 ${colorMap[account.color]}`}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-lg shadow-sm shrink-0">
                    {account.emoji}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{account.label}</h2>
                    <p className="text-xs text-slate-500">{account.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                    isLive ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : isDead ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isLive ? "bg-emerald-500 animate-pulse" : isDead ? "bg-red-500" : "bg-slate-400"
                    }`} />
                    {isLive ? "● Live" : isDead ? "○ Off" : "— No cookies"}
                  </span>
                  {session?.verified_at && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200">
                      <Clock size={10} />
                      Checked {new Date(session.verified_at).toLocaleTimeString()}
                    </span>
                  )}
                  {hasCookies && (
                    <button
                      onClick={() => handleCheckNow(account.key, account.supabaseEmail)}
                      disabled={state === "verifying"}
                      className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={state === "verifying" ? "animate-spin" : ""} />
                      {state === "verifying" ? "Checking…" : "Check now"}
                    </button>
                  )}
                </div>
              </div>

              {/* Paste JSON */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Paste Cookie JSON
                </label>
                <textarea
                  value={jsonInputs[account.key] ?? ""}
                  onChange={(e) => setJsonInputs((prev) => ({ ...prev, [account.key]: e.target.value }))}
                  placeholder='[{"name":"c_user","value":"..."}, ...] — from Cookie-Editor Export'
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
                />
                {uploadErrors[account.key] && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    {uploadErrors[account.key]}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUpload(account.key, account.supabaseEmail)}
                    disabled={state === "loading" || state === "verifying"}
                    className={`${buttonMap[account.color]} text-white px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg`}
                  >
                    {state === "loading" ? (<><RefreshCw size={14} className="animate-spin" /> Saving…</>)
                    : state === "verifying" ? (<><ShieldCheck size={14} className="animate-pulse" /> Verifying with Facebook…</>)
                    : state === "success" ? (<><CheckCircle2 size={14} /> Verified Live!</>)
                    : (<><Upload size={14} /> Save & Verify</>)}
                  </button>
                  {hasCookies && (
                    <button
                      onClick={() => handleClearSession(account.key, account.supabaseEmail)}
                      className="text-[11px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={11} /> Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Status shows <strong className="text-emerald-600">● Live</strong> only after Facebook accepts the cookies — not just when saved.
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700">🔔 One-time alerts:</strong> When a session dies, you get <strong>one</strong> phone notification (if enabled above). No repeats. Paste fresh cookies to go live again.
      </div>
    </div>
  );
}
