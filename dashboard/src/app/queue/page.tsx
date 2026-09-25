"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import {
  QueueRow, ServiceType, SERVICE_TYPE_META,
  typeLabel, agoLabel, groupNameFromUrl, copyText, ACC3_URL,
} from "@/lib/queue";
import {
  Copy, Check, ExternalLink, CheckCheck, RefreshCw,
  ClipboardList, ChevronDown, Loader2,
} from "lucide-react";

export default function QueuePage() {
  const [drafts, setDrafts] = useState<QueueRow[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows }, { data: trows }] = await Promise.all([
      supabase.from("comment_queue")
        .select("*")
        .eq("account", "acc2")
        .eq("status", "draft_ready")
        .order("created_at", { ascending: false }),
      supabase.from("service_types").select("*").order("sort_order"),
    ]);
    setDrafts((rows ?? []) as QueueRow[]);
    setTypes((trows ?? []) as ServiceType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async (d: QueueRow) => {
    if (await copyText(d.comment_text)) {
      setCopiedId(d.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  /** Explicit confirmation ONLY — clicking the post link never advances state. */
  const handlePosted = async (d: QueueRow) => {
    if (!window.confirm("Mark this as posted on Account 2 (Projects Reports)?\nIt will move to the Account 3 booster queue.")) return;
    setPostingId(d.id);
    try {
      const now = new Date().toISOString();
      const { error: upErr } = await supabase.from("comment_queue")
        .update({ status: "posted", posted_at: now, updated_at: now })
        .eq("id", d.id);
      if (upErr) throw upErr;
      // Hand the post to the Account 3 booster queue (best-effort; the
      // booster page also derives missing rows, so a failure here is safe).
      await supabase.from("comment_queue").insert({
        post_id: d.post_id,
        account: "acc3",
        group_url: d.group_url,
        post_text: d.post_text,
        service_type: d.service_type,
        comment_text: ACC3_URL,
        permalink: d.permalink,
        status: "draft_ready",
      });
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e: any) {
      alert("Could not save — please try again. " + (e?.message ?? e));
    } finally {
      setPostingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">
            Account 2 · Ready to Post
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-2xl">
            Drafts the patrol prepared for the <b>Projects Reports</b> account.
            Open the post on your computer, paste the comment, press Enter —
            then tap <b>“I’ve posted it”</b>. Nothing moves forward until you say so.
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all">
          <RefreshCw size={16} className={cn(loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-slate-200 rounded-3xl" />)}
        </div>
      ) : drafts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800">Queue is clear 🎉</h3>
          <p className="text-sm text-slate-500 mt-1">No drafts waiting. The patrol is watching the groups for fresh leads.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {drafts.map((d) => {
            const meta = SERVICE_TYPE_META[d.service_type] ?? SERVICE_TYPE_META.home;
            const expanded = expandedId === d.id;
            return (
              <div key={d.id} className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", meta.badge)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                    {typeLabel(d.service_type, types)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{groupNameFromUrl(d.group_url)}</span>
                  <span className="text-xs text-slate-400">· found {agoLabel(d.created_at)}</span>
                </div>

                <button
                  onClick={() => setExpandedId(expanded ? null : d.id)}
                  className="w-full text-left"
                >
                  <p className={cn("text-sm text-slate-700 leading-relaxed", !expanded && "line-clamp-3")}>
                    {d.post_text}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 mt-1">
                    {expanded ? "Show less" : "Read full post"} <ChevronDown size={12} className={cn(expanded && "rotate-180")} />
                  </span>
                </button>

                <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Your draft comment</p>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{d.comment_text}</p>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <a href={d.permalink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all">
                    <ExternalLink size={15} /> Open post
                  </a>
                  <button onClick={() => handleCopy(d)}
                    className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all",
                      copiedId === d.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
                    {copiedId === d.id ? <Check size={15} /> : <Copy size={15} />}
                    {copiedId === d.id ? "Copied!" : "Copy comment"}
                  </button>
                  <button onClick={() => handlePosted(d)} disabled={postingId === d.id}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all disabled:opacity-50 ml-auto">
                    {postingId === d.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
                    I’ve posted it
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
