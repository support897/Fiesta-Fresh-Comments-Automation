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
    label: "Account 1 — Ilse Placencia",
    description: "100% of main replies (Primary account)",
    color: "blue",
    emoji: "👤",
    supabaseEmail: "ilse2taylor@gmail.com",
    vpsFile: "FiestaSession cookies (Account 1)",
  },
  {
    key: "account3",
    label: "Account 3 — Website Booster",
    description: "Comments https://www.fiestafreshcleaning.com/ on 100% of leads",
    color: "emerald",
    emoji: "🌐",
    supabaseEmail: "account3",
    vpsFile: "account3_cookies.json (Account 3)",
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

  const commandsMap: Record<string, string> = {
    "ilse2taylor@gmail.com": "python3 /Users/ilse/Fiesta-Fresh-Comments-Automation-1/bot/prime_session_mac.py",
    "account3": "python3 /Users/ilse/Fiesta-Fresh-Comments-Automation-1/bot/prime_session_mac.py",
  };

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyCommand = (key: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
                Run local script commands to prime session &amp; save cookies directly to Supabase / VPS
              </p>
            </div>
          </div>
          <button
            onClick={fetchSessions}
            disabled={isLoading}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50 self-start md:self-auto"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* How-to banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          <strong>How to restore cookies:</strong> Copy the command below for the target account, run it in your terminal on your computer. It will open a real browser window. Complete the Facebook login/2FA, and the script will automatically capture and sync cookies to the VPS bot via Supabase.
        </div>
      </div>

      {/* Account Cards */}
      <div className="space-y-6">
        {ACCOUNTS.map((account) => {
          const session = sessions[account.supabaseEmail];
          const cookieCount = session?.cookies?.length ?? 0;
          const isConnected = cookieCount > 0;
          const isJsonVisible = showJson[account.key] ?? false;
          const command = commandsMap[account.supabaseEmail] || "";

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
                    {isConnected ? "Active" : "Down"}
                  </span>

                  {/* Cookie count badge */}
                  {isConnected && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200">
                      Active: {cookieCount} cookies
                    </span>
                  )}

                  {/* Update timestamp */}
                  {session?.updated_at && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200">
                      <Clock size={10} />
                      Synced {new Date(session.updated_at).toLocaleString()}
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
                      Active Session Metadata
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
                        <Trash2 size={11} /> Force Logout
                      </button>
                    </div>
                  </div>
                  {isJsonVisible && (
                    <pre className="p-4 text-[10px] text-slate-700 overflow-x-auto max-h-40 font-mono leading-relaxed bg-slate-50">
                      {JSON.stringify(session?.cookies?.slice(0, 3), null, 2)}
                      {(session?.cookies?.length ?? 0) > 3 && (
                        <span className="text-slate-400">
                          {"\n"}... +{(session?.cookies?.length ?? 0) - 3} more cookies
                        </span>
                      )}
                    </pre>
                  )}
                </div>
              )}

              {/* Command Box Area */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Terminal Command (Run locally on your computer)
                </label>
                <div className="relative flex items-center bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto select-all pr-12">
                  <span>{command}</span>
                  <button
                    onClick={() => handleCopyCommand(account.key, command)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
                    title="Copy Command"
                  >
                    {copiedKey === account.key ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-700">🔄 Auto-Down Sync:</strong> If Facebook invalidates these cookies at any point, the VPS bot automatically detects it, clears them from the database, and marks the status here as <code className="bg-red-100 text-red-700 px-1 rounded text-[10px]">Down</code> in real-time. Simply copy and run the terminal command above to restore active status.
      </div>
    </div>
  );
}
