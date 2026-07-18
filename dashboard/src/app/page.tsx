"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, isConfigured } from "@/lib/supabaseClient";

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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data: config } = await supabase.from('config').select('*').single();
      if (config) {
        setIsBotActive(!!config.bot_status);
        setConfigId(config.id);
      }

      const { data: templateData } = await supabase.from('templates').select('*').eq('is_active', true).single();
      if (templateData) {
        setTemplate(templateData.content);
      }

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
      setIsBotActive(!nextStatus);
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

  const getGroupName = (url: string) => {
    if (!url) return 'Unknown Group';
    try {
      const clean = url.replace('https://www.facebook.com/groups/', '').replace('https://www.facebook.com/share/g/', '');
      return clean.split('/')[0] || 'Facebook Group';
    } catch {
      return 'Facebook Group';
    }
  };

  if (!isClient) return null;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(13, 92, 145, 0.2)',
          borderTop: '3px solid #0d5c91',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em' }}>
          Loading Fiesta Dashboard...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--background)',
      color: '#000000',
      padding: '32px 24px 80px 24px',
      fontFamily: 'var(--font-sans), system-ui, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient Background Glow */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0
      }}>
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%', width: '50%', height: '50%',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,92,145,0.05) 0%, transparent 70%)',
          filter: 'blur(80px)'
        }} />
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* ── HEADER ── */}
        <header style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '40px', gap: '24px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <img 
                src="https://www.fiestafreshcleaning.com/assets/logo-CpH5fHWq.jpeg" 
                alt="Fiesta Fresh Logo" 
                style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'contain', border: '1px solid rgba(0,0,0,0.05)' }}
              />
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#0d5c91', background: 'rgba(13,92,145,0.05)', padding: '4px 12px',
                borderRadius: '20px', border: '1px solid rgba(13,92,145,0.1)'
              }}>Automation Engine</span>
            </div>
            <h1 style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 800, letterSpacing: '-0.03em',
              color: '#0d5c91',
              fontFamily: 'var(--font-display), serif',
              lineHeight: 1.2
            }}>
              Fiesta Fresh Cleaning
            </h1>
            <p style={{ color: '#64748b', marginTop: '6px', fontSize: '0.95rem', fontWeight: 500 }}>
              Facebook Lead Generation & Reply Dashboard
            </p>
          </div>

          {/* Bot Controller */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px',
            borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isBotActive ? '#2dd4bf' : '#475569'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#e2e8f0' }}>Bot Controller</span>
            </div>
            <button
              onClick={handleToggleBot}
              style={{
                position: 'relative', width: '56px', height: '28px', borderRadius: '14px',
                border: 'none', cursor: 'pointer', transition: 'all 0.3s ease',
                background: isBotActive
                  ? 'linear-gradient(135deg, #3b82f6, #2dd4bf)'
                  : '#1e293b',
                boxShadow: isBotActive ? '0 0 20px rgba(59,130,246,0.4)' : 'inset 0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              <div style={{
                position: 'absolute', top: '3px',
                left: isBotActive ? '31px' : '3px',
                width: '22px', height: '22px', borderRadius: '50%',
                background: 'white', transition: 'left 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }} />
            </button>
            <span style={{
              fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.1em',
              color: isBotActive ? '#2dd4bf' : '#475569'
            }}>
              {isBotActive ? 'RUNNING' : 'PAUSED'}
            </span>
          </div>
        </header>

        {/* ── PENDING BANNER ── */}
        {stats.pending > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(20,184,166,0.1))',
            border: '1px solid rgba(59,130,246,0.2)', borderRadius: '24px',
            padding: '28px 32px', marginBottom: '32px',
            display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
            alignItems: 'center', gap: '20px',
            boxShadow: '0 8px 32px rgba(59,130,246,0.08)',
            animation: 'float-in 0.5s ease-out'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.25rem', fontWeight: 800, display: 'flex',
                alignItems: 'center', gap: '10px', color: '#f1f5f9'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                You have {stats.pending} pending post{stats.pending > 1 ? 's' : ''} to review!
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>
                Review matches and swipe to approve or deny comments.
              </p>
            </div>
            <Link href="/swipe" style={{
              padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white', fontWeight: 700, fontSize: '0.9rem', borderRadius: '14px',
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,130,246,0.4)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.3)'; }}
            >
              Go to Swipe Deck
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          </div>
        )}

        {/* ── STAT CARDS ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px', marginBottom: '32px'
        }}>
          {[
            { label: 'Pending Review', value: stats.pending, color: '#f59e0b', bgColor: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.15)' },
            { label: 'Total Posted', value: stats.posted, color: '#10b981', bgColor: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.15)' },
            { label: 'Active Groups', value: stats.groups, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' },
          ].map((stat, i) => (
            <div key={i} style={{
              background: stat.bgColor, border: `1px solid ${stat.borderColor}`,
              borderRadius: '20px', padding: '24px', backdropFilter: 'blur(12px)',
              transition: 'all 0.3s ease', cursor: 'default',
              animation: `float-in 0.5s ease-out ${0.1 * (i + 1)}s both`
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = stat.color; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = stat.borderColor; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>{stat.label}</span>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: `${stat.color}15`, display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  {stat.label === 'Pending Review' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  )}
                  {stat.label === 'Total Posted' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  )}
                  {stat.label === 'Active Groups' && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  )}
                </div>
              </div>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 }}>{stat.value}</span>
            </div>
          ))}
        </div>

        {/* ── MAIN CONTENT GRID ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr', gap: '28px'
        }}>
          {/* On larger screens, use CSS media query workaround */}
          <style>{`
            @media (min-width: 768px) {
              .dashboard-grid { grid-template-columns: 3fr 2fr !important; }
            }
          `}</style>
          <div className="dashboard-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr', gap: '28px'
          }}>

            {/* Template Editor */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '24px', padding: '32px', backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              animation: 'float-in 0.5s ease-out 0.4s both'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#f1f5f9' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Primary Reply Copy
                </h2>
                <button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                  style={{
                    padding: '10px 20px', borderRadius: '12px',
                    fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s',
                    background: saveSuccess
                      ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: saveSuccess ? '#10b981' : 'white',
                    border: saveSuccess ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                    boxShadow: saveSuccess ? 'none' : '0 4px 12px rgba(59,130,246,0.2)',
                    opacity: savingTemplate ? 0.7 : 1
                  }}
                >
                  {saveSuccess ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Saved!
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                      </svg>
                      {savingTemplate ? 'Saving...' : 'Save Copy'}
                    </>
                  )}
                </button>
              </div>

              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px', lineHeight: 1.5 }}>
                This message is posted automatically to approved posts when the bot patrols.
              </p>

              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                spellCheck={false}
                placeholder="Write your template copy here..."
                style={{
                  width: '100%', minHeight: '320px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '16px', padding: '20px', color: '#e2e8f0',
                  fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.7,
                  resize: 'vertical', fontFamily: 'inherit',
                  outline: 'none', transition: 'border-color 0.2s',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)'
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              />
            </div>

            {/* Recent Activity */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '24px', padding: '32px', backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
              animation: 'float-in 0.5s ease-out 0.5s both'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#f1f5f9', marginBottom: '24px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Recent Posts Replied To
              </h2>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentActivity.length === 0 ? (
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', padding: '40px 24px',
                    border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '16px',
                    background: 'rgba(255,255,255,0.01)'
                  }}>
                    <p style={{ color: '#475569', fontSize: '0.85rem', lineHeight: 1.6 }}>
                      No comments posted yet. Approve matching posts in the Swipe Deck to start!
                    </p>
                  </div>
                ) : (
                  recentActivity.map((item, i) => (
                    <div key={i} style={{
                      padding: '16px', borderRadius: '16px',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'flex-start', gap: '14px',
                      transition: 'border-color 0.2s'
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(20,184,166,0.15))',
                        border: '1px solid rgba(59,130,246,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 800, color: '#60a5fa', flexShrink: 0
                      }}>FB</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px'
                          }}>
                            {getGroupName(item.group_url)}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#475569', flexShrink: 0 }}>
                            {new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p style={{
                          fontSize: '0.8rem', color: '#64748b', marginTop: '6px',
                          lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden'
                        }}>
                          &ldquo;{item.post_text}&rdquo;
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
    </div>
  );
}
