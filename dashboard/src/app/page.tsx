"use client";

import React, { useState, useEffect } from "react";
import { supabase, isConfigured } from "@/lib/supabaseClient";
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
  AlertCircle,
  TrendingUp,
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

export default function CommandCenter() {
  const [isBotActive, setIsBotActive] = useState(false);
  const [dryRun, setDryRun] = useState(false);
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();

    // Setup real-time Supabase subscriptions for 24/7 sync
    const leadsChannel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => fetchData()
      )
      .subscribe();

    const configChannel = supabase
      .channel("config-realtime")
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

  const fetchData = async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Config
      const { data: config } = await supabase.from("config").select("*").maybeSingle();
      if (config) {
        setIsBotActive(!!config.bot_status);
        setConfigId(config.id);
      }

      // 2. Fetch Counts
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

      // 3. Fetch Recent Leads Table
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (leadData) {
        setLeads(leadData as LeadItem[]);
      }
    } catch (e) {
      console.error("Error fetching Command Center data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleToggleBot = async () => {
    const nextStatus = !isBotActive;
    setIsBotActive(nextStatus);
    try {
      if (configId) {
        await supabase.from("config").update({ bot_status: nextStatus }).eq("id", configId);
      }
    } catch (e) {
      console.error("Failed to update bot status:", e);
      setIsBotActive(!nextStatus);
    }
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
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header & Operational Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Command Center
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              24/7 VPS Sync
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time operations dashboard for Fiesta Fresh Cleaning comments automation.
          </p>
        </div>

        {/* Global Control Bar */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleManualRefresh}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleToggleBot}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm ${
              isBotActive
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-slate-200 hover:bg-slate-300 text-slate-700"
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isBotActive ? "BOT OPERATIONAL (ON)" : "BOT PAUSED (OFF)"}</span>
          </button>
        </div>
      </div>

      {/* Account Distribution Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">50/50 Multi-Account Rotation</h3>
              <span className="text-[10px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-md font-mono">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Alternating comments 50/50 between <b>Taylor</b> (ilse2taylor@gmail.com) and <b>Ilse</b> (projects.reports.ilse@gmail.com).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-md border border-white/10 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Next Cycle Account: Rotating</span>
        </div>
      </div>

      {/* 4 CEO KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Matched Leads Found
            </span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Search className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : stats.matchedLeads}
            </span>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Live
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            AI-qualified cleaner requests
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Comments Posted
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : stats.postedComments}
            </span>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Auto-Posted
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            200% Guarantee fixed replies sent
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Target FB Groups
            </span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {loading ? "..." : stats.scrapedGroups}
            </span>
            <span className="text-xs font-medium text-indigo-600">Active Target</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Continuous patrol targets
          </p>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Account Health
            </span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              2 Accounts
            </span>
            <span className="text-xs font-medium text-emerald-600">Healthy</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Taylor & Ilse (50/50 Rotation)
          </p>
        </div>
      </div>

      {/* Real-time Stream Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Real-Time Lead Stream
            </h2>
            <p className="text-xs text-slate-500">
              Live feeds of detected posts, AI evaluation results, and auto-replies.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
              {["all", "posted", "approved", "pending"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    statusFilter === status
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "hover:text-slate-900"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search leads or groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 w-48 md:w-64 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Post Snippet</th>
                <th className="py-3.5 px-4">Group Source</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Logged At</th>
                <th className="py-3.5 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading live leads from Supabase...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No matching leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 max-w-md">
                      <p className="font-medium text-slate-900 line-clamp-2">
                        {lead.post_text || "(No text content)"}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ID: {lead.post_id}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] max-w-xs truncate">
                      <a
                        href={lead.group_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>{lead.group_url.replace("https://www.facebook.com/groups/", "")}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ${
                          lead.status === "posted"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : lead.status === "approved"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
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
                      <a
                        href={lead.group_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        View Post <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
