"use client";

import React from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  Calendar,
  FileText,
  Compass,
  Image as ImageIcon,
  Bell,
  AlertTriangle,
  Cookie,
} from "lucide-react";

const HEARTBEAT_KEY = "__heartbeat__";
const HEARTBEAT_STALE_SECONDS = 300;

export function Sidebar() {
  const pathname = usePathname();
  const [vpsOnline, setVpsOnline] = React.useState(false);
  const [vpsLastSeen, setVpsLastSeen] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("cookies, updated_at")
        .eq("user_email", HEARTBEAT_KEY)
        .maybeSingle();
      if (cancelled) return;
      const beat = Array.isArray(data?.cookies) ? (data!.cookies as any[])[0] : null;
      const ts: string | null = beat?.ts ?? data?.updated_at ?? null;
      setVpsLastSeen(ts);
      setVpsOnline(!!ts && (Date.now() - new Date(ts).getTime()) / 1000 < HEARTBEAT_STALE_SECONDS);
    };
    check();
    const iv = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const navSections = [
    {
      title: "Operations Center",
      items: [
        { name: "Command Center", href: "/", icon: LayoutDashboard },
        { name: "URL Gallery", href: "/proof", icon: Link2 },
        { name: "Schedule Manager", href: "/schedule", icon: Calendar },
      ],
    },
    {
      title: "FB Poster & Rules",
      items: [
        { name: "Post Templates", href: "/templates", icon: FileText },
        { name: "Facebook Groups", href: "/groups", icon: Compass },
        { name: "Cookies 🍪", href: "/cookies", icon: Cookie },
        { name: "Photo Library", href: "/photos", icon: ImageIcon },
        { name: "Notifications", href: "/notifications", icon: Bell },
        { name: "System Errors", href: "/errors", icon: AlertTriangle },
      ],
    },
  ];

  return (
    <aside className="w-64 h-screen flex flex-col bg-white border-r border-slate-200 select-none flex-shrink-0">
      {/* Brand Header */}
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img
              src="https://www.fiestafreshcleaning.com/assets/logo-CpH5fHWq.jpeg"
              alt="Fiesta Fresh Logo"
              className="w-9 h-9 rounded-xl object-contain shadow-xs border border-slate-100"
            />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-800 leading-tight">
                Fiesta Fresh
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Cleaning Services
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-8">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            <h2 className="px-2 text-[10px] font-bold tracking-widest text-blue-600 uppercase mb-3">
              {section.title}
            </h2>
            <nav className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group text-sm font-medium ${
                      isActive
                        ? "bg-blue-50 text-blue-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive
                          ? "text-blue-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Version */}
      <div className="p-4 border-t border-slate-100 flex flex-col gap-2 bg-white">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-widest px-2">
          <span>Version 1.2.0</span>
          <span
            title={vpsLastSeen ? `Last heartbeat: ${new Date(vpsLastSeen).toLocaleString("en-AU")}` : "No heartbeat recorded"}
            className={`flex items-center gap-1 font-bold lowercase ${vpsOnline ? "text-emerald-600" : "text-red-600"}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${vpsOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
            {vpsOnline ? "vps live" : "vps offline"}
          </span>
        </div>
      </div>
    </aside>
  );
}
