"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  RefreshCw,
  Play,
  BarChart3,
  CheckCircle2,
  Users,
  Clock,
  Database,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  X,
  Search,
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
  const [triggering, setTriggering] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();

    // Realtime subscriptions
    const leadsChannel = supabase
      .channel("leads-realtime-sub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
    };
  }, []);

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

      // Fetch Recent Dispatches
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (leadData) {
        setLeads(leadData as LeadItem[]);
      }
    } catch (e) {
      console.error("Error fetching dashboard data:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleTriggerBot = async () => {
    setTriggering(true);
    const nextStatus = !isBotActive;
    setIsBotActive(nextStatus);
    try {
      if (configId) {
        await supabase.from("config").update({ bot_status: nextStatus }).eq("id", configId);
      }
    } catch (e) {
      console.error("Failed to update bot status:", e);
    } finally {
      setTriggering(false);
    }
  };

  const handleCopyReply = () => {
    navigator.clipboard.writeText(FIXED_REPLY_TEMPLATE);
    setCopied(true);
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
    <div className="space-y-8 animate-in fade-in duration-700 font-sans">
      {/* Header & Main Control Actions */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
            Command Center
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Real-time control and system overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleTriggerBot}
            disabled={triggering}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:scale-105 disabled:opacity-50"
          >
            <Play size={16} className="fill-current" />
            <span>{triggering ? "RUNNING BOT..." : isBotActive ? "RUN BOT NOW" : "BOT PAUSED"}</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
            <BarChart3 size={24} className="text-blue-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{stats.matchedLeads}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Posts</div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} className="text-emerald-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{stats.postedComments}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Comments Posted</div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={24} className="text-indigo-600" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">2 / 2</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Profiles</div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-5">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
            <Clock size={24} className="text-amber-500" />
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900">{stats.scrapedGroups}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Groups</div>
          </div>
        </div>
      </div>

      {/* Facebook Profile Cookie Status Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          Facebook Profile Cookie Status
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Profile 1: Ilse */}
          <div className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-slate-700">
                I
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Ilse</h4>
                <p className="text-[10px] text-slate-400">File: 1.json (projects.reports.ilse@gmail.com)</p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
              ● Connected
            </span>
          </div>

          {/* Profile 2: Taylor */}
          <div className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-slate-700">
                T
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Taylor</h4>
                <p className="text-[10px] text-slate-400">File: 2.json (ilse2taylor@gmail.com)</p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
              ● Connected
            </span>
          </div>
        </div>
      </div>

      {/* Recent Post Dispatches Section */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Recent Post Dispatches</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time status feed of latest poster attempts</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              {["all", "posted", "approved", "pending"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    statusFilter === status
                      ? "bg-white text-slate-900 shadow-xs font-bold"
                      : "hover:text-slate-900"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 font-medium"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold uppercase tracking-wider sticky top-0">
                <th className="px-4 py-3">Post Snippet</th>
                <th className="px-4 py-3">Group Target</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3 text-right">Action / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    No post runs completed today.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4 max-w-md font-bold text-slate-800">
                      <p className="line-clamp-2">{lead.post_text || "(No post content)"}</p>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {lead.post_id}</span>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={lead.group_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {lead.group_url.replace("https://www.facebook.com/groups/", "")}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          lead.status === "posted"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : lead.status === "approved"
                            ? "bg-blue-50 text-blue-600 border-blue-100"
                            : "bg-amber-50 text-amber-600 border-amber-100"
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-medium">
                      {new Date(lead.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLead(lead);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl font-bold transition-all text-[11px]"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="relative max-w-2xl w-full bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Post Details & Fixed Reply</h3>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Post Content
                </label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 leading-relaxed font-sans max-h-36 overflow-y-auto">
                  {selectedLead.post_text}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">
                    200% Guarantee Fixed Reply Template
                  </label>
                  <button
                    onClick={handleCopyReply}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied!" : "Copy Text"}</span>
                  </button>
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-slate-800 leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {FIXED_REPLY_TEMPLATE}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <a
                href={selectedLead.group_url}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm"
              >
                <span>View on Facebook</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
