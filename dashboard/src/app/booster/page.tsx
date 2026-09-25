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
  Rocket, Loader2, ChevronDown,
} from "lucide-react";

type BoosterItem = QueueRow & { derived: boolean };

export default function BoosterPage() {
  const [items, setItems] = useState<BoosterItem[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedPost, setCopiedPost] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: acc3rows }, { data: acc2posted }, { data: trows }] = await Promise.all([
      supabase.from("comment_queue").select("*")
        .eq("account", "acc3").eq("status", "draft_ready")
        .order("created_at", { ascending: false }),
      supabase.from("comment_queue").select("*")
        .eq("account", "acc2").eq("status", "posted")
        .order("posted_at", { ascending: false }).limit(200),
      supabase.from("service_types").select("*").order("sort_order"),
    ]);
    const a3 = (acc3rows ?? []) as QueueRow[];
    const a3Ids = new Set(a3.map((r) => r.post_id));
    // Fallback: Account 2 confirmed posted but the booster row never got
    // created (e.g. a network hiccup) — still show it so nothing is lost.
    const derived: BoosterItem[] = ((acc2posted ?? []) as QueueRow[])
      .filter((r) => !a3Ids.has(r.post_id))
      .map((r) => ({ ...r, account: "acc3" as const, comment_text: ACC3_URL, status: "draft_ready", derived: true }));
    setItems([...a3.map((r) => ({ ...r, derived: false })), ...derived]);
    setTypes((trows ?? []) as ServiceType[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyUrl = async () => {
    if (await copyText(ACC3_URL)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyForPost = async (item: BoosterItem) => {
    if (await copyText(ACC3_URL)) {
      setCopiedPost(item.id);
      setTimeout(() => setCopiedPost(null), 2000);
    }
  };

  const handlePosted = async (item: BoosterItem) => {
    if (!window.confirm("Mark the Account 3 URL comment as posted?\nThe post moves to the Commented archive.")) return;
    setPostingId(item.id);
    try {
      const now = new Date().toISOString();
      if (item.derived) {
        const { error } = await supabase.from("comment_queue").insert({
          post_id: item.post_id, account: "acc3", group_url: item.group_url,
          post_text: item.post_text, service_type: item.service_type,
          comment_text: ACC3_URL, permalink: item.permalink,
          status: "posted", posted_at: now,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("comment_queue")
          .update({ status: "posted", posted_at: now, updated_at: now })
          .eq("id", item.id);
        if (error) throw error;
      }
      setItems((prev) => prev.filter((x) => x.id !== item.id));
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
            Booster
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-2xl">
            After the main comment is live, <b>Account 3 (Website Booster)</b> drops the website link.
            Same rule: open the post, paste, Enter — then tap <b>“I’ve posted it”</b>.
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all">
          <RefreshCw size={16} className={cn(loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {/* Static instruction + URL */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl p-5 md:p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Rocket size={18} />
          <h3 className="font-bold text-sm uppercase tracking-widest">Every booster comment is identical</h3>
        </div>
        <p className="text-sm text-violet-100 leading-relaxed">
          Open the post below <b>as Account 3</b>, paste the website URL as the comment and press Enter.
          That’s it — no other text, no names, no emojis.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <code className="flex-1 min-w-[200px] bg-white/15 border border-white/20 rounded-xl px-4 py-3 text-sm font-mono break-all">
            {ACC3_URL}
          </code>
          <button onClick={copyUrl}
            className={cn("flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all",
              copied ? "bg-emerald-400 text-emerald-950" : "bg-white text-violet-700 hover:bg-violet-50")}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied!" : "Copy URL"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 animate-pulse">
          {[...Array(2)].map((_, i) => <div key={i} className="h-36 bg-slate-200 rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center">
          <Rocket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800">Nothing waiting for a boost</h3>
          <p className="text-sm text-slate-500 mt-1">Posts appear here after you confirm the Account 2 comment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => {
            const meta = SERVICE_TYPE_META[item.service_type] ?? SERVICE_TYPE_META.home;
            const expanded = expandedId === item.id;
            return (
              <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", meta.badge)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                    {typeLabel(item.service_type, types)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{groupNameFromUrl(item.group_url)}</span>
                  <span className="text-xs text-slate-400">· acc2 posted {agoLabel(item.posted_at)}</span>
                </div>

                <button onClick={() => setExpandedId(expanded ? null : item.id)} className="w-full text-left">
                  <p className={cn("text-sm text-slate-700 leading-relaxed", !expanded && "line-clamp-2")}>
                    {item.post_text}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 mt-1">
                    {expanded ? "Show less" : "Read full post"} <ChevronDown size={12} className={cn(expanded && "rotate-180")} />
                  </span>
                </button>

                <div className="flex flex-wrap gap-2 mt-4">
                  <a href={item.permalink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all">
                    <ExternalLink size={15} /> Open post
                  </a>
                  <button onClick={() => copyForPost(item)}
                    className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all",
                      copiedPost === item.id ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
                    {copiedPost === item.id ? <Check size={15} /> : <Copy size={15} />}
                    {copiedPost === item.id ? "Copied!" : "Copy URL"}
                  </button>
                  <button onClick={() => handlePosted(item)} disabled={postingId === item.id}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all disabled:opacity-50 ml-auto">
                    {postingId === item.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCheck size={15} />}
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
