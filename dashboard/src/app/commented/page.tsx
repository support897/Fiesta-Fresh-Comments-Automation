"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import {
  QueueRow, ServiceType, SERVICE_TYPE_META,
  typeLabel, agoLabel, groupNameFromUrl, brisbaneWeekStart,
} from "@/lib/queue";
import {
  ExternalLink, RefreshCw, Archive, CheckCheck,
} from "lucide-react";

type DonePost = {
  post_id: string;
  group_url: string;
  post_text: string;
  service_type: string;
  permalink: string;
  acc2_at: string | null;
  acc3_at: string | null;
};

export default function CommentedPage() {
  const [posts, setPosts] = useState<DonePost[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { data: trows }] = await Promise.all([
      supabase.from("comment_queue").select("*").eq("status", "posted")
        .order("posted_at", { ascending: false }).limit(500),
      supabase.from("service_types").select("*").order("sort_order"),
    ]);
    const byPost = new Map<string, DonePost>();
    for (const r of ((rows ?? []) as QueueRow[])) {
      const cur = byPost.get(r.post_id);
      if (!cur) {
        byPost.set(r.post_id, {
          post_id: r.post_id, group_url: r.group_url, post_text: r.post_text,
          service_type: r.service_type, permalink: r.permalink,
          acc2_at: r.account === "acc2" ? r.posted_at : null,
          acc3_at: r.account === "acc3" ? r.posted_at : null,
        });
      } else {
        if (r.account === "acc2") cur.acc2_at = r.posted_at;
        if (r.account === "acc3") cur.acc3_at = r.posted_at;
      }
    }
    setPosts([...byPost.values()]);
    setTypes((trows ?? []) as ServiceType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekStart = useMemo(brisbaneWeekStart, []);
  const thisWeek = useMemo(
    () => posts.filter((p) => p.acc2_at && new Date(p.acc2_at) >= weekStart),
    [posts, weekStart]
  );
  const fullyDone = useMemo(
    () => posts.filter((p) => p.acc2_at && p.acc3_at),
    [posts]
  );
  const visible = filter === "all" ? posts : posts.filter((p) => p.service_type === filter);

  const perType = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of thisWeek) m.set(p.service_type, (m.get(p.service_type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [thisWeek]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">Commented</h1>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-2xl">
            The permanent record — every post both accounts completed. Used for reporting and the weekly email.
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all">
          <RefreshCw size={16} className={cn(loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="text-3xl font-black text-slate-900">{thisWeek.length}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Commented this week</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="text-3xl font-black text-emerald-600">
            {thisWeek.filter((p) => p.acc3_at).length}
          </div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Fully boosted</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="text-3xl font-black text-slate-900">{fullyDone.length}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">All-time completed</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">This week by type</div>
          <div className="space-y-1">
            {perType.length === 0 && <span className="text-xs text-slate-400">—</span>}
            {perType.map(([k, n]) => (
              <div key={k} className="flex justify-between text-xs font-semibold text-slate-600">
                <span>{typeLabel(k, types)}</span><span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...types.map((t) => t.key)].map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn("px-4 py-2 rounded-full text-xs font-bold transition-all",
              filter === k ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}>
            {k === "all" ? "All types" : typeLabel(k, types)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-3xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <Archive className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800">Nothing here yet</h3>
          <p className="text-sm text-slate-500 mt-1">Completed posts will appear here with both timestamps.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {visible.map((p) => {
            const meta = SERVICE_TYPE_META[p.service_type] ?? SERVICE_TYPE_META.home;
            return (
              <div key={p.post_id} className="bg-white border border-slate-200 rounded-3xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", meta.badge)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                      {typeLabel(p.service_type, types)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{groupNameFromUrl(p.group_url)}</span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed line-clamp-2">{p.post_text}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 font-medium flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <CheckCheck size={12} className="text-blue-500" /> Acc2 {agoLabel(p.acc2_at)}
                    </span>
                    {p.acc3_at ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCheck size={12} className="text-emerald-500" /> Acc3 {agoLabel(p.acc3_at)}
                      </span>
                    ) : (
                      <span className="text-amber-500 font-bold">Acc3 pending</span>
                    )}
                  </div>
                </div>
                <a href={p.permalink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all shrink-0 self-start md:self-center">
                  <ExternalLink size={15} /> View post
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
