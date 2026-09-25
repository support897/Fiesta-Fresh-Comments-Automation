"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import {
  QueueRow, ServiceType, SERVICE_TYPE_META,
  typeLabel, brisbaneWeekStart,
} from "@/lib/queue";
import { ClipboardList, Rocket, CheckCheck, Inbox } from "lucide-react";

type Funnel = {
  found: number;
  ready: number;
  acc2: number;
  acc3: number;
  done: number;
  byType: [string, number][];
};

/** CEO view of the human-reviewed draft pipeline — 100% real data. */
export default function FunnelSection() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);

  useEffect(() => {
    (async () => {
      const weekStart = brisbaneWeekStart().toISOString();
      const [{ data: q }, { data: t }] = await Promise.all([
        supabase.from("comment_queue").select("*").gte("created_at", weekStart).limit(2000),
        supabase.from("service_types").select("*").order("sort_order"),
      ]);
      setRows((q ?? []) as QueueRow[]);
      setTypes((t ?? []) as ServiceType[]);
    })();
  }, []);

  const funnel: Funnel = useMemo(() => {
    const acc2 = rows.filter((r) => r.account === "acc2");
    const acc2PostedIds = new Set(acc2.filter((r) => r.status === "posted").map((r) => r.post_id));
    const acc3PostedIds = new Set(
      rows.filter((r) => r.account === "acc3" && r.status === "posted").map((r) => r.post_id)
    );
    const done = [...acc2PostedIds].filter((id) => acc3PostedIds.has(id)).length;
    const byType = new Map<string, number>();
    for (const r of acc2) byType.set(r.service_type, (byType.get(r.service_type) ?? 0) + 1);
    return {
      found: acc2.length,
      ready: acc2.filter((r) => r.status === "draft_ready").length,
      acc2: acc2PostedIds.size,
      acc3: acc3PostedIds.size,
      done,
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows]);

  const tiles = [
    { label: "Found", value: funnel.found, href: "/queue", icon: Inbox, color: "text-blue-600 bg-blue-50" },
    { label: "Drafts ready", value: funnel.ready, href: "/queue", icon: ClipboardList, color: "text-amber-600 bg-amber-50" },
    { label: "Acc2 posted", value: funnel.acc2, href: "/booster", icon: CheckCheck, color: "text-indigo-600 bg-indigo-50" },
    { label: "Acc3 posted", value: funnel.acc3, href: "/commented", icon: Rocket, color: "text-violet-600 bg-violet-50" },
    { label: "Fully done", value: funnel.done, href: "/commented", icon: CheckCheck, color: "text-emerald-600 bg-emerald-50" },
  ];

  const maxType = Math.max(1, ...funnel.byType.map(([, n]) => n));

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          Draft Funnel · this week
        </h3>
        <span className="text-xs text-slate-400 font-medium">live from the patrol</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href}
            className="rounded-2xl border border-slate-100 p-4 hover:border-slate-300 hover:shadow-sm transition-all">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", t.color)}>
              <t.icon size={17} />
            </div>
            <div className="text-2xl font-black text-slate-900">{t.value}</div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t.label}</div>
          </Link>
        ))}
      </div>

      {funnel.byType.length > 0 && (
        <div className="mt-5 space-y-2">
          {funnel.byType.map(([key, n]) => {
            const meta = SERVICE_TYPE_META[key] ?? SERVICE_TYPE_META.home;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 w-36 truncate">{typeLabel(key, types)}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", meta.dot)} style={{ width: `${(n / maxType) * 100}%` }} />
                </div>
                <span className="text-xs font-black text-slate-800 w-8 text-right">{n}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
