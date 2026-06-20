"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Check, MessageSquare, Loader, Sparkles, AlertCircle, Info, RefreshCw, Home } from 'lucide-react';
import { supabase, isConfigured } from '@/lib/supabaseClient';
import Link from 'next/link';

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
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Custom Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Swipe gesture state
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mouseStartX, setMouseStartX] = useState<number | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLeads = async () => {
    if (isSyncing) return;
    try {
      if (!isConfigured) {
        console.warn("Supabase client is not fully configured (missing env variables).");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setLeads(data);
      }
    } catch (err) {
      console.error("Error fetching leads from Supabase:", err);
      showToast("Could not connect to database.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    fetchLeads();
    const interval = setInterval(fetchLeads, 6000);
    return () => clearInterval(interval);
  }, []);

  if (!isClient) return null; // Avoid hydration mismatch

  const currentLead = leads[0]; // Active lead to review

  const updateLeadStatus = async (leadId: string, newStatus: 'approved' | 'rejected', rejectionReason?: string) => {
    setIsSyncing(true);

    // Optimistic UI update - filter out the card immediately
    const remainingLeads = leads.filter(l => l.id !== leadId);
    setLeads(remainingLeads);

    try {
      if (!supabase) throw new Error("Supabase not initialized");

      // 1. Update lead status
      const { error: updateError } = await supabase
        .from('leads')
        .update({ 
          status: newStatus, 
          updated_at: new Date().toISOString(),
          rejection_reason: rejectionReason || null
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // 2. If rejected and has reason, insert into AI Memory for training
      if (newStatus === 'rejected' && rejectionReason?.trim()) {
        const { error: aiError } = await supabase
          .from('ai_memory')
          .insert({
            rule_text: rejectionReason.trim(),
            created_at: new Date().toISOString()
          });
        
        if (aiError) {
          console.error("AI memory log failed:", aiError);
        } else {
          showToast("AI trained from rejection! 🧠", "info");
        }
      } else if (newStatus === 'approved') {
        showToast("Lead approved! Comment queued. 💙", "success");
      }
    } catch (err) {
      console.error("Error updating lead status:", err);
      showToast("Sync error — reloading queue.", "error");
      fetchLeads(); // Reload real state
    } finally {
      setTimeout(() => setIsSyncing(false), 2000);
    }
  };

  const handleApprove = () => {
    if (currentLead) {
      updateLeadStatus(currentLead.id, 'approved');
    }
  };

  const handleReject = () => {
    setFeedbackError(false);
    setShowFeedback(true);
  };

  const submitFeedback = () => {
    if (!feedbackText.trim()) {
      setFeedbackError(true);
      return;
    }
    if (currentLead) {
      updateLeadStatus(currentLead.id, 'rejected', feedbackText.trim());
    }
    setShowFeedback(false);
    setFeedbackText('');
    setFeedbackError(false);
  };

  // Touch gesture handlers (Mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (showFeedback || loading) return;
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null || showFeedback || loading) return;
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      e.preventDefault();
      setSwipeOffset(diffX);
      if (diffX > 40) {
        setSwipeDirection('right');
      } else if (diffX < -40) {
        setSwipeDirection('left');
      } else {
        setSwipeDirection(null);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || showFeedback || loading) return;
    if (swipeOffset > 110) {
      handleApprove();
    } else if (swipeOffset < -110) {
      handleReject();
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setSwipeOffset(0);
    setSwipeDirection(null);
  };

  // Mouse drag handlers (Desktop fallback)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (showFeedback || loading) return;
    setIsMouseDown(true);
    setMouseStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || mouseStartX === null || showFeedback || loading) return;
    const diffX = e.clientX - mouseStartX;
    setSwipeOffset(diffX);
    if (diffX > 40) {
      setSwipeDirection('right');
    } else if (diffX < -40) {
      setSwipeDirection('left');
    } else {
      setSwipeDirection(null);
    }
  };

  const handleMouseUp = () => {
    if (!isMouseDown || mouseStartX === null || showFeedback || loading) return;
    if (swipeOffset > 110) {
      handleApprove();
    } else if (swipeOffset < -110) {
      handleReject();
    }
    setIsMouseDown(false);
    setMouseStartX(null);
    setSwipeOffset(0);
    setSwipeDirection(null);
  };

  // Styles
  const cardStyle: React.CSSProperties = {
    width: '92%',
    height: '65%',
    maxWidth: '420px',
    maxHeight: '580px',
    borderRadius: '28px',
    position: 'relative',
    boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.7)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    transform: `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.03}deg)`,
    transition: touchStartX !== null || isMouseDown ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2)',
    cursor: isMouseDown ? 'grabbing' : 'grab',
    touchAction: 'none',
    userSelect: 'none',
    backgroundColor: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  const stampStyle = (type: 'like' | 'nope'): React.CSSProperties => ({
    position: 'absolute',
    top: '30px',
    [type === 'like' ? 'left' : 'right']: '30px',
    border: `4px solid ${type === 'like' ? '#10B981' : '#EF4444'}`,
    color: type === 'like' ? '#10B981' : '#EF4444',
    padding: '8px 18px',
    borderRadius: '12px',
    fontSize: '1.8rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    transform: `rotate(${type === 'like' ? -12 : 12}deg)`,
    opacity: type === 'like' 
      ? Math.min(Math.max(swipeOffset / 90, 0), 1) 
      : Math.min(Math.max(-swipeOffset / 90, 0), 1),
    transition: 'opacity 0.05s ease-out',
    zIndex: 100,
    textShadow: '0 0 8px rgba(0,0,0,0.5)',
    boxShadow: `0 0 12px ${type === 'like' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
  });

  // Safe formatting for Facebook group URLs
  const getGroupName = (url: string) => {
    if (!url) return 'Unknown Group';
    try {
      const clean = url.replace('https://www.facebook.com/groups/', '').replace('https://www.facebook.com/share/g/', '');
      return clean.split('/')[0] || 'Facebook Group';
    } catch {
      return 'Facebook Group';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'radial-gradient(circle at top, #1e293b, #030712)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Keyframe Injection */}
      <style>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Toast Alerts */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : toast.type === 'info' ? 'rgba(59, 130, 246, 0.95)' : 'rgba(239, 68, 68, 0.95)',
          backdropFilter: 'blur(10px)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '14px',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          zIndex: 999999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
          animation: 'slideDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          maxWidth: '90%'
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(15,23,42,0.8), transparent)',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 10
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'linear-gradient(to tr, #3b82f6, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.95rem',
            fontWeight: 800
          }}>F</div>
          <div style={{fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em'}}>Fiesta Comments</div>
        </div>
        
        <div style={{display: 'flex', gap: '8px'}}>
          {/* Back Home Button */}
          <Link href="/" style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#cbd5e1'
          }}>
            <Home size={16} />
          </Link>
          
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: '#cbd5e1',
            display: 'flex',
            alignItems: 'center'
          }}>
            {leads.length > 0 ? `${leads.length} pending` : 'Inbox Clean'}
          </div>
        </div>
      </div>

      {/* Swipe Card */}
      <div 
        style={cardStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Approve/Reject Stamps */}
        {swipeOffset > 0 && <div style={stampStyle('like')}>Approve</div>}
        {swipeOffset < 0 && <div style={stampStyle('nope')}>Reject</div>}

        {loading ? (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8'}}>
            <Loader size={32} style={{marginBottom: '12px', animation: 'spinSlow 1.5s linear infinite'}} />
            <p style={{fontSize: '0.85rem'}}>Fetching pending posts...</p>
          </div>
        ) : currentLead ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '28px 24px',
            position: 'relative'
          }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                marginBottom: '18px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <Sparkles size={12} />
                {getGroupName(currentLead.group_url)}
              </div>
              
              <div style={{
                fontSize: '1.15rem',
                lineHeight: '1.65',
                color: '#e2e8f0',
                fontWeight: 500,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {currentLead.post_text}
              </div>
            </div>

            {/* Bottom Card Bar */}
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                CRITICAL CHECK: Posting ONLY the Master 200% Guarantee Template
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Swipe right to Approve • Swipe left to Reject
              </span>
            </div>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '32px'}}>
            <div style={{fontSize: '3.5rem', marginBottom: '16px'}}>🏡✨</div>
            <h2 style={{fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', color: '#f8fafc'}}>All Cleaned Up!</h2>
            <p style={{color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5', maxWidth: '280px'}}>
              You're caught up. New Facebook posts matching your keywords will appear here automatically.
            </p>
          </div>
        )}
      </div>

      {/* Button Controls */}
      {currentLead && !showFeedback && !loading && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          marginTop: '28px',
          zIndex: 10
        }}>
          {/* Reject Button */}
          <button 
            onClick={handleReject}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(239,68,68,0.15)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              color: '#f87171'
            }}
          >
            <X size={28} strokeWidth={2.5} />
          </button>
          
          {/* Approve Button */}
          <button 
            onClick={handleApprove}
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '2px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(16,185,129,0.15)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              color: '#34d399'
            }}
          >
            <Check size={28} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* Slide up feedback panel */}
      {currentLead && showFeedback && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '50%',
            backgroundColor: '#0f172a',
            borderTopLeftRadius: '32px',
            borderTopRightRadius: '32px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '24px',
            boxShadow: '0 -15px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 99999,
            animation: 'slideUpSheet 0.3s ease-out forwards'
          }}
        >
          <div style={{
            width: '36px',
            height: '4px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '2px',
            alignSelf: 'center',
            marginBottom: '16px'
          }} />
          
          <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc'}}>
            <MessageSquare size={20} color="#60a5fa"/> Train AI Memory
          </h3>
          
          <p style={{fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px'}}>
            Tell the bot why this post was rejected (e.g. "Looking for carpet cleaner, we only do house cleans"). The AI uses this feedback to filter similar posts in the future.
          </p>
          
          <textarea 
            value={feedbackText}
            onChange={(e) => { setFeedbackText(e.target.value); setFeedbackError(false); }}
            placeholder="e.g. They are asking for commercial cleaners or a different state outside Gold Coast..."
            style={{
              flex: 1,
              backgroundColor: '#020617',
              border: feedbackError ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '14px',
              color: 'white',
              fontSize: '0.95rem',
              resize: 'none',
              marginBottom: '16px',
              fontFamily: 'inherit',
              outline: 'none',
              boxShadow: feedbackError ? '0 0 0 2px rgba(239,68,68,0.2)' : 'none'
            }}
          />
          
          {feedbackError && (
            <div style={{
              color: '#f87171',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginTop: '-12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <AlertCircle size={14} /> Rejection feedback is required to train the bot.
            </div>
          )}
          
          <div style={{display: 'flex', gap: '12px'}}>
            <button 
              onClick={() => setShowFeedback(false)}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#cbd5e1',
                padding: '14px',
                borderRadius: '14px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              onClick={submitFeedback}
              style={{
                flex: 1,
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '14px',
                borderRadius: '14px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239,68,68,0.2)'
              }}
            >
              Train & Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
