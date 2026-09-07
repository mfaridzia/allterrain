"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Footprints,
  Plus,
  Mountain,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Trash2,
  RotateCcw,
  Star,
  Flame,
  Clock,
  Sparkles,
  X,
  Check,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/Header";
import {
  useGearData,
  useAddShoeMutation,
  useUpdateShoeMutation,
  useDeleteShoeMutation,
} from "@/lib/queries";
import { formatPace } from "@/lib/analytics";

interface ShoeFormData {
  id?: string;
  name: string;
  brand: string;
  model: string;
  sportType: "trail" | "road" | "racing" | "all-terrain";
  maxDistanceKm: number;
  maxElevationM: number;
  initialDistanceKm: number;
  initialElevationM: number;
  isDefault: boolean;
  notes: string;
}

const DEFAULT_FORM: ShoeFormData = {
  name: "",
  brand: "",
  model: "",
  sportType: "trail",
  maxDistanceKm: 650,
  maxElevationM: 20000,
  initialDistanceKm: 0,
  initialElevationM: 0,
  isDefault: false,
  notes: "",
};

export default function GearPage() {
  const { data: gearData, isLoading, refetch } = useGearData();
  const addMutation = useAddShoeMutation();
  const updateMutation = useUpdateShoeMutation();
  const deleteMutation = useDeleteShoeMutation();

  const [activeTab, setActiveTab] = useState<"active" | "retired" | "all">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<ShoeFormData>(DEFAULT_FORM);
  const [editingShoeId, setEditingShoeId] = useState<string | null>(null);

  const shoes = gearData?.shoes || [];
  const summary = gearData?.summary || {
    totalTrackedKm: 0,
    totalTrackedElevationM: 0,
    activeShoesCount: 0,
    retiredShoesCount: 0,
    shoesNeedingReplacementCount: 0,
  };

  const filteredShoes = shoes.filter((shoe: any) => {
    if (activeTab === "active") return !shoe.isRetired;
    if (activeTab === "retired") return shoe.isRetired;
    return true;
  });

  const handleOpenAddModal = () => {
    setEditingShoeId(null);
    setFormData(DEFAULT_FORM);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (shoe: any) => {
    setEditingShoeId(shoe.id);
    setFormData({
      id: shoe.id,
      name: shoe.name,
      brand: shoe.brand || "",
      model: shoe.model || "",
      sportType: shoe.sportType || "trail",
      maxDistanceKm: shoe.maxDistanceKm || 650,
      maxElevationM: shoe.maxElevationM || 20000,
      initialDistanceKm: shoe.initialDistanceKm || 0,
      initialElevationM: shoe.initialElevationM || 0,
      isDefault: Boolean(shoe.isDefault),
      notes: shoe.notes || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingShoeId) {
        await updateMutation.mutateAsync({
          id: editingShoeId,
          ...formData,
        });
      } else {
        await addMutation.mutateAsync(formData);
      }
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      console.error("Failed to save shoe:", err);
    }
  };

  const handleToggleRetire = async (shoe: any) => {
    try {
      await updateMutation.mutateAsync({
        id: shoe.id,
        isRetired: !shoe.isRetired,
      });
      refetch();
    } catch (err) {
      console.error("Failed to toggle retirement:", err);
    }
  };

  const handleSetDefault = async (shoe: any) => {
    try {
      await updateMutation.mutateAsync({
        id: shoe.id,
        isDefault: true,
        sportType: shoe.sportType,
      });
      refetch();
    } catch (err) {
      console.error("Failed to set default shoe:", err);
    }
  };

  const handleDelete = async (shoeId: string, shoeName: string) => {
    if (window.confirm(`Are you sure you want to delete "${shoeName}"? Activities linked to this shoe will be preserved.`)) {
      try {
        await deleteMutation.mutateAsync(shoeId);
        refetch();
      } catch (err) {
        console.error("Failed to delete shoe:", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-zinc-950 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Page Title & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-950 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-orange-200 text-orange-950 border border-zinc-950 uppercase">
                Endurance & Trail Equipment
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
              <Footprints className="h-7 w-7 text-orange-600 stroke-[2.5]" />
              Gear & Shoe Tracker
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 max-w-2xl font-medium mt-1">
              Track cumulative mileage, technical trail elevation gain (D+), outsole lug wear, and proactive retirement alerts.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs sm:text-sm border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span>Add New Shoe</span>
          </button>
        </div>

        {/* Aggregate KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
          {/* Active Shoes */}
          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] flex flex-col justify-between">
            <span className="text-[11px] font-sans font-bold text-zinc-600 block uppercase tracking-wide">
              Active Rotation
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-zinc-950">
                {summary.activeShoesCount}
              </span>
              <span className="text-xs font-sans text-zinc-500 font-bold">shoes active</span>
            </div>
            <span className="text-[10px] font-sans text-zinc-500 block">
              {summary.retiredShoesCount} retired in archive
            </span>
          </div>

          {/* Tracked Mileage */}
          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] flex flex-col justify-between">
            <span className="text-[11px] font-sans font-bold text-zinc-600 block uppercase tracking-wide">
              Total Logged Mileage
            </span>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700">
                {summary.totalTrackedKm}
              </span>
              <span className="text-xs font-sans text-zinc-500 font-bold">km</span>
            </div>
            <span className="text-[10px] font-sans text-zinc-500 block">
              Across active rotation shoes
            </span>
          </div>

          {/* Tracked Elevation D+ */}
          <div className="p-4 rounded-2xl bg-white border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] flex flex-col justify-between">
            <span className="text-[11px] font-sans font-bold text-zinc-600 block uppercase tracking-wide">
              Total Elevation (D+)
            </span>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-black text-cyan-800">
                +{summary.totalTrackedElevationM.toLocaleString()}
              </span>
              <span className="text-xs font-sans text-zinc-500 font-bold">m</span>
            </div>
            <span className="text-[10px] font-sans text-zinc-500 block">
              Mountain & trail vertical gain
            </span>
          </div>

          {/* Outsole Alert Status */}
          <div
            className={`p-4 rounded-2xl border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] flex flex-col justify-between ${
              summary.shoesNeedingReplacementCount > 0 ? "bg-rose-50" : "bg-emerald-50"
            }`}
          >
            <span className="text-[11px] font-sans font-bold text-zinc-700 block uppercase tracking-wide">
              Outsole Condition
            </span>
            <div className="my-1.5 flex items-baseline gap-1.5">
              <span
                className={`text-xl sm:text-2xl font-black ${
                  summary.shoesNeedingReplacementCount > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {summary.shoesNeedingReplacementCount > 0
                  ? `${summary.shoesNeedingReplacementCount} Near Limit`
                  : "All Lugs Solid"}
              </span>
            </div>
            <span className="text-[10px] font-sans text-zinc-600 block">
              {summary.shoesNeedingReplacementCount > 0
                ? "Outsole lugs or cushioning worn out"
                : "Tread depth and foam responsive"}
            </span>
          </div>
        </div>

        {/* Tab Selector: Active vs Retired vs All */}
        <div className="flex items-center gap-2 border-b-2 border-zinc-200 pb-1">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 transition-all cursor-pointer ${
              activeTab === "active"
                ? "bg-white text-zinc-950 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                : "bg-transparent text-zinc-600 border-transparent hover:text-zinc-950"
            }`}
          >
            Active Shoes ({shoes.filter((s: any) => !s.isRetired).length})
          </button>
          <button
            onClick={() => setActiveTab("retired")}
            className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 transition-all cursor-pointer ${
              activeTab === "retired"
                ? "bg-white text-zinc-950 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                : "bg-transparent text-zinc-600 border-transparent hover:text-zinc-950"
            }`}
          >
            Retired Archive ({shoes.filter((s: any) => s.isRetired).length})
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-white text-zinc-950 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b]"
                : "bg-transparent text-zinc-600 border-transparent hover:text-zinc-950"
            }`}
          >
            All Footwear ({shoes.length})
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-7 w-7 text-orange-600 animate-spin" />
            <p className="text-xs font-black text-zinc-600 uppercase font-mono">
              Loading Shoe & Gear Telemetry...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredShoes.length === 0 && (
          <div className="p-8 rounded-2xl bg-white border-2 border-zinc-950 shadow-[3px_3px_0px_0px_#09090b] text-center space-y-3">
            <Footprints className="h-10 w-10 text-zinc-400 mx-auto stroke-[1.5]" />
            <h3 className="text-base font-black text-zinc-950">No Shoes Found</h3>
            <p className="text-xs text-zinc-600 max-w-sm mx-auto font-medium">
              {activeTab === "retired"
                ? "You have not retired any shoes yet. When a shoe exceeds its lifespan, you can retire it to preserve historical stats."
                : "Start tracking your shoe lifespan by clicking '+ Add New Shoe'."}
            </p>
            {activeTab !== "retired" && (
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
                <span>Add Your First Shoe</span>
              </button>
            )}
          </div>
        )}

        {/* Shoes Cards Grid */}
        {!isLoading && filteredShoes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredShoes.map((shoe: any) => {
              const isTrail = shoe.sportType === "trail" || shoe.sportType === "all-terrain";
              const formattedLastWorn = shoe.lastWornTime
                ? new Date(shoe.lastWornTime).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "No activities yet";

              return (
                <div
                  key={shoe.id}
                  className={`rounded-2xl border-2 border-zinc-950 p-5 space-y-4 shadow-[3px_3px_0px_0px_#09090b] transition-all flex flex-col justify-between ${
                    shoe.isRetired ? "bg-zinc-100 opacity-80" : "bg-white"
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top Header: Name, Brand, Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="text-[10px] font-mono font-black uppercase text-zinc-500 tracking-wider">
                            {shoe.brand || "Brand"}
                          </span>

                          <span
                            className={`text-[9px] px-2 py-0.5 rounded-full font-black border border-zinc-950 ${
                              isTrail
                                ? "bg-cyan-200 text-cyan-950"
                                : shoe.sportType === "racing"
                                ? "bg-purple-200 text-purple-950"
                                : "bg-amber-200 text-amber-950"
                            }`}
                          >
                            {shoe.sportType.toUpperCase()}
                          </span>

                          {shoe.isDefault && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-300 text-zinc-950 border border-zinc-950 font-black flex items-center gap-1">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              DEFAULT
                            </span>
                          )}

                          {shoe.isRetired && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-300 text-zinc-700 border border-zinc-500 font-black">
                              RETIRED
                            </span>
                          )}
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-zinc-950 leading-tight">
                          {shoe.name}
                        </h3>
                        {shoe.model && shoe.model !== shoe.name && (
                          <p className="text-xs text-zinc-500 font-medium">{shoe.model}</p>
                        )}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-black shrink-0 ${
                          shoe.wearStatus === "critical"
                            ? "bg-rose-100 text-rose-950 border-rose-400"
                            : shoe.wearStatus === "warning"
                            ? "bg-amber-100 text-amber-950 border-amber-400"
                            : shoe.wearStatus === "active"
                            ? "bg-teal-100 text-teal-950 border-teal-400"
                            : shoe.wearStatus === "retired"
                            ? "bg-zinc-200 text-zinc-700 border-zinc-400"
                            : "bg-emerald-100 text-emerald-950 border-emerald-400"
                        }`}
                      >
                        {shoe.wearStatusLabel}
                      </span>
                    </div>

                    {/* Dual Progress Bars: Distance & Elevation Gain */}
                    <div className="space-y-2.5 font-mono pt-1">
                      {/* Distance Bar */}
                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-[11px] font-sans font-bold text-zinc-700">
                            Distance Wear:
                          </span>
                          <span className="font-black text-zinc-950">
                            {shoe.totalDistanceKm} / {shoe.maxDistanceKm} km{" "}
                            <span className="text-zinc-500 font-normal">
                              ({shoe.distanceProgressPct}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-3 w-full bg-zinc-100 rounded-full border-2 border-zinc-950 overflow-hidden shadow-[1px_1px_0px_0px_#09090b]">
                          <div
                            className={`h-full transition-all ${
                              shoe.distanceProgressPct >= 90
                                ? "bg-rose-500"
                                : shoe.distanceProgressPct >= 75
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, shoe.distanceProgressPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Elevation D+ Bar (Essential for Trail Shoes) */}
                      <div>
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-[11px] font-sans font-bold text-cyan-900 flex items-center gap-1">
                            <Mountain className="h-3 w-3" />
                            Trail Elevation Wear (D+):
                          </span>
                          <span className="font-black text-cyan-900">
                            +{shoe.totalElevationM.toLocaleString()} / +{shoe.maxElevationM.toLocaleString()} m{" "}
                            <span className="text-zinc-500 font-normal">
                              ({shoe.elevationProgressPct}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-3 w-full bg-zinc-100 rounded-full border-2 border-zinc-950 overflow-hidden shadow-[1px_1px_0px_0px_#09090b]">
                          <div
                            className={`h-full transition-all ${
                              shoe.elevationProgressPct >= 90
                                ? "bg-rose-500"
                                : shoe.elevationProgressPct >= 75
                                ? "bg-amber-500"
                                : "bg-cyan-500"
                            }`}
                            style={{ width: `${Math.min(100, shoe.elevationProgressPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#FAF9F5] border border-zinc-300 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-sans font-bold">Sessions</span>
                        <span className="font-black text-zinc-950">{shoe.activityCount} runs</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-sans font-bold">Avg Pace</span>
                        <span className="font-black text-orange-600">
                          {shoe.avgPaceSec > 0 ? `${formatPace(shoe.avgPaceSec)}/k` : "--"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 block font-sans font-bold">Last Worn</span>
                        <span className="font-bold text-zinc-700 truncate block text-[11px]">
                          {formattedLastWorn}
                        </span>
                      </div>
                    </div>

                    {/* Notes & Advice */}
                    {shoe.notes && (
                      <p className="text-[11px] text-zinc-600 italic bg-amber-50/60 p-2 rounded-lg border border-amber-200">
                        &ldquo;{shoe.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-zinc-200 flex items-center justify-between gap-2 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      {!shoe.isDefault && !shoe.isRetired && (
                        <button
                          onClick={() => handleSetDefault(shoe)}
                          className="px-2.5 py-1 rounded-lg border border-zinc-400 bg-white hover:bg-zinc-100 text-zinc-700 text-[11px] transition-colors cursor-pointer"
                        >
                          Make Default
                        </button>
                      )}

                      <button
                        onClick={() => handleToggleRetire(shoe)}
                        className="px-2.5 py-1 rounded-lg border border-zinc-400 bg-white hover:bg-zinc-100 text-zinc-700 text-[11px] transition-colors cursor-pointer"
                      >
                        {shoe.isRetired ? "Reactivate" : "Retire"}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(shoe)}
                        className="p-1.5 rounded-lg border border-zinc-400 bg-white hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                        title="Edit shoe thresholds and specs"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(shoe.id, shoe.name)}
                        className="p-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                        title="Delete shoe"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add or Edit Shoe */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl bg-white border-2 border-zinc-950 p-6 space-y-4 shadow-[6px_6px_0px_0px_#09090b] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-orange-100 border-2 border-zinc-950 flex items-center justify-center text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]">
                    <Footprints className="h-4 w-4 stroke-[2.5]" />
                  </div>
                  <h3 className="text-base font-black text-zinc-950">
                    {editingShoeId ? "Edit Shoe Profile" : "Register New Shoe"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl border-2 border-zinc-950 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 shadow-[1.5px_1.5px_0px_0px_#09090b]"
                >
                  <X className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs font-bold">
                <div>
                  <label className="block text-zinc-700 mb-1">Shoe Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Hoka Speedgoat 5"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-700 mb-1">Brand</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="e.g. Hoka, Nike, Salomon"
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 mb-1">Terrain Type</label>
                    <select
                      value={formData.sportType}
                      onChange={(e) => setFormData({ ...formData, sportType: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white"
                    >
                      <option value="trail">Trail Running</option>
                      <option value="road">Road Running</option>
                      <option value="racing">Race Day / Carbon</option>
                      <option value="all-terrain">All-Terrain / Hybrid</option>
                    </select>
                  </div>
                </div>

                {/* Limits & Retirement Thresholds */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-700 mb-1">Max Distance (km)</label>
                    <input
                      type="number"
                      min="100"
                      max="1500"
                      value={formData.maxDistanceKm}
                      onChange={(e) =>
                        setFormData({ ...formData, maxDistanceKm: parseFloat(e.target.value) || 650 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white"
                    />
                    <span className="text-[10px] text-zinc-500 font-sans font-normal mt-0.5 block">
                      Target retirement (600-800k)
                    </span>
                  </div>
                  <div>
                    <label className="block text-zinc-700 mb-1">Max Elevation (m D+)</label>
                    <input
                      type="number"
                      min="1000"
                      max="100000"
                      step="500"
                      value={formData.maxElevationM}
                      onChange={(e) =>
                        setFormData({ ...formData, maxElevationM: parseFloat(e.target.value) || 20000 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white"
                    />
                    <span className="text-[10px] text-zinc-500 font-sans font-normal mt-0.5 block">
                      Outsole lug wear limit
                    </span>
                  </div>
                </div>

                {/* Starting / Historical Mileage (Prior to using app) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-700 mb-1">Starting KM</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.initialDistanceKm}
                      onChange={(e) =>
                        setFormData({ ...formData, initialDistanceKm: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white"
                    />
                    <span className="text-[10px] text-zinc-500 font-sans font-normal mt-0.5 block">
                      Previous mileage
                    </span>
                  </div>
                  <div>
                    <label className="block text-zinc-700 mb-1">Starting D+ (m)</label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.initialElevationM}
                      onChange={(e) =>
                        setFormData({ ...formData, initialElevationM: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white"
                    />
                    <span className="text-[10px] text-zinc-500 font-sans font-normal mt-0.5 block">
                      Previous climbing D+
                    </span>
                  </div>
                </div>

                {/* Default Flag */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="h-4 w-4 rounded border-2 border-zinc-950 text-orange-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="isDefault" className="text-zinc-800 text-xs font-bold cursor-pointer">
                    Set as default shoe for {formData.sportType} workouts
                  </label>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-zinc-700 mb-1">Notes / Outsole Specs</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Vibram Megagrip 5mm lugs, Gore-Tex upper, used for technical skyrunning"
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF9F5] border-2 border-zinc-950 text-zinc-950 font-mono shadow-[1.5px_1.5px_0px_0px_#09090b] focus:outline-none focus:bg-white text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-950 text-zinc-950 font-black shadow-[1.5px_1.5px_0px_0px_#09090b] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addMutation.isPending || updateMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-zinc-950 font-black shadow-[2px_2px_0px_0px_#09090b] cursor-pointer disabled:opacity-50"
                  >
                    {editingShoeId ? "Update Shoe" : "Save Shoe"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
