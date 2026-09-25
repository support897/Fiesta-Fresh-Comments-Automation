"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Compass,
  FileText,
  Cookie,
  ClipboardList,
  Rocket,
  CheckCheck,
  Tags,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import "./globals.css";

const HEARTBEAT_KEY = "__heartbeat__";
const HEARTBEAT_STALE_SECONDS = 300;

/** Live VPS status from the bot's Supabase heartbeat (was a hardcoded "24/7" badge). */
function VpsBadge() {
  const [online, setOnline] = React.useState(false);
  const [lastSeen, setLastSeen] = React.useState<string | null>(null);

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
      setLastSeen(ts);
      setOnline(!!ts && (Date.now() - new Date(ts).getTime()) / 1000 < HEARTBEAT_STALE_SECONDS);
    };
    check();
    const iv = setInterval(check, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return (
    <span
      title={lastSeen ? `Last heartbeat: ${new Date(lastSeen).toLocaleString("en-AU")}` : "No heartbeat recorded"}
      className={cn("flex items-center gap-1 font-bold lowercase", online ? "text-emerald-600" : "text-red-600")}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", online ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
      {online ? "vps live" : "vps offline"}
    </span>
  );
}

const LOGO = "https://www.fiestafreshcleaning.com/assets/logo-CpH5fHWq.jpeg";

const operationsNav = [
  { name: "Command Center", href: "/",            icon: LayoutDashboard },
  { name: "Post Queue",     href: "/queue",       icon: ClipboardList   },
  { name: "Booster",        href: "/booster",     icon: Rocket          },
  { name: "Commented",      href: "/commented",   icon: CheckCheck      },
  { name: "Schedule Manager", href: "/schedule",  icon: Calendar        },
];

const managementNav = [
  { name: "Service Types",     href: "/service-types", icon: Tags      },
  { name: "Comment Templates", href: "/templates",     icon: FileText  },
  { name: "Facebook Groups",   href: "/groups",        icon: Compass   },
  { name: "Cookie Manager",  href: "/cookies",       icon: Cookie    },
];

function NavSection({ title, items, pathname, onNavigate }: {
  title: string;
  items: typeof operationsNav;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <h2 className="section-label mb-3">{title}</h2>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.name} href={item.href} onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group text-sm font-medium",
                active ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <item.icon className={cn("w-4 h-4 transition-colors", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarBody({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      {/* Brand */}
      <div className="p-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img
              src={LOGO}
              alt="Logo"
              className="w-9 h-9 rounded-xl object-contain shadow-sm border border-slate-100"
            />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-800 leading-tight">Fiesta Fresh</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Cleaning Services</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-6 space-y-8">
        <NavSection title="Operations Center" items={operationsNav} pathname={pathname} onNavigate={onNavigate} />
        <NavSection title="Bot Settings" items={managementNav} pathname={pathname} onNavigate={onNavigate} />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-widest px-2">
          <span>Version 1.4.0</span>
          <VpsBadge />
        </div>
      </div>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <html lang="en">
      <head>
        <title>Fiesta Fresh · Comments Bot</title>
        <meta name="description" content="Fiesta Fresh Cleaning – Comments Automation Dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* PWA — installable from Safari / Chrome home screen */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1d4ed8" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Fiesta Queue" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
      </head>
      <body className="flex overflow-hidden bg-slate-50 font-sans">
        {/* Mobile top bar */}
        <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-slate-200 flex items-center gap-3 px-4">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <Menu size={22} />
          </button>
          <img src={LOGO} alt="Fiesta Fresh" className="w-8 h-8 rounded-lg object-contain border border-slate-100" />
          <span className="text-sm font-bold text-slate-800">Fiesta Fresh</span>
        </header>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="absolute top-4 right-4 p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
              <SidebarBody pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}

        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-64 h-screen flex-col bg-white border-r border-slate-200 shrink-0">
          <SidebarBody pathname={pathname} />
        </aside>

        <main className="flex-1 overflow-y-auto h-screen scrollbar-hide pt-14 md:pt-0">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
