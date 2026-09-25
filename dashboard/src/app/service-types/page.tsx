"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { ServiceType, SERVICE_TYPE_META, TYPE_DESCRIPTIONS } from "@/lib/queue";
import { RefreshCw, Tags, Loader2 } from "lucide-react";

export default function ServiceTypesPage() {
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("service_types").select("*").order("sort_order");
    setTypes((data ?? []) as ServiceType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (t: ServiceType) => {
    const next = !t.is_active;
    setSavingKey(t.key);
    try {
      const { error } = await supabase.from("service_types")
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq("key", t.key);
      if (error) throw error;
      setTypes((prev) => prev.map((x) => x.key === t.key ? { ...x, is_active: next } : x));
    } catch (e: any) {
      alert("Could not save — please try again. " + (e?.message ?? e));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">Service Types</h1>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-2xl">
            Each clean type works independently. While a type is <b>off</b>, the patrol
            will not create drafts for it — nothing else is affected.
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all">
          <RefreshCw size={16} className={cn(loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-3xl" />)}
        </div>
      ) : types.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-sm text-amber-800 font-medium">
          No service types found. Run <code>supabase/migrations/20260925_draft_flow.sql</code> in the
          Supabase SQL editor to create them.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {types.map((t) => {
            const meta = SERVICE_TYPE_META[t.key] ?? SERVICE_TYPE_META.home;
            const saving = savingKey === t.key;
            return (
              <div key={t.key}
                className={cn("bg-white border rounded-3xl p-5 md:p-6 shadow-sm transition-all",
                  t.is_active ? "border-slate-200" : "border-slate-200 opacity-75")}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", meta.badge)}>
                      <Tags size={18} />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900">{t.label}</h3>
                      <p className={cn("text-xs font-bold uppercase tracking-wider mt-0.5",
                        t.is_active ? "text-emerald-600" : "text-slate-400")}>
                        {t.is_active ? "● Active" : "○ Off"}
                      </p>
                    </div>
                  </div>
                  <button
                    role="switch" aria-checked={t.is_active}
                    onClick={() => toggle(t)} disabled={saving}
                    className={cn("relative w-14 h-8 rounded-full transition-colors shrink-0 disabled:opacity-50",
                      t.is_active ? "bg-emerald-500" : "bg-slate-300")}>
                    <span className={cn("absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all flex items-center justify-center",
                      t.is_active ? "left-7" : "left-1")}>
                      {saving && <Loader2 size={12} className="animate-spin text-slate-400" />}
                    </span>
                  </button>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mt-3">
                  {TYPE_DESCRIPTIONS[t.key] ?? ""}
                </p>
                {!t.is_active && (
                  <p className="text-xs font-semibold text-slate-400 mt-2">
                    The patrol skips {t.label.toLowerCase()} posts while this is off.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
