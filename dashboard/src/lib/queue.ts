"use client";

import { supabase } from "@/lib/supabaseClient";

/** The static comment Account 3 drops on every post. */
export const ACC3_URL = "https://www.fiestafreshcleaning.com/";

export type ServiceType = {
  key: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

export type QueueRow = {
  id: string;
  post_id: string;
  account: "acc2" | "acc3";
  group_url: string;
  post_text: string;
  service_type: string;
  comment_text: string;
  permalink: string;
  status: string;
  created_at: string;
  posted_at: string | null;
};

/** Badge styling per clean type. */
export const SERVICE_TYPE_META: Record<string, { label: string; badge: string; dot: string }> = {
  bond:       { label: "Bond Cleaning",        badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-500" },
  carpet:     { label: "Carpet Cleaning",      badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  builders:   { label: "Builders Clean",       badge: "bg-orange-100 text-orange-700",   dot: "bg-orange-500" },
  commercial: { label: "Commercial Cleaning",  badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-500" },
  home:       { label: "Home Cleaning",        badge: "bg-pink-100 text-pink-700",        dot: "bg-pink-500" },
};

export const TYPE_DESCRIPTIONS: Record<string, string> = {
  bond: "End-of-lease / vacate cleans. Uses the Bond template with the 200% Happiness Guarantee.",
  carpet: "Carpet, rug, upholstery and stain-removal work. Uses the General template.",
  builders: "Post-construction and renovation cleans. Uses the General template.",
  commercial: "Office, retail and workplace cleaning. Uses the General template.",
  home: "Residential / domestic cleaning. Currently off — no drafts are created while off.",
};

export function typeLabel(key: string, types: ServiceType[]): string {
  return types.find((t) => t.key === key)?.label
      ?? SERVICE_TYPE_META[key]?.label
      ?? key;
}

export function agoLabel(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** "https://www.facebook.com/groups/123456" → "Group 123456"; vanity → the vanity name. */
export function groupNameFromUrl(url: string): string {
  const m = /\/groups\/([^/?#]+)/.exec(url || "");
  if (!m) return "Facebook group";
  return /^\d+$/.test(m[1]) ? `Group ${m[1].slice(0, 8)}…` : m[1].replace(/[-_]/g, " ");
}

/** Brisbane-time start of the current week (Monday 00:00). */
export function brisbaneWeekStart(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Australia/Brisbane" })
  );
  const day = (now.getDay() + 6) % 7; // Monday = 0
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - day);
  return now;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / non-secure contexts
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* noop */ }
    document.body.removeChild(ta);
    return ok;
  }
}
