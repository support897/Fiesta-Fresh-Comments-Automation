"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Camera,
  Calendar,
  Image,
  AlertTriangle,
  Compass,
  FileText,
  Bell,
  Cookie,
} from "lucide-react";
import { cn } from "@/lib/utils";
import "./globals.css";

const LOGO = "https://www.fiestafreshcleaning.com/assets/logo-CpH5fHWq.jpeg";

const operationsNav = [
  { name: "Command Center", href: "/",            icon: LayoutDashboard },
  { name: "Proof Gallery",  href: "/proof",       icon: Camera          },
  { name: "Schedule Manager", href: "/schedule",  icon: Calendar        },
];

const managementNav = [
  { name: "Post Templates",   href: "/templates",     icon: FileText    },
  { name: "Facebook Groups",  href: "/groups",        icon: Compass     },
  { name: "Cookies 🍪",       href: "/cookies",       icon: Cookie      },
  { name: "Photo Library",    href: "/photos",        icon: Image       },
  { name: "Notifications",    href: "/notifications", icon: Bell        },
  { name: "System Errors",    href: "/errors",        icon: AlertTriangle },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <html lang="en">
      <head>
        <title>Fiesta Fresh · Comments Bot</title>
        <meta name="description" content="Fiesta Fresh Cleaning – Comments Automation Dashboard" />
      </head>
      <body className="flex overflow-hidden bg-slate-50 font-sans">
        <aside className="w-64 h-screen flex flex-col bg-white border-r border-slate-200">
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
            <div>
              <h2 className="section-label mb-3">Operations Center</h2>
              <nav className="space-y-1">
                {operationsNav.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.name} href={item.href}
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

            <div>
              <h2 className="section-label mb-3">FB Comments &amp; Rules</h2>
              <nav className="space-y-1">
                {managementNav.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.name} href={item.href}
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
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-widest px-2">
              <span>Version 1.1.0</span>
              <span className="flex items-center gap-1 text-emerald-600 font-bold lowercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                vps 24/7
              </span>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto h-screen scrollbar-hide">
          <div className="max-w-7xl mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
