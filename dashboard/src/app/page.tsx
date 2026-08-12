"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  Send,
  Users,
  Compass,
  Power,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity,
  Copy,
  Check,
  X,
  ChevronRight,
  BarChart3,
  Database,
  SlidersHorizontal,
} from "lucide-react";

type LeadItem = {
  id: string;
  post_id: string;
  group_url: string;
  post_text: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const FIXED_REPLY_TEMPLATE = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

export default function CommandCenter() {
  const [isBotActive, setIsBotActive] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);

  const [stats, setStats] = useState({
    matchedLeads: 0,
    postedComments: 0,
    scrapedGroups: 0,
    activeAccounts: 2,
  });

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    // 24/7 Supabase Realtime Channels
    const leadsChannel = supabase
      .channel("leads-realtime-sub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => fetchData()
      )
      .subscribe();

    const configChannel = supabase
      .channel("config-realtime-sub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "config" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(configChannel);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async () => {
    try {
      // Fetch Config
      const { data: config } = await supabase.from("config").select("*").maybeSingle();
      if (config) {
        setIsBotActive(!!config.bot_status);
        setConfigId(config.id);
      }

      // Fetch Counts
      const { count: matchedCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });

      const { count: postedCount } = await supabase
        .from("replies_log")
        .select("*", { count: "exact", head: true });

      const { count: groupCount } = await supabase
        .from("groups")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setStats({
        matchedLeads: matchedCount || 0,
        postedComments: postedCount || 0,
        scrapedGroups: groupCount || 0,
        activeAccounts: 2,
      });

      // Fetch Leads Stream
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (leadData) {
        setLeads(leadData as LeadItem[]);
      }
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchData();
    showToast("Synced with Azure VPS & Supabase database");
  };

  const handleToggleBot = async () => {
    const nextStatus = !isBotActive;
    setIsBotActive(nextStatus);
    try {
      if (configId) {
        await supabase.from("config").update({ bot_status: nextStatus }).eq("id", configId);
        showToast(nextStatus ? "Bot activated 24/7 on Azure VPS" : "Bot paused");
      }
    } catch (e) {
      console.error("Failed to toggle bot:", e);
      setIsBotActive(!nextStatus);
    }
  };

  const handleCopyReply = () => {
    navigator.clipboard.writeText(FIXED_REPLY_TEMPLATE);
    setCopied(true);
    showToast("200% Guarantee Reply copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.post_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.group_url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.post_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-sans">
      {/* Toast Notification Popup */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Main Action Bar (Exact match to reference) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Command Center
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Real-time control and system overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-2xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleToggleBot}
            className={`px-6 py-3 font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-sm transition-all flex items-center gap-2.5 ${
              isBotActive
                ? "bg-[#10b981] hover:bg-emerald-600 text-white"
                : "bg-slate-200 hover:bg-slate-300 text-slate-700"
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isBotActive ? "RUN BOT NOW" : "BOT PAUSED"}</span>
          </button>
        </div>
      </div>

      {/* 4 CEO Metric Cards (Exact match to reference horizontal card row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Leads Found */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="w-14 h-14 bg-blue-50/80 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight block">
              {stats.matchedLeads}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
              TOTAL MATCHES
            </span>
          </div>
        </div>

        {/* Card 2: Comments Posted */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="w-14 h-14 bg-emerald-50/80 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight block">
              {stats.postedComments}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
              COMMENTS POSTED
            </span>
          </div>
        </div>

        {/* Card 3: Active Profiles */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="w-14 h-14 bg-indigo-50/80 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight block">
              {stats.activeAccounts} / 2
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
              ACTIVE PROFILES
            </span>
          </div>
        </div>

        {/* Card 4: Target Groups */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="w-14 h-14 bg-amber-50/80 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div className="text-right">
            <span className="text-4xl font-extrabold text-slate-900 tracking-tight block">
              {stats.scrapedGroups}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
              TARGET GROUPS
            </span>
          </div>
        </div>
      </div>

      {/* Facebook Profile Cookie Status Section (Exact match to reference) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <Database className="w-4 h-4" />
          </div>
          <h2 className="text-xs font-extrabold tracking-widest text-slate-700 uppercase">
            FACEBOOK PROFILE COOKIE STATUS
          </h2>
        </div>

        {/* 2 Profile Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Profile 1: Ilse */}
          <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-extrabold text-slate-700 flex items-center justify-center text-sm shadow-xs">
                I
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Ilse</h3>
                <p className="text-xs text-slate-400 font-medium">projects.reports.ilse@gmail.com</p>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              CONNECTED
            </span>
          </div>

          {/* Profile 2: Taylor */}
          <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-extrabold text-slate-700 flex items-center justify-center text-sm shadow-xs">
                T
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Taylor</h3>
                <p className="text-xs text-slate-400 font-medium">ilse2taylor@gmail.com</p>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              CONNECTED
            </span>
          </div>
        </div>
      </div>

      {/* Real-Time Leads Stream Table (Clean & Spaced) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Real-Time Leads Stream
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Live feed of detected cleaner requests and auto-replies
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              {["all", "posted", "approved", "pending"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3.5 py-1.5 rounded-lg capitalize transition-all ${
                    statusFilter === status
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "hover:text-slate-900"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search leads or groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 w-48 sm:w-60 transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Lead Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="py-3.5 px-6">Post Snippet</th>
                <th className="py-3.5 px-4">Group Source</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Logged At</th>
                <th className="py-3.5 px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No matching leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6 max-w-md">
                      <p className="font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {lead.post_text || "(No text content)"}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: {lead.post_id}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] max-w-xs truncate">
                      <span className="text-slate-600">
                        {lead.group_url.replace("https://www.facebook.com/groups/", "")}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold capitalize ${
                          lead.status === "posted"
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : lead.status === "approved"
                            ? "bg-blue-50 text-blue-600 border border-blue-200"
                            : "bg-amber-50 text-amber-600 border border-amber-200"
                        }`}
                      >
                        {lead.status === "posted" && <CheckCircle2 className="w-3 h-3" />}
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLead(lead);
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Lead Detail Drawer / Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600">
                  LEAD AUDIT DETAILS
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Post ID: {selectedLead.post_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Original Post Content
                </label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 leading-relaxed font-sans max-h-40 overflow-y-auto">
                  {selectedLead.post_text}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Facebook Group Source
                </label>
                <a
                  href={selectedLead.group_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline font-mono text-xs flex items-center gap-1.5"
                >
                  <span>{selectedLead.group_url}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Posted 200% Guarantee Fixed Reply
                  </label>
                  <button
                    onClick={handleCopyReply}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied!" : "Copy Message"}</span>
                  </button>
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-slate-800 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {FIXED_REPLY_TEMPLATE}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <a
                href={selectedLead.group_url}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <span>Open Post on Facebook</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
