"use client";

import React, { useState, useEffect } from "react";
import { supabase, isConfigured } from "@/lib/supabaseClient";
import { Camera, ExternalLink, Image as ImageIcon, RefreshCw } from "lucide-react";

type ProofFile = {
  name: string;
  url: string;
  created_at: string;
};

export default function ProofGallery() {
  const [proofs, setProofs] = useState<ProofFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProofs();
  }, []);

  const fetchProofs = async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    try {
      // List objects from bot-screenshots bucket
      const { data, error } = await supabase.storage.from("bot-screenshots").list("proofs", {
        limit: 50,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (data && data.length > 0) {
        const fileList: ProofFile[] = data.map((item) => {
          const { data: publicUrlData } = supabase.storage
            .from("bot-screenshots")
            .getPublicUrl(`proofs/${item.name}`);
          return {
            name: item.name,
            url: publicUrlData.publicUrl,
            created_at: item.created_at || new Date().toISOString(),
          };
        });
        setProofs(fileList);
      }
    } catch (e) {
      console.error("Error fetching proof screenshots:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Proof Gallery
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Camera className="w-3.5 h-3.5" /> Live Screenshots
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time visual proof captured from Azure VPS browser (post confirmations, session checkpoints, error audits).
          </p>
        </div>

        <button
          onClick={fetchProofs}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Gallery
        </button>
      </div>

      {/* Proof Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading proof screenshots from Supabase Storage...
        </div>
      ) : proofs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-700">No Proof Screenshots Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            Screenshots are automatically captured when the VPS bot encounters checkpoints or completes auto-replies.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {proofs.map((proof, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all">
              <div className="aspect-video bg-slate-100 relative overflow-hidden group">
                <img
                  src={proof.url}
                  alt={proof.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <a
                  href={proof.url}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white gap-2 font-semibold text-xs transition-opacity"
                >
                  <span>View Full Screenshot</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="p-4 bg-white">
                <p className="text-xs font-mono font-semibold text-slate-800 truncate">
                  {proof.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Captured: {new Date(proof.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
