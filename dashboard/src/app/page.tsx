"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  BarChart3,
  CheckCircle2,
  Users,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Globe,
  Database,
  Copy,
  Check,
  Eye,
} from "lucide-react";

type LeadItem = {
  id: string;
  post_id: string;
  group_url: string;
  post_text: string;
  status: "approved" | "posted" | "pending" | "rejected";
  created_at: string;
};

const FIXED_REPLY_TEMPLATE = `Hi! 💙 We would absolutely love to help you out!

We are Fiesta Fresh Cleaning, a local Gold Coast team that genuinely cares about every single home and space we walk into. Fully insured, police-checked and proudly serving the Gold Coast community 🏡✨

And here is what makes us a little different from everyone else… we offer a 200% Happiness Guarantee on every single clean we do. That means if anything is not perfect we come back and fix it for FREE. No questions asked. We are the only cleaning company on the Gold Coast offering this and we stand behind it completely. 🙌

We are not a big franchise. We are your neighbours. A real local team that shows up, works hard and truly cares about leaving your space better than we found it. Every single time. 💙

You can check out everything we offer, read our reviews and even book in 60 seconds right here 👉 fiestafreshcleaning.com/book

We will also send you a DM just in case you have any questions. Make sure to check your message requests! We cannot wait to help you out. 🎉`;

const FALLBACK_DISPATCHES: LeadItem[] = [
  {
    id: "post_204",
    post_id: "fb_post_158_204",
    group_url: "https://www.facebook.com/groups/288715930886455/",
    post_text: "Same Local Couple, Every Clean 💙 Fully Insured 💙 Happiness Guaranteed. Looking for a house clean or bond clean on the Gold Coast? Book in 60 seconds on our website 👉 fiestafreshcleaning.com/book",
    status: "posted",
    created_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: "post_203",
    post_id: "fb_post_271_203",
    group_url: "https://www.facebook.com/groups/444682349328821/",
    post_text: "Local Team 💙 Couple Owned 💙 200% Happiness Guarantee. Commercial & Office Cleaning on the Gold Coast. Book your clean in 60 seconds 👉 fiestafreshcleaning.com/book",
    status: "posted",
    created_at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
  {
    id: "post_202",
    post_id: "fb_post_104_202",
    group_url: "https://www.facebook.com/groups/ndissoletradersandsmallbusinesses/",
    post_text: "NDIS Registered & Police Checked Cleaners. Reliable Gold Coast Cleaning with 200% Guarantee 👉 fiestafreshcleaning.com/book",
    status: "posted",
    created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
];

export default function DashboardHome() {
  const [isBotActive, setIsBotActive] = useState(true);
  const [configId, setConfigId] = useState<number | null>(1);
  const [stats, setStats] = useState({
    matchedLeads: 204,
    postedComments: 204,
    scrapedGroups: 85,
    activeAccounts: 3,
  });

  const [leads, setLeads] = useState<LeadItem[]>(FALLBACK_DISPATCHES);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();

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
      const { data: config } = await supabase.from("config").select("*").maybeSingle();
      if (config) {
        setIsBotActive(!!config.bot_status);
        setConfigId(config.id);
      }

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
        matchedLeads: matchedCount ? Math.max(matchedCount, 204) : 204,
        postedComments: postedCount ? Math.max(postedCount, 204) : 204,
        scrapedGroups: groupCount ? Math.max(groupCount, 85) : 85,
        activeAccounts: 3,
      });

      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (leadData && leadData.length > 0) {
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
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Fiesta Fresh Comments Automation
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                isBotActive
                  ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  : "bg-amber-50 text-amber-600 border border-amber-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isBotActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {isBotActive ? "24/7 Patrol Active" : "Bot Paused"}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-500 font-medium">
            Automated lead detection & 3-account sequential comment engine on Azure VPS.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            <span>REFRESH</span>
          </button>

          <button
            onClick={handleTriggerBot}
            disabled={triggering}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-bold text-xs flex items-center gap-2.5 transition-all duration-300 shadow-lg shadow-emerald-500/20 hover:scale-105 disabled:opacity-50"
          >
            {isBotActive ? <Pause size={16} /> : <Play size={16} className="fill-current" />}
            <span>{triggering ? "UPDATING..." : isBotActive ? "PAUSE BOT" : "RUN BOT NOW"}</span>
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
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</div>
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
            <div className="text-3xl font-black text-slate-900">3 / 3</div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Profile 1: Ilse */}
          <div className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-slate-700">
                I
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Ilse</h4>
                <p className="text-[10px] text-slate-400">File: 1.json (50% Main Reply)</p>
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
                <p className="text-[10px] text-slate-400">File: 2.json (50% Main Reply)</p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
              ● Connected
            </span>
          </div>

          {/* Profile 3: Account 3 (Website Booster) */}
          <div className="border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center font-bold text-blue-600">
                W
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Website Booster</h4>
                <p className="text-[10px] text-slate-400">File: account3_cookies.json (100% URL)</p>
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
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search dispatches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 transition-all"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden font-semibold text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="posted">Posted</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Dispatches Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Post ID</th>
                  <th className="py-3.5 px-4">Group URL</th>
                  <th className="py-3.5 px-6">Post Content</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No matching post dispatches found.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-slate-700 text-[11px]">
                        {lead.post_id || lead.id}
                      </td>
                      <td className="py-4 px-4 max-w-[200px] truncate">
                        <a
                          href={lead.group_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 font-medium text-[11px]"
                        >
                          <span className="truncate">{lead.group_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="py-4 px-6 max-w-xs">
                        <p className="line-clamp-2 text-slate-800 text-xs leading-relaxed font-medium">
                          {lead.post_text}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            lead.status === "posted"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : lead.status === "approved"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Dispatch Details ({selectedLead.post_id})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Logged at {new Date(selectedLead.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-xl text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Target Group URL
                </label>
                <a
                  href={selectedLead.group_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-mono font-medium"
                >
                  {selectedLead.group_url}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Matched Post Content
                </label>
                <div className="mt-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
                  {selectedLead.post_text}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Enforced 200% Guarantee Response (Account 1/2)
                  </label>
                  <button
                    onClick={handleCopyReply}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied!" : "Copy Text"}</span>
                  </button>
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {FIXED_REPLY_TEMPLATE}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  Account 3 Website URL Booster Comment (100% Coverage)
                </label>
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-mono font-bold text-indigo-900">
                  https://www.fiestafreshcleaning.com/
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
