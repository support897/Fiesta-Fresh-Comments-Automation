"use client";

import React, { useState, useEffect } from "react";
import { supabase, isConfigured } from "@/lib/supabaseClient";
import { Compass, Plus, Trash2, ExternalLink, Power, RefreshCw } from "lucide-react";

type GroupItem = {
  id: string;
  url: string;
  name?: string;
  is_active: boolean;
  created_at: string;
};

export default function FacebookGroupsManager() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [newGroupUrl, setNewGroupUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) {
        setGroups(data as GroupItem[]);
      }
    } catch (e) {
      console.error("Error fetching groups:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupUrl.trim()) return;

    setAdding(true);
    try {
      let formattedUrl = newGroupUrl.trim();
      if (!formattedUrl.startsWith("http")) {
        formattedUrl = `https://www.facebook.com/groups/${formattedUrl}`;
      }

      const { error } = await supabase.from("groups").insert({
        url: formattedUrl,
        is_active: true,
      });

      if (!error) {
        setNewGroupUrl("");
        fetchGroups();
      }
    } catch (err) {
      console.error("Error adding group:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await supabase.from("groups").update({ is_active: !currentStatus }).eq("id", id);
      setGroups(
        groups.map((g) => (g.id === id ? { ...g, is_active: !currentStatus } : g))
      );
    } catch (err) {
      console.error("Failed to toggle group active state:", err);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await supabase.from("groups").delete().eq("id", id);
      setGroups(groups.filter((g) => g.id !== id));
    } catch (err) {
      console.error("Failed to delete group:", err);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Facebook Target Groups
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Compass className="w-3.5 h-3.5" /> Patrol Targets
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Manage active Facebook groups patrolled continuously by the Azure VPS bot.
          </p>
        </div>

        <button
          onClick={fetchGroups}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh List
        </button>
      </div>

      {/* Add New Group Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Add Target Group URL</h2>
        <form onSubmit={handleAddGroup} className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. https://www.facebook.com/groups/goldcoastcleaners"
            value={newGroupUrl}
            onChange={(e) => setNewGroupUrl(e.target.value)}
            className="flex-1 px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 transition-all"
          />
          <button
            type="submit"
            disabled={adding}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{adding ? "Adding..." : "Add Group"}</span>
          </button>
        </form>
      </div>

      {/* Groups Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Group URL</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Added Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Loading target groups from Supabase...
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No target groups added yet.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono text-xs">
                      <a
                        href={group.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1.5 font-medium"
                      >
                        <span>{group.url}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleActive(group.id, group.is_active)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                          group.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{group.is_active ? "Active" : "Inactive"}</span>
                      </button>
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-[11px]">
                      {new Date(group.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
