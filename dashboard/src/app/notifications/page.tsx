"use client";

import React from "react";
import { Bell, BellOff, Download, Check, Loader2, Smartphone } from "lucide-react";
import { usePwa } from "../pwa-provider";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { installPrompt, isInstalled, pushEnabled, pushLoading, promptInstall, enablePush, disablePush } = usePwa();
  const [testSent, setTestSent] = React.useState(false);

  const sendTest = async () => {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Fiesta Fresh — Test",
        body: "Push notifications are working! You'll get the Monday report and urgent alerts here.",
        url: "/",
        tag: "test-notification",
      }),
    });
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Get the Monday weekly report and urgent alerts on your phone.
        </p>
      </div>

      {/* Install App Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Smartphone className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">Install as App</h2>
            <p className="text-sm text-slate-500 mt-1">
              {isInstalled
                ? "Already installed! You can open Fiesta Queue from your home screen."
                : "Add Fiesta Queue to your home screen for quick access, just like a regular app."}
            </p>
            {!isInstalled && installPrompt && (
              <button
                onClick={promptInstall}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Download size={16} />
                Install App
              </button>
            )}
            {!isInstalled && !installPrompt && (
              <p className="mt-3 text-xs text-slate-400">
                On iPhone: tap Share → "Add to Home Screen" in Safari.
              </p>
            )}
          </div>
          {isInstalled && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <Check size={12} /> Installed
            </span>
          )}
        </div>
      </div>

      {/* Push Notifications Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            pushEnabled ? "bg-emerald-50" : "bg-slate-100"
          )}>
            {pushEnabled
              ? <Bell className="w-6 h-6 text-emerald-600" />
              : <BellOff className="w-6 h-6 text-slate-400" />}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">Push Notifications</h2>
            <p className="text-sm text-slate-500 mt-1">
              {pushEnabled
                ? "You're all set! You'll receive notifications on this device."
                : "Turn on to receive the Monday report and urgent alerts."}
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div>
                  <p className="font-medium text-slate-700">Monday Weekly Report</p>
                  <p className="text-slate-500 text-xs mt-0.5">Every Monday morning: all comments posted, failed, and pending.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <div>
                  <p className="font-medium text-slate-700">Urgent Alerts (once only)</p>
                  <p className="text-slate-500 text-xs mt-0.5">Cookie expired, bot offline, or failures needing you. One alert per incident — never repeated.</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {!pushEnabled ? (
                <button
                  onClick={enablePush}
                  disabled={pushLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {pushLoading ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />}
                  Enable Notifications
                </button>
              ) : (
                <>
                  <button
                    onClick={sendTest}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Send Test
                  </button>
                  <button
                    onClick={disablePush}
                    disabled={pushLoading}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-500 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    {pushLoading ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} />}
                    Turn Off
                  </button>
                </>
              )}
            </div>
            {testSent && (
              <p className="mt-3 text-xs text-emerald-600 font-medium">Test sent! Check your notifications.</p>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <p className="text-xs text-slate-400 text-center px-4">
        Notifications work even when the app is closed. On iPhone, you need iOS 16.4+ and the app added to Home Screen.
      </p>
    </div>
  );
}
