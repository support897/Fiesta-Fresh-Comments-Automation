"use client";

import React, { useState, useEffect } from 'react';
import { motion, useAnimation, PanInfo } from 'framer-motion';
import { Check, X, ChevronLeft, Loader2 } from 'lucide-react';

type Lead = {
  id: string;
  post_id: string;
  group_url: string;
  post_text: string;
  status: string;
};

export default function SwipePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);

  const controls = useAnimation();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leads');
      const json = await response.json();
      if (json.success && json.data) {
        setLeads(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch leads:", e);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await fetch('/api/leads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' })
      });
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      console.error("Failed to approve lead:", e);
    }
  };

  const handleRejectPrompt = (id: string) => {
    setActiveLeadId(id);
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!activeLeadId) return;
    
    try {
      await fetch('/api/leads/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: activeLeadId, 
          action: 'reject', 
          reason: rejectReason 
        })
      });
      setLeads((prev) => prev.filter((l) => l.id !== activeLeadId));
    } catch (e) {
      console.error("Failed to reject lead:", e);
    }

    setShowRejectModal(false);
    setRejectReason("");
    setActiveLeadId(null);
  };

  const handleDragEnd = async (event: any, info: PanInfo, id: string) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      // Swipe Right -> Approve
      controls.start({ x: 500, opacity: 0 });
      await handleApprove(id);
    } else if (info.offset.x < -threshold) {
      // Swipe Left -> Reject
      controls.start({ x: -500, opacity: 0 });
      handleRejectPrompt(id);
    } else {
      // Snap back
      controls.start({ x: 0, opacity: 1 });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden font-sans">
      <header className="p-4 flex items-center justify-between border-b border-gray-800 bg-gray-900/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold">F</div>
          <h1 className="text-xl font-semibold tracking-tight">Fiesta Swipe</h1>
        </div>
        <span className="text-sm text-gray-400">{leads.length} Pending</span>
      </header>

      <main className="flex-1 relative flex items-center justify-center p-4">
        {leads.length === 0 ? (
          <div className="text-center text-gray-400">
            <h2 className="text-2xl font-bold mb-2">You're caught up!</h2>
            <p>No more pending posts to review.</p>
          </div>
        ) : (
          <div className="relative w-full max-w-sm h-[60vh]">
            {leads.map((lead, index) => {
              const isTop = index === 0;
              return (
                <motion.div
                  key={lead.id}
                  drag={isTop ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDragEnd={(e, info) => isTop && handleDragEnd(e, info, lead.id)}
                  animate={isTop ? controls : { scale: 0.95, opacity: 0.5, y: 20 }}
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className={`absolute inset-0 bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between ${isTop ? 'z-10 cursor-grab active:cursor-grabbing' : 'z-0'}`}
                >
                  <div className="flex-1 overflow-y-auto">
                    <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold mb-4 truncate max-w-full">
                      {lead.group_url.replace('https://www.facebook.com/groups/', '')}
                    </div>
                    <p className="text-lg leading-relaxed text-gray-200">
                      {lead.post_text}
                    </p>
                  </div>
                  
                  {isTop && (
                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-800">
                      <button 
                        onClick={() => handleRejectPrompt(lead.id)}
                        className="w-14 h-14 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 hover:bg-red-500/20 transition-colors"
                      >
                        <X size={28} strokeWidth={2.5} />
                      </button>
                      <button 
                        onClick={() => handleApprove(lead.id)}
                        className="w-14 h-14 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center border border-green-500/20 hover:bg-green-500/20 transition-colors"
                      >
                        <Check size={28} strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900 border border-gray-800 p-6 rounded-3xl w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-bold mb-2">Why reject this post?</h3>
            <p className="text-sm text-gray-400 mb-4">Your feedback helps train the AI to find better leads.</p>
            
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. They want a car cleaner, not a house cleaner."
              className="w-full h-32 bg-gray-950 border border-gray-800 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors mb-4 resize-none"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmReject}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium hover:from-red-600 hover:to-red-700 transition-colors"
              >
                Submit & Reject
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
