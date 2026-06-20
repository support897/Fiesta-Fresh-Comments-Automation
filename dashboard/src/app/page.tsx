"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Activity, MessageSquare, Layers, Power, Save, ChevronRight, Check } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type StatItem = {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
};

type ActivityItem = {
  group_url: string;
  post_text: string;
  updated_at: string;
};

export default function Dashboard() {
  const [isBotActive, setIsBotActive] = useState(false);
  const [template, setTemplate] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, posted: 0, groups: 0 });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Get Config
      const { data: config } = await supabase.from('config').select('*').single();
      if (config) {
        setIsBotActive(!!config.bot_status);
        setConfigId(config.id);
      }

      // 2. Get Template
      const { data: templateData } = await supabase.from('templates').select('*').eq('is_active', true).single();
      if (templateData) {
        setTemplate(templateData.content);
      }

      // 3. Get Stats counts
      const { count: total } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      const { count: pending } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      const { count: approved } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'approved');
      const { count: posted } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'posted');
      const { count: groups } = await supabase.from('groups').select('*', { count: 'exact', head: true }).eq('is_active', true);

      setStats({
        total: total || 0,
        pending: pending || 0,
        approved: approved || 0,
        posted: posted || 0,
        groups: groups || 0
      });

      // 4. Get Recent Activity
      const { data: recent } = await supabase
        .from('leads')
        .select('group_url, post_text, updated_at')
        .eq('status', 'posted')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (recent) {
        setRecentActivity(recent as ActivityItem[]);
      }
    } catch (e) {
      console.error("Error loading dashboard stats:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async () => {
    const nextStatus = !isBotActive;
    setIsBotActive(nextStatus);
    try {
      if (configId) {
        await supabase.from('config').update({ bot_status: nextStatus }).eq('id', configId);
      }
    } catch (e) {
      console.error("Failed to toggle bot status:", e);
      setIsBotActive(!nextStatus); // Revert UI
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from('templates').update({ content: template }).eq('is_active', true);
      if (!error) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Failed to save template:", e);
    } finally {
      setSavingTemplate(false);
    }
  };

  const statItems: StatItem[] = [
    { 
      label: "Pending Review", 
      value: stats.pending, 
      icon: <Layers className="w-5 h-5 text-amber-400" />,
      color: "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/30"
    },
    { 
      label: "Total Posted", 
      value: stats.posted, 
      icon: <MessageSquare className="w-5 h-5 text-emerald-400" />,
      color: "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30"
    },
    { 
      label: "Active Groups", 
      value: stats.groups, 
      icon: <Activity className="w-5 h-5 text-blue-400" />,
      color: "border-blue-500/20 bg-blue-500/5 hover:border-blue-500/30"
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090b11] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400 text-sm font-semibold tracking-wide">Loading Fiesta Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090b11] text-white p-6 pb-20 sm:p-12 font-sans selection:bg-[#0070f3] selection:text-white">
      {/* Background gradients */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[130px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[150px] mix-blend-screen" />
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </span>
              <span className="text-xs font-bold tracking-widest text-blue-400 uppercase">Automation Engine</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-400 to-teal-300 mt-2">
              Fiesta Fresh Cleaning
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Facebook Lead Generation & Reply Dashboard.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-4 rounded-2xl backdrop-blur-md shadow-2xl transition-all hover:bg-white/10">
            <span className="font-semibold text-gray-200 flex items-center gap-2">
              <Power className={`w-4 h-4 ${isBotActive ? 'text-teal-400 animate-pulse' : 'text-gray-500'}`} />
              Bot Controller
            </span>
            <button 
              onClick={handleToggleBot}
              className={`relative w-16 h-8 rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#090b11] ${isBotActive ? 'bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-gray-700'}`}
            >
              <span className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ease-in-out ${isBotActive ? 'translate-x-8' : 'translate-x-0'} shadow-sm`} />
            </button>
            <span className={`font-bold ml-1 text-sm ${isBotActive ? 'text-teal-400' : 'text-gray-500'}`}>
              {isBotActive ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>
        </header>

        {/* Swipe Callout */}
        {stats.pending > 0 && (
          <div className="bg-gradient-to-r from-blue-600/30 to-teal-600/20 border border-blue-500/30 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers className="text-blue-400 w-5 h-5" />
                You have {stats.pending} pending post{stats.pending > 1 ? 's' : ''} to review!
              </h2>
              <p className="text-gray-300 text-sm mt-1">Review matches and swipe to approve or deny comments.</p>
            </div>
            <Link 
              href="/swipe" 
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/25 shrink-0"
            >
              Go to Swipe Deck
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {statItems.map((stat, i) => (
            <div key={i} className={`group border rounded-3xl p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 ${stat.color}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-gray-400 font-medium text-sm">{stat.label}</h3>
                {stat.icon}
              </div>
              <span className="text-4xl font-extrabold text-white">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Template Editor */}
          <div className="lg:col-span-3 bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  Primary Reply Copy
                </h2>
                <button 
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                  className={`text-sm py-2.5 px-4 rounded-xl font-semibold flex items-center gap-2 transition-all ${saveSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500 hover:bg-blue-600 active:scale-95 text-white shadow-md shadow-blue-500/10'}`}
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {savingTemplate ? "Saving..." : "Save Copy"}
                    </>
                  )}
                </button>
              </div>
              
              <p className="text-sm text-gray-400 mb-4">This message is posted automatically to approved posts when the bot patrols.</p>
              
              <textarea 
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full min-h-[320px] bg-black/40 border border-white/10 rounded-2xl p-5 text-gray-200 font-medium leading-relaxed resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                spellCheck="false"
                placeholder="Write your template copy here..."
              />
            </div>
          </div>

          {/* Recent Replies Feed */}
          <div className="lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-3">
              <Activity className="w-5 h-5 text-teal-400" />
              Recent Posts Replied To
            </h2>
            
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {recentActivity.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                  <p className="text-sm text-gray-500">No comments posted yet. Approve matching posts in the Swipe Deck to execute them!</p>
                </div>
              ) : (
                recentActivity.map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-teal-400/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0 shadow-sm">
                      FB
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold text-gray-200 uppercase tracking-wide truncate max-w-[150px]">
                          {item.group_url.replace('https://www.facebook.com/share/g/', '').replace('https://www.facebook.com/groups/', '').split('/')[0]}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(item.updated_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-3 mt-1.5 leading-relaxed">
                        "{item.post_text}"
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
