"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Camera,
  Calendar,
  FileText,
  Compass,
  Image as ImageIcon,
  Bell,
  AlertTriangle,
  Bot,
  ShieldCheck,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const navSections = [
    {
      title: "Operations Center",
      items: [
        { name: "Command Center", href: "/", icon: LayoutDashboard },
        { name: "Proof Gallery", href: "/proof", icon: Camera },
        { name: "Schedule Manager", href: "/schedule", icon: Calendar },
      ],
    },
    {
      title: "FB Poster & Rules",
      items: [
        { name: "Post Templates", href: "/templates", icon: FileText },
        { name: "Facebook Groups", href: "/groups", icon: Compass },
        { name: "Photo Library", href: "/photos", icon: ImageIcon },
        { name: "Notifications", href: "/notifications", icon: Bell },
        { name: "System Errors", href: "/errors", icon: AlertTriangle },
      ],
    },
  ];

  return (
    <aside className="w-64 h-screen flex flex-col bg-white border-r border-slate-200 select-none flex-shrink-0">
      {/* Brand Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="https://www.fiestafreshcleaning.com/assets/logo-CpH5fHWq.jpeg"
            alt="Fiesta Fresh Logo"
            className="w-10 h-10 rounded-xl object-contain shadow-sm border border-slate-100"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              Fiesta Fresh
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-600">
              Cleaning Services
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-6">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            <h2 className="px-3 text-[10px] font-bold tracking-widest text-blue-600 uppercase mb-2">
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
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

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Azure VPS Live
          </span>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
            v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
