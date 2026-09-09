"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers, MapPin, Mountain, Navigation } from "lucide-react";

export interface MapPoint {
  lat: number;
  lon: number;
  elevationM: number;
  distanceKm: number;
  gradePct?: number;
}

export interface MapCheckpoint {
  id: string;
  name: string;
  distanceKm: number;
  elevationM: number;
  predictedTimeStr?: string;
  clockTimeStr?: string;
  officialCotTime?: string;
  bufferMinutes?: number;
  status?: "safe" | "caution" | "danger";
  waterRefillMl?: number;
  carbsTargetGrams?: number;
  notes?: string;
}

interface TrailMapProps {
  points: MapPoint[];
  checkpoints: MapCheckpoint[];
  hoverDistanceKm?: number | null;
  onHoverDistanceChange?: (distKm: number | null) => void;
  raceName: string;
}

export const TrailMap: React.FC<TrailMapProps> = ({
  points,
  checkpoints,
  hoverDistanceKm,
  onHoverDistanceChange,
  raceName,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const checkpointLayerRef = useRef<L.LayerGroup | null>(null);
  const hoverMarkerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeLayer, setActiveLayer] = useState<"topo" | "satellite" | "street">("topo");

  // Tile layers
  const tileLayers = {
    topo: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: 'Map: © OpenTopoMap (CC-BY-SA)',
      maxZoom: 17,
    },
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles: © Esri, Maxar, Earthstar",
      maxZoom: 19,
    },
    street: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    },
  };

  const currentTileRef = useRef<L.TileLayer | null>(null);

  // Helper to color segments by slope grade
  const getGradeColor = (grade?: number) => {
    if (grade === undefined) return "#06b6d4"; // cyan
    if (grade > 25) return "#ef4444"; // extreme steep wall red (>25%)
    if (grade > 15) return "#f97316"; // steep orange (power-hike 15-25%)
    if (grade > 8) return "#eab308"; // moderate climb yellow (8-15%)
    if (grade > 3) return "#84cc16"; // gentle climb lime (3-8%)
    if (grade < -15) return "#a855f7"; // technical downhill purple (<-15%)
    if (grade < -3) return "#38bdf8"; // moderate descent light blue (-3 to -15%)
    return "#10b981"; // flat/rolling green (-3 to +3%)
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    });

    const baseTile = L.tileLayer(tileLayers[activeLayer].url, {
      attribution: tileLayers[activeLayer].attribution,
      maxZoom: tileLayers[activeLayer].maxZoom,
    }).addTo(map);

    currentTileRef.current = baseTile;
    mapInstanceRef.current = map;

    polylineLayerRef.current = L.layerGroup().addTo(map);
    checkpointLayerRef.current = L.layerGroup().addTo(map);
    hoverMarkerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer on toggle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (currentTileRef.current) {
      map.removeLayer(currentTileRef.current);
    }

    const newTile = L.tileLayer(tileLayers[activeLayer].url, {
      attribution: tileLayers[activeLayer].attribution,
      maxZoom: tileLayers[activeLayer].maxZoom,
    }).addTo(map);

    currentTileRef.current = newTile;
  }, [activeLayer]);

  // Render GPX Track & Gradient Segments
  useEffect(() => {
    const map = mapInstanceRef.current;
    const polyGroup = polylineLayerRef.current;
    if (!map || !polyGroup || !points || points.length < 2) return;

    polyGroup.clearLayers();

    const latLngs: [number, number][] = [];

    // Draw multi-colored segment polylines
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      latLngs.push([p1.lat, p1.lon]);

      const segLine = L.polyline(
        [
          [p1.lat, p1.lon],
          [p2.lat, p2.lon],
        ],
        {
          color: getGradeColor(p2.gradePct),
          weight: 4.5,
          opacity: 0.95,
          lineJoin: "round",
        }
      );

      // Click on track to sync hover
      segLine.on("click", () => {
        if (onHoverDistanceChange) {
          onHoverDistanceChange(p2.distanceKm);
        }
      });

      polyGroup.addLayer(segLine);
    }

    if (points.length > 0) {
      const last = points[points.length - 1];
      latLngs.push([last.lat, last.lon]);
    }

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [35, 35] });
    }
  }, [points]);

  // Render Checkpoints & Water Stations (WS) Markers with REAL NAMES
  useEffect(() => {
    const cpGroup = checkpointLayerRef.current;
    if (!cpGroup || !checkpoints || checkpoints.length === 0 || !points || points.length === 0) return;

    cpGroup.clearLayers();

    checkpoints.forEach((cp, idx) => {
      // Find closest track point to checkpoint distance
      let closestPt = points[0];
      let minDiff = Math.abs(points[0].distanceKm - cp.distanceKm);

      for (const pt of points) {
        const diff = Math.abs(pt.distanceKm - cp.distanceKm);
        if (diff < minDiff) {
          minDiff = diff;
          closestPt = pt;
        }
      }

      const isStart = idx === 0 || cp.name.toLowerCase().includes("start");
      const isFinish = idx === checkpoints.length - 1 || cp.name.toLowerCase().includes("finish");

      const badgeColor = isStart
        ? "bg-emerald-500 text-white"
        : isFinish
        ? "bg-purple-500 text-white"
        : cp.status === "danger"
        ? "bg-rose-500 text-white"
        : cp.status === "caution"
        ? "bg-amber-500 text-black font-black"
        : "bg-cyan-500 text-black font-black";

      // Truncate name for small badge
      const shortName = cp.name.replace(/water station/i, "WS").replace(/checkpoint/i, "CP");

      const iconHtml = `
        <div class="relative group cursor-pointer flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full ${badgeColor} font-black text-[10px] font-mono shadow-xl border-2 border-zinc-950 whitespace-nowrap group-hover:scale-110 transition-transform">
            ${isStart ? "START" : isFinish ? "FINISH" : shortName.length > 14 ? shortName.slice(0, 13) + "…" : shortName}
          </div>
          <div class="w-2 h-2 -mt-0.5 rotate-45 ${badgeColor} border-r-2 border-b-2 border-zinc-950"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-cp-div-icon",
        iconSize: [90, 24],
        iconAnchor: [45, 22],
      });

      const marker = L.marker([closestPt.lat, closestPt.lon], { icon: customIcon });

      const bufferBadge =
        cp.bufferMinutes !== undefined
          ? cp.bufferMinutes >= 45
            ? `<span style="color:#10b981;font-weight:bold">+${Math.floor(cp.bufferMinutes / 60)}j ${Math.abs(cp.bufferMinutes % 60)}m Aman</span>`
            : cp.bufferMinutes >= 0
            ? `<span style="color:#f59e0b;font-weight:bold">+${cp.bufferMinutes}m Mepet</span>`
            : `<span style="color:#ef4444;font-weight:bold">${Math.abs(cp.bufferMinutes)}m CUT OFF</span>`
          : "";

      marker.bindPopup(`
        <div class="font-sans text-xs space-y-1.5 p-1" style="color:#09090b; min-width: 210px;">
          <div class="font-black text-sm border-b pb-1 text-zinc-900">
            ${cp.name}
          </div>
          <div class="font-mono text-[11px] text-zinc-600">
            Jarak: <strong>KM ${cp.distanceKm.toFixed(1)}</strong> &bull; Elev: <strong>${cp.elevationM} mdpl</strong>
          </div>
          ${
            cp.predictedTimeStr
              ? `<div class="font-mono text-xs font-semibold text-zinc-800">
                  Estimasi Tiba: <strong>${cp.predictedTimeStr}</strong> ${cp.clockTimeStr ? `(${cp.clockTimeStr})` : ""}
                  <div>Status COT: ${bufferBadge}</div>
                </div>`
              : ""
          }
          ${
            cp.waterRefillMl || cp.carbsTargetGrams
              ? `<div class="bg-cyan-50 border border-cyan-200 p-1.5 rounded text-[10px] font-mono text-cyan-950">
                  Refill: 💧 ${cp.waterRefillMl || 0}ml Air &bull; ⚡ ${cp.carbsTargetGrams || 0}g Karbohidrat
                </div>`
              : ""
          }
          ${cp.notes ? `<div class="text-[10px] text-zinc-500 italic">${cp.notes}</div>` : ""}
        </div>
      `);

      cpGroup.addLayer(marker);
    });
  }, [checkpoints, points]);

  // Synchronize Live Hover Beacon (100% Native Leaflet Vector Markers in markerPane)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const hoverGroup = hoverMarkerGroupRef.current;
    if (!map || !hoverGroup || !points || points.length === 0) return;

    hoverGroup.clearLayers();

    if (hoverDistanceKm === null || hoverDistanceKm === undefined) {
      return;
    }

    // Find point closest to hover distance
    let closestPt = points[0];
    let minDiff = Math.abs(points[0].distanceKm - hoverDistanceKm);

    for (let i = 0; i < points.length; i++) {
      const diff = Math.abs(points[i].distanceKm - hoverDistanceKm);
      if (diff < minDiff) {
        minDiff = diff;
        closestPt = points[i];
      }
    }

    const gradeColor = getGradeColor(closestPt.gradePct);

    // 1. Outer Pulse Circle in markerPane (z-index 600, always above polylines)
    const pulseCircle = L.circleMarker([closestPt.lat, closestPt.lon], {
      radius: 18,
      fillColor: gradeColor,
      fillOpacity: 0.4,
      color: "#ffffff",
      weight: 1.5,
      pane: "markerPane",
    });

    // 2. Solid High-Contrast Core Marker
    const coreMarker = L.circleMarker([closestPt.lat, closestPt.lon], {
      radius: 8,
      fillColor: gradeColor,
      fillOpacity: 1,
      color: "#ffffff",
      weight: 3,
      pane: "markerPane",
    });

    // 3. Tooltip showing live kilometer & gradient
    const tooltipText = `KM ${closestPt.distanceKm.toFixed(1)} • ${Math.round(closestPt.elevationM)}m (${closestPt.gradePct !== undefined ? closestPt.gradePct.toFixed(1) + "%" : "0%"})`;

    coreMarker.bindTooltip(tooltipText, {
      permanent: true,
      direction: "top",
      offset: [0, -10],
      className: "gpx-live-hover-tooltip font-mono font-bold text-xs",
    });

    hoverGroup.addLayer(pulseCircle);
    hoverGroup.addLayer(coreMarker);
    coreMarker.openTooltip();
  }, [hoverDistanceKm, points]);

  return (
    <div className="relative w-full h-[460px] sm:h-[520px] rounded-2xl overflow-hidden border-2 border-zinc-950 shadow-[4px_4px_0px_0px_#09090b] bg-zinc-100">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Map Top Floating Bar: Route Title & Layer Controls */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-white/95 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 rounded-xl border-2 border-zinc-950 text-xs shadow-[2px_2px_0px_0px_#09090b] pointer-events-auto min-w-0 max-w-[48%] sm:max-w-none">
          <Mountain className="h-4 w-4 text-zinc-950 shrink-0" />
          <span className="font-black text-zinc-950 tracking-tight truncate">{raceName}</span>
          <span className="text-[10px] text-zinc-600 font-mono font-bold hidden md:inline shrink-0">
            ({points.length} pts)
          </span>
        </div>

        {/* Layer Switcher Floating Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] pointer-events-auto shrink-0">
          {[
            { id: "topo", label: "Topografi" },
            { id: "satellite", label: "Satelit" },
            { id: "street", label: "Jalan" },
          ].map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id as any)}
              className={`px-2 sm:px-2.5 py-1 text-[10px] sm:text-[11px] font-bold rounded-lg transition-all ${
                activeLayer === layer.id
                  ? "bg-amber-400 text-zinc-950 font-black border border-zinc-950 shadow-[1px_1px_0px_0px_#09090b]"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Gradient Legend */}
      <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border-2 border-zinc-950 shadow-[2px_2px_0px_0px_#09090b] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono pointer-events-auto">
          <div className="flex items-center gap-1.5 font-sans text-zinc-950 font-black text-[11px]">
            <Mountain className="h-3.5 w-3.5 text-zinc-950 stroke-[2.5]" />
            <span>Kecuraman Jalur:</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap font-bold">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-zinc-950" />
              <span className="text-zinc-800">Datar (-3 s/d +3%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 border border-zinc-950" />
              <span className="text-zinc-800">Nanjak Landai (3-8%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 border border-zinc-950" />
              <span className="text-zinc-800">Nanjak Sedang (8-15%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-zinc-950" />
              <span className="text-zinc-800">Power Hike (15-25%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-zinc-950" />
              <span className="text-zinc-800">Tanjakan Ekstrem (&gt;25%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 border border-zinc-950" />
              <span className="text-zinc-800">Turunan (-3 s/d -15%)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-zinc-950" />
              <span className="text-zinc-800">Turunan Curam (&lt;-15%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrailMap;
