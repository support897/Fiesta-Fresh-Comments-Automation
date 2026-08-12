"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Cookie,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Clock,
  ShieldCheck,
  Info,
} from "lucide-react";

const ACCOUNTS = [
  {
    key: "ilse2taylor@gmail.com",
    label: "Account 1 — Ilse",
    description: "50% of main replies (Taylor account)",
    color: "blue",
    emoji: "👤",
    supabaseEmail: "ilse2taylor@gmail.com",
    vpsFile: "FiestaSession cookies (Account 1)",
  },
  {
    key: "projects.reports.ilse@gmail.com",
    label: "Account 2 — Taylor",
    description: "50% of main replies (Ilse account)",
    color: "indigo",
    emoji: "👤",
    supabaseEmail: "projects.reports.ilse@gmail.com",
    vpsFile: "FiestaSession cookies (Account 2)",
  },
  {
    key: "account3",
    label: "Account 3 — Website Booster",
    description: "Posts https://www.fiestafreshcleaning.com/ on 100% of leads",
    color: "emerald",
    emoji: "🌐",
    supabaseEmail: "account3",
    vpsFile: "account3_cookies.json",
  },
];

type SessionStatus = {
  email: string;
  cookies: any[] | null;
  updated_at: string | null;
};

type UploadState = "idle" | "loading" | "success" | "error";

