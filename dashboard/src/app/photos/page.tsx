"use client";

import React from "react";
import { Image as ImageIcon } from "lucide-react";

export default function PhotoLibrary() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-blue-600" /> Photo & Brand Assets Library
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Brand logos, review cards, and promotional media assets for Fiesta Fresh Cleaning.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <img
            src="https://www.fiestafreshcleaning.com/assets/logo-CpH5fHWq.jpeg"
            alt="Fiesta Fresh Official Logo"
            className="w-full h-48 object-contain rounded-xl bg-slate-50 p-4 border border-slate-100"
          />
          <p className="text-xs font-bold text-slate-900 mt-3">Official Brand Logo</p>
          <p className="text-[11px] text-slate-400">Primary Fiesta Fresh Cleaning Badge</p>
        </div>
      </div>
    </div>
  );
}
