import React, { useState, useMemo } from 'react';
import { 
  Server, Zap, HardDrive, Shield, AlertTriangle, CheckCircle2, 
  Plus, ZoomIn, ZoomOut, Maximize2, SplitSquareVertical, 
  SlidersHorizontal, ChevronRight, Activity, ThermometerSun, 
  Weight, Sparkles, Network, Cable
} from 'lucide-react';
import { Device, Rack, Port } from '../types/index.ts';

interface RackElevationProps {
  racks: Rack[];
  selectedRackId: string;
  onSelectRack: (rackId: string) => void;
  onDeviceClick: (device: Device) => void;
  onEmptySlotClick: (rackId: string, startU: number) => void;
  onNavigateToAddRack?: () => void;
  isAdminGranted?: boolean;
}

export function RackElevation({
  racks,
  selectedRackId,
  onSelectRack,
  onDeviceClick,
  onEmptySlotClick,
  onNavigateToAddRack,
  isAdminGranted = false,
}: RackElevationProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [secondRackId, setSecondRackId] = useState<string>('');

  const currentRack = useMemo(() => {
    return racks.find(r => r.id === selectedRackId) || racks[0] || null;
  }, [racks, selectedRackId]);

  const secondRack = useMemo(() => {
    if (!compareMode) return null;
    const targetId = secondRackId || racks.find(r => r.id !== selectedRackId)?.id;
    return racks.find(r => r.id === targetId) || null;
  }, [racks, selectedRackId, secondRackId, compareMode]);

  // Compute metrics for current rack
  const rackStats = useMemo(() => {
    if (!currentRack) return { usedU: 0, freeU: 42, power: 0, online: 0, warn: 0, crit: 0 };
    const devices = currentRack.devices || [];
    const usedU = devices.reduce((acc, d) => acc + d.unit_height, 0);
    const power = devices.reduce((acc, d) => acc + (d.power_watts || 0), 0);
    const online = devices.filter(d => d.status === 'ONLINE').length;
    const warn = devices.filter(d => d.status === 'WARNING').length;
    const crit = devices.filter(d => d.status === 'CRITICAL').length;
    return {
      usedU,
      freeU: Math.max(0, 42 - usedU),
      power,
      online,
      warn,
      crit,
      percentUsed: Math.round((usedU / 42) * 100)
    };
  }, [currentRack]);

  // Render a specific 42U rack column
  const renderRackColumn = (rack: Rack, isSecondary = false) => {
    const devices = rack.devices || [];
    
    // Map unit number (1 to 42) to device occupying it, or null
    // In datacenter standard EIA-310, U42 is at the top, U1 is at the bottom.
    // For a multi-U device starting at startU with height H, it occupies [startU, startU + H - 1].
    // We only render the primary card at the highest U of the device (startU + H - 1),
    // and skip the subordinate units so the card spans the full height.
    const unitMap: { [u: number]: { device?: Device; isTop?: boolean; span?: number } } = {};

    devices.forEach(dev => {
      const topU = dev.start_u + dev.unit_height - 1;
      for (let u = dev.start_u; u <= topU; u++) {
        if (u === topU) {
          unitMap[u] = { device: dev, isTop: true, span: dev.unit_height };
        } else {
          unitMap[u] = { device: dev, isTop: false };
        }
      }
    });

    // Array of U numbers descending: 42 down to 1
    const units = Array.from({ length: 42 }, (_, i) => 42 - i);

    return (
      <div className="flex-1 flex flex-col min-w-[280px] max-w-full lg:max-w-xl mx-auto">
        {/* Rack Header Information */}
        <div className="bg-slate-900 border border-slate-800 rounded-t-2xl p-4 flex items-center justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 glow-emerald animate-pulse" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-100 tracking-tight">
                {rack.name}
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              42U Standard EIA-310 • {rack.devices?.length || 0} Devices Installed
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
              {Math.round(((rack.devices?.reduce((a, b) => a + b.unit_height, 0) || 0) / 42) * 100)}% Full
            </span>
          </div>
        </div>

        {/* Rack Frame Outer Enclosure */}
        <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-x-4 border-b-4 border-slate-800 rounded-b-2xl p-3 shadow-2xl overflow-hidden">
          {/* Side Mounting Rails with Cage Nut Holes */}
          <div className="flex gap-2">
            {/* Left EIA Rail */}
            <div className="w-6 shrink-0 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between py-1 select-none">
              {units.map(u => (
                <div key={`l-rail-${u}`} className="h-10 flex flex-col justify-around items-center opacity-60">
                  <div className="w-1.5 h-1.5 rounded-sm bg-slate-800 border border-slate-700" />
                  <span className="text-[9px] font-mono font-bold text-slate-500">{u}</span>
                  <div className="w-1.5 h-1.5 rounded-sm bg-slate-800 border border-slate-700" />
                </div>
              ))}
            </div>

            {/* Central 42U Elevation Units */}
            <div className="flex-1 space-y-1.5 min-w-0">
              {units.map(u => {
                const slot = unitMap[u];

                // If this unit is part of a multi-U device but NOT the top unit, skip rendering (spanned by top)
                if (slot && !slot.isTop) {
                  return null;
                }

                if (slot && slot.device) {
                  const dev = slot.device;
                  const isFiltered = statusFilter !== 'ALL' && dev.status !== statusFilter;
                  return (
                    <div
                      key={`unit-${u}`}
                      onClick={() => onDeviceClick(dev)}
                      style={{
                        height: `${slot.span! * 42}px`,
                      }}
                      className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden flex flex-col justify-between p-2.5 select-none ${
                        isFiltered ? 'opacity-30' : 'opacity-100'
                      } ${getDeviceCardStyle(dev.device_type, dev.status)}`}
                    >
                      {/* Top Bar of the Device Faceplate */}
                      <div className="flex items-center justify-between gap-2 z-10">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              dev.status === 'ONLINE'
                                ? 'bg-emerald-400 glow-emerald animate-link-pulse'
                                : dev.status === 'WARNING'
                                ? 'bg-amber-400 glow-amber'
                                : 'bg-rose-500 glow-rose animate-pulse'
                            }`}
                          />
                          <span className="font-bold text-xs text-white truncate tracking-tight font-mono">
                            {dev.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline truncate">
                            [{dev.model}]
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-700/60 text-slate-300">
                            {dev.unit_height}U • U{dev.start_u}
                          </span>
                          {dev.power_watts > 0 && (
                            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20 hidden md:inline">
                              {dev.power_watts}W
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Specialized Visual Faceplate Component */}
                      <div className="my-auto z-10">
                        {renderHardwareFaceplate(dev)}
                      </div>

                      {/* Device Footer / Ports status preview */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 z-10 pt-1 border-t border-white/5">
                        <span className="truncate">
                          IP: {dev.ip_address || 'Unassigned'}
                        </span>
                        <span className="text-slate-300 flex items-center gap-1">
                          <Network className="w-3 h-3 text-emerald-400" />
                          {dev.ports?.filter(p => p.connected_port_id).length || 0}/{dev.ports?.length || 0} Ports Patched
                        </span>
                      </div>

                      {/* Subtle screw mounts on faceplate ears */}
                      <div className="absolute top-1.5 left-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-950" />
                      <div className="absolute top-1.5 right-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-950" />
                      <div className="absolute bottom-1.5 left-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-950" />
                      <div className="absolute bottom-1.5 right-1 w-1.5 h-1.5 rounded-full bg-slate-600 border border-slate-950" />
                    </div>
                  );
                }

                // If not admin-granted, empty slots are read-only
                if (!isAdminGranted) {
                  return (
                    <div
                      key={`unit-empty-${u}`}
                      className="w-full h-10 rounded-lg border border-dashed border-slate-900/80 bg-slate-950/20 text-slate-600 flex items-center justify-between px-3 text-xs select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-700">U{u}</span>
                        <span className="text-[11px] font-medium text-slate-600">Available Slot</span>
                      </div>
                    </div>
                  );
                }

                // Empty 1U Slot with interactive Click-to-Assign logic for admins!
                return isAdminGranted ? (
                  <button
                    key={`unit-empty-${u}`}
                    onClick={() => onEmptySlotClick(rack.id, u)}
                    type="button"
                    className="w-full h-10 rounded-lg border border-dashed border-slate-800/90 hover:border-emerald-500/80 bg-slate-950/40 hover:bg-emerald-950/20 text-slate-600 hover:text-emerald-400 transition-all flex items-center justify-between px-3 group text-xs select-none"
                    title={`Slot U${u} Empty - Click to Intake & Assign Hardware`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-600 group-hover:text-emerald-400 transition-colors">
                        U{u}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600 group-hover:text-slate-300">
                        Available Slot
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400 text-[11px] font-semibold">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign 1U-8U</span>
                    </div>
                  </button>
                ) : (
                  <div
                    key={`unit-empty-${u}`}
                    className="w-full h-10 rounded-lg border border-dashed border-slate-800/60 bg-slate-950/20 text-slate-600 flex items-center justify-between px-3 text-xs select-none"
                    title={`Slot U${u} Empty (Read-Only Mode)`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-600">
                        U{u}
                      </span>
                      <span className="text-[11px] font-medium text-slate-600">
                        Available Slot
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono">Unassigned</span>
                  </div>
                );
              })}
            </div>

            {/* Right EIA Rail */}
            <div className="w-6 shrink-0 bg-slate-950 border-l border-slate-800/80 flex flex-col justify-between py-1 select-none">
              {units.map(u => (
                <div key={`r-rail-${u}`} className="h-10 flex flex-col justify-around items-center opacity-60">
                  <div className="w-1.5 h-1.5 rounded-sm bg-slate-800 border border-slate-700" />
                  <span className="text-[9px] font-mono font-bold text-slate-500">{u}</span>
                  <div className="w-1.5 h-1.5 rounded-sm bg-slate-800 border border-slate-700" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Hardware faceplate realistic visual differentiating:
  const renderHardwareFaceplate = (dev: Device) => {
    switch (dev.device_type) {
      case 'SWITCH':
        return (
          <div className="flex items-center justify-between gap-2 py-1">
            {/* RJ45 Port Clusters with active LEDs */}
            <div className="flex items-center gap-1 overflow-x-hidden">
              {Array.from({ length: Math.min(dev.ports?.length || 24, 24) }).map((_, i) => {
                const port = dev.ports?.[i];
                const isLinked = !!port?.connected_port_id;
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isLinked ? 'bg-emerald-400 glow-emerald' : 'bg-slate-700'
                      }`}
                    />
                    <div className="w-2.5 h-2.5 rounded-sm bg-slate-950 border border-slate-700 flex items-center justify-center">
                      <div className="w-1.5 h-1 bg-amber-400/70 rounded-xs" />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* SFP+ 10G/25G Fiber Cages */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-700/60 shrink-0">
              <div className="w-3.5 h-3 rounded-xs bg-slate-950 border border-cyan-500/40 flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-cyan-400/80 rounded-full" />
              </div>
              <div className="w-3.5 h-3 rounded-xs bg-slate-950 border border-cyan-500/40 flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-cyan-400/80 rounded-full" />
              </div>
            </div>
          </div>
        );

      case 'PATCH_PANEL':
        return (
          <div className="py-1">
            <div className="flex items-center justify-between gap-1 bg-slate-950/80 p-1 rounded border border-slate-800">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-2.5 h-2 bg-slate-900 border border-slate-600 rounded-xs flex items-center justify-center">
                    <div className="w-1 h-0.5 bg-blue-400" />
                  </div>
                  <span className="text-[7px] text-slate-500 font-mono">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'BLADE_CHASSIS':
        return (
          <div className="py-2 space-y-1.5">
            {/* 8 Blade server compute modules */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-950 border border-slate-700/80 rounded p-1 flex flex-col justify-between h-14"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono text-slate-400">B{i + 1}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="w-full h-1 bg-slate-800 rounded" />
                    <div className="w-full h-1 bg-slate-800 rounded" />
                  </div>
                  <div className="text-[7px] font-mono text-slate-500 text-center">MX740c</div>
                </div>
              ))}
            </div>
            {/* Dual Redundant Power Supplies */}
            <div className="flex justify-between items-center px-1 text-[9px] font-mono text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <Zap className="w-3 h-3" /> PSU 1-4 Redundant (2400W)
              </span>
              <span>Fan Matrix: 6x Active</span>
            </div>
          </div>
        );

      case 'CABLE_ORGANIZER':
        return (
          <div className="flex items-center justify-center py-1">
            <div className="w-full h-5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-around px-4">
              <div className="h-0.5 w-full bg-slate-700/60 relative">
                <div className="absolute top-1/2 left-1/4 -translate-y-1/2 flex gap-1">
                  <span className="w-4 h-1.5 bg-blue-500/70 rounded-full" />
                  <span className="w-4 h-1.5 bg-yellow-500/70 rounded-full" />
                  <span className="w-4 h-1.5 bg-cyan-500/70 rounded-full" />
                </div>
              </div>
              <span className="text-[8px] font-mono text-slate-400 shrink-0 ml-2">
                BRUSH PASS-THROUGH
              </span>
            </div>
          </div>
        );

      case 'SERVER':
        return (
          <div className="py-1">
            <div className="flex items-center justify-between gap-2">
              {/* Drive Bays */}
              <div className="flex items-center gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="w-3 h-5 bg-slate-950 border border-slate-700 rounded-xs flex flex-col justify-between p-0.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    <div className="w-full h-0.5 bg-slate-700" />
                  </div>
                ))}
              </div>
              {/* Server Bezel Status LCD */}
              <div className="bg-blue-950/60 border border-blue-500/30 px-2 py-0.5 rounded text-[8px] font-mono text-blue-300">
                iDRAC9 • OK
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-between py-0.5 text-[10px] text-slate-400 font-mono">
            <span>{dev.device_type}</span>
            <span>Status Verified</span>
          </div>
        );
    }
  };

  // Card background styling based on equipment category and status
  const getDeviceCardStyle = (type: string, status: string) => {
    let border = 'border-slate-700 hover:border-slate-500';
    let bg = 'bg-slate-900/90';

    if (status === 'CRITICAL') {
      border = 'border-rose-500/80 shadow-lg shadow-rose-950/40 glow-rose';
      bg = 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/20';
    } else if (status === 'WARNING') {
      border = 'border-amber-500/70 glow-amber';
      bg = 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20';
    } else {
      if (type === 'SWITCH') {
        bg = 'bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900';
        border = 'border-indigo-500/40 hover:border-indigo-400';
      } else if (type === 'BLADE_CHASSIS') {
        bg = 'bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900';
        border = 'border-emerald-500/40 hover:border-emerald-400';
      } else if (type === 'CABLE_ORGANIZER') {
        bg = 'bg-slate-900/50';
        border = 'border-slate-800';
      }
    }

    return `${border} ${bg}`;
  };

  if (!currentRack) {
    return (
      <div className="p-8 text-center text-slate-400">
        Loading datacenter rack layout...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Metrics Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Rack Switcher & Multi-Rack Compare Toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Active Server Rack:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedRackId}
                onChange={(e) => onSelectRack(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              >
                {racks.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              {onNavigateToAddRack && isAdminGranted && (
                <button
                  type="button"
                  onClick={onNavigateToAddRack}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-emerald-500/60 text-slate-300 hover:text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Deploy a new 42U / 48U Server Rack"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Add</span> Rack
                </button>
              )}

              {/* Side-by-Side Multi-Rack Toggle */}
              <button
                type="button"
                onClick={() => setCompareMode(!compareMode)}
                className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                  compareMode
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 glow-emerald'
                    : 'bg-slate-950 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Toggle Side-by-Side Dual Rack Comparison"
              >
                <SplitSquareVertical className="w-4 h-4" />
                <span>Side-by-Side Compare</span>
              </button>
            </div>
          </div>

          {/* Secondary rack selector when in compare mode */}
          {compareMode && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Compare Against:
              </label>
              <select
                value={secondRack?.id || ''}
                onChange={(e) => setSecondRackId(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {racks.filter(r => r.id !== selectedRackId).map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filter:
          </span>
          {(['ALL', 'ONLINE', 'WARNING', 'CRITICAL'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                statusFilter === st
                  ? st === 'ONLINE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 glow-emerald'
                    : st === 'WARNING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 glow-amber'
                    : st === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose'
                    : 'bg-slate-700 text-white'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Rack Telemetry & Capacity Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>U-Space Utilization</span>
            <span className="font-mono font-bold text-slate-200">{rackStats.usedU}/42 U</span>
          </div>
          <div className="mt-2 w-full h-2 rounded-full bg-slate-950 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${rackStats.percentUsed}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">
            {rackStats.freeU} Available Units Free
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Power Draw (Watts)</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-amber-400">
            {rackStats.power.toLocaleString()} W
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Est. PDU Load: {Math.round((rackStats.power / 10000) * 100)}% of 10kW
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Thermal Ingress</span>
            <ThermometerSun className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-1 font-mono text-lg font-extrabold text-sky-300">
            21.4°C (70.5°F)
          </div>
          <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> ASHRAE Compliant
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Operational Health</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 font-mono text-xs sm:text-sm font-semibold flex items-center gap-2">
            <span className="text-emerald-400">{rackStats.online} Online</span>
            {rackStats.warn > 0 && <span className="text-amber-400">• {rackStats.warn} Warn</span>}
            {rackStats.crit > 0 && <span className="text-rose-400">• {rackStats.crit} Alert</span>}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {currentRack.devices?.length || 0} Assets Deployed
          </div>
        </div>
      </div>

      {/* Main 42U Rack Elevation Canvas */}
      <div className={`flex flex-col ${compareMode ? 'lg:flex-row' : ''} gap-6 items-start`}>
        {renderRackColumn(currentRack)}
        {compareMode && secondRack && renderRackColumn(secondRack, true)}
      </div>
    </div>
  );
}
