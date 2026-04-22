"use client";

import React, { useState } from "react";

export default function Dashboard() {
  const [isBotActive, setIsBotActive] = useState(false);
  const [template, setTemplate] = useState("Hi there! We are fully insured and police checked, and we would absolutely love to help you out 💙 You can view our prices and book directly in 60 seconds right here: https://www.fiestafreshcleaning.com/book ✨ Or send a direct message to https://www.facebook.com/share/1KZ42C9jSc/?mibextid=wwXIfr 💙\n#FiestaFresh #GoldCoastCleaning #ReliableCleaners #HouseCleaning #BondClean");

  // Mock stats
  const stats = [
    { label: "Replies This Week", value: "24", trend: "+12%" },
    { label: "Total Replies", value: "856", trend: "+3%" },
    { label: "Active Groups", value: "19", trend: "Stable" },
  ];

  return (
    <div className="min-h-screen bg-[#0f1115] text-white p-6 pb-20 sm:p-12 font-[family-name:var(--font-geist-sans)] selection:bg-[#0070f3] selection:text-white">
      {/* Background gradients */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/20 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[150px] mix-blend-screen" />
      </div>

      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300">
              Fiesta Fresh Automation
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Manage your Facebook group reply bot in real-time.</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md shadow-2xl transition-all hover:bg-white/10">
            <span className="font-semibold text-gray-200">Bot Status</span>
            <button 
              onClick={() => setIsBotActive(!isBotActive)}
              className={`relative w-16 h-8 rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0f1115] ${isBotActive ? 'bg-gradient-to-r from-blue-500 to-teal-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-gray-700'}`}
            >
              <span className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ease-in-out ${isBotActive ? 'translate-x-8' : 'translate-x-0'} shadow-sm`} />
            </button>
            <span className={`font-bold ml-2 ${isBotActive ? 'text-teal-400' : 'text-gray-500'}`}>
              {isBotActive ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="group bg-white/[0.03] border border-white/5 rounded-3xl p-6 backdrop-blur-xl shadow-lg transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.05] hover:border-white/20">
              <h3 className="text-gray-400 font-medium mb-2">{stat.label}</h3>
              <div className="flex items-end justify-between">
                <span className="text-4xl font-black text-white">{stat.value}</span>
                <span className={`text-sm font-semibold mb-1 ${stat.trend.startsWith('+') ? 'text-emerald-400' : 'text-gray-500'}`}>
                  {stat.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Template Editor */}
          <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                Reply Template
              </h2>
              <button className="text-sm bg-blue-500/20 text-blue-400 px-4 py-2 rounded-lg font-medium hover:bg-blue-500/30 transition-colors">
                Save Changes
              </button>
            </div>
            
            <p className="text-sm text-gray-400 mb-4">This exact message will be posted as a threaded reply to matching comments.</p>
            
            <textarea 
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full flex-grow min-h-[200px] bg-black/40 border border-white/10 rounded-2xl p-5 text-gray-200 font-medium leading-relaxed resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
              spellCheck="false"
            />
            
            <div className="mt-4 flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Only 💙 allowed</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Max 5 hashtags</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> No dashes</span>
            </div>
          </div>

          {/* Recent Replies Feed */}
          <div className="bg-white/[0.03] border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-3">
              <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Recent Activity
            </h2>
            
            <div className="flex-grow space-y-4 overflow-y-auto pr-2 custom-scrollbar">
              {[
                { name: "John Doe", group: "Gold Coast Community Hub", trigger: "looking for a cleaner", proof: "https://example.com/screenshot1.png", time: "2m ago" },
                { name: "Sarah Smith", group: "Sydney Rental Network", trigger: "bond cleaning", proof: null, time: "1hr ago" },
                { name: "Mike Ross", group: "Logan Residents", trigger: "carpet cleaning", proof: "https://example.com/screenshot2.png", time: "3hr ago" },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-sm font-bold shadow-lg shrink-0">
                    FB
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-semibold text-gray-200">Replied to {item.name}</p>
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest">{item.time}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-1">in "{item.group}"</p>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-[10px] text-teal-400 font-bold uppercase py-1 px-2 bg-teal-400/10 rounded-md">Trigger: "{item.trigger}"</p>
                      {item.proof && (
                        <a 
                          href={item.proof} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-500/40 transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          VIEW PROOF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="mt-6 w-full py-3 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 hover:text-white transition-colors">
              View All History
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}