export default function CookiesPage() {
  const [sessions, setSessions] = useState<Record<string, SessionStatus>>({});
  const [jsonInputs, setJsonInputs] = useState<Record<string, string>>({});
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [showJson, setShowJson] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("user_email, cookies, updated_at");

      if (error) throw error;

      const map: Record<string, SessionStatus> = {};
      for (const row of data || []) {
        map[row.user_email] = {
          email: row.user_email,
          cookies: row.cookies,
          updated_at: row.updated_at,
        };
      }
      setSessions(map);
    } catch (e) {
      console.error("Failed to load sessions:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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
      // Basic validation — each cookie needs at least name + value
      for (const c of parsed) {
        if (!c.name || !c.value) throw new Error(`Cookie missing 'name' or 'value': ${JSON.stringify(c).slice(0, 60)}`);
      }
    } catch (e: any) {
      setUploadErrors((prev) => ({ ...prev, [accountKey]: `Invalid JSON: ${e.message}` }));
      return;
    }

    setUploadErrors((prev) => ({ ...prev, [accountKey]: "" }));
    setUploadStates((prev) => ({ ...prev, [accountKey]: "loading" }));

    try {
      const { error } = await supabase
        .from("sessions")
        .upsert(
          {
            user_email: supabaseEmail,
            cookies: parsed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_email" }
        );

      if (error) throw error;

      setUploadStates((prev) => ({ ...prev, [accountKey]: "success" }));
      setJsonInputs((prev) => ({ ...prev, [accountKey]: "" }));
      await fetchSessions();

      // Auto-reset success after 4s
      setTimeout(() => {
        setUploadStates((prev) => ({ ...prev, [accountKey]: "idle" }));
      }, 4000);
    } catch (e: any) {
      setUploadErrors((prev) => ({ ...prev, [accountKey]: `Save failed: ${e.message}` }));
      setUploadStates((prev) => ({ ...prev, [accountKey]: "error" }));
    }
  };

  const handleClearSession = async (accountKey: string, supabaseEmail: string) => {
    if (!confirm(`Clear cookies for ${accountKey}? The bot will need fresh cookies to log in.`)) return;

    try {
      await supabase
        .from("sessions")
        .upsert(
          { user_email: supabaseEmail, cookies: [], updated_at: new Date().toISOString() },
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

  const badgeMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };

  const buttonMap: Record<string, string> = {
    blue: "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20",
    indigo: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20",
    emerald: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20",
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
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Cookie Manager 🍪
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                Paste Facebook cookie JSON from your browser plugin → auto-syncs to VPS bot
              </p>
            </div>
          </div>
          <button
            onClick={fetchSessions}
            disabled={isLoading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50 self-start md:self-auto"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* How-to banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <strong>How to use:</strong> In Chrome, open your{" "}
          <strong>Cookie Editor / EditThisCookie</strong> plugin on facebook.com, click{" "}
          <strong>Export as JSON</strong>, then paste the full JSON array into the box below for
          each account. Click <strong>Save &amp; Sync</strong>. The bot picks up the new cookies on
          its next scan cycle (within 30 minutes) automatically via Supabase — no VPS restart
          needed.
        </div>
      </div>

      {/* Account Cards */}
      <div className="space-y-6">
        {ACCOUNTS.map((account) => {
          const session = sessions[account.supabaseEmail];
          const cookieCount = session?.cookies?.length ?? 0;
          const isConnected = cookieCount > 0;
          const uploadState = uploadStates[account.key] || "idle";
          const uploadError = uploadErrors[account.key] || "";
          const isJsonVisible = showJson[account.key] ?? false;

          return (
            <div
              key={account.key}
              className={`bg-white border rounded-3xl p-6 shadow-sm space-y-5 ${colorMap[account.color]}`}
            >
              {/* Account Header */}
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
                  {/* Status Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      isConnected
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-600 border-red-200"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                      }`}
                    />
                    {isConnected ? `${cookieCount} cookies active` : "No cookies — bot blocked"}
                  </span>

                  {/* Cookie count badge */}
                  {session?.updated_at && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200">
                      <Clock size={10} />
                      Updated {new Date(session.updated_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Existing cookies preview */}
              {isConnected && (
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      Active Cookies ({cookieCount})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setShowJson((prev) => ({ ...prev, [account.key]: !isJsonVisible }))
                        }
                        className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1 transition-colors"
                      >
                        {isJsonVisible ? (
                          <><EyeOff size={12} /> Hide</>
                        ) : (
                          <><Eye size={12} /> Preview</>
                        )}
                      </button>
                      <button
                        onClick={() => handleClearSession(account.key, account.supabaseEmail)}
                        className="text-[11px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={11} /> Clear
                      </button>
                    </div>
                  </div>
                  {isJsonVisible && (
                    <pre className="p-4 text-[10px] text-slate-700 overflow-x-auto max-h-40 font-mono leading-relaxed">
                      {JSON.stringify(session?.cookies?.slice(0, 5), null, 2)}
                      {(session?.cookies?.length ?? 0) > 5 && (
                        <span className="text-slate-400">
                          {"\n"}... +{(session?.cookies?.length ?? 0) - 5} more cookies
                        </span>
                      )}
                    </pre>
                  )}
                </div>
              )}

              {/* JSON Paste Area */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                  <Upload size={12} />
                  Paste New Cookie JSON (from EditThisCookie / Cookie Editor plugin)
                </label>
                <textarea
                  id={`cookie-input-${account.key}`}
                  value={jsonInputs[account.key] || ""}
                  onChange={(e) =>
                    setJsonInputs((prev) => ({ ...prev, [account.key]: e.target.value }))
                  }
                  placeholder={`[\n  {\n    "name": "c_user",\n    "value": "123456789",\n    "domain": ".facebook.com",\n    "path": "/",\n    "secure": true,\n    "httpOnly": false,\n    "sameSite": "None",\n    "expires": 1799999999\n  },\n  ...\n]`}
                  rows={8}
                  className="w-full font-mono text-[11px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y transition-all"
                />

                {/* Error message */}
                {uploadError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Success message */}
                {uploadState === "success" && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 size={14} />
                    ✅ Cookies saved to Supabase! Bot will pick them up on the next scan cycle
                    (within 30 min).
                  </div>
                )}

                {/* Save button */}
                <button
                  id={`save-cookie-${account.key}`}
                  onClick={() => handleUpload(account.key, account.supabaseEmail)}
                  disabled={uploadState === "loading" || !jsonInputs[account.key]?.trim()}
                  className={`w-full py-3 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${buttonMap[account.color]}`}
                >
                  {uploadState === "loading" ? (
                    <><RefreshCw size={16} className="animate-spin" /> Saving to Supabase...</>
                  ) : uploadState === "success" ? (
                    <><CheckCircle2 size={16} /> Synced!</>
                  ) : (
                    <><Upload size={16} /> Save &amp; Sync to VPS Bot</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700">🔄 How sync works:</strong> Cookies are saved to the
        Supabase <code className="bg-slate-100 px-1 rounded text-[10px]">sessions</code> table. The
        VPS bot reads fresh cookies from Supabase at the start of each scan cycle. No manual VPS
        restart needed — it automatically uses the new session on its next run (within 30 minutes).
      </div>
    </div>
  );
}
