import React, { useState, useMemo } from 'react';
import { 
  Cable, Network, Activity, Zap, CheckCircle2, XCircle, 
  ArrowRight, Shield, Layers, Plus, Trash2, Search, 
  ExternalLink, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import { Port, Device, VLAN, PortType } from '../types/index.ts';

interface PortTracerProps {
  ports: Port[];
  devices: Device[];
  vlans: VLAN[];
  onConnectPorts: (sourcePortId: string, destPortId: string, cableType: PortType) => Promise<void>;
  onDisconnectPort: (portId: string) => Promise<void>;
  highlightedPortId?: string | null;
  isAdminGranted?: boolean;
}

export function PortTracer({
  ports,
  devices,
  vlans,
  onConnectPorts,
  onDisconnectPort,
  highlightedPortId,
  isAdminGranted = false
}: PortTracerProps) {
  const [selectedPortId, setSelectedPortId] = useState<string | null>(highlightedPortId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVlanFilter, setSelectedVlanFilter] = useState<string>('ALL');
  const [isPatchModalOpen, setIsPatchModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  // New Cable Patch Wizard State
  const [patchSourceDevId, setPatchSourceDevId] = useState<string>('');
  const [patchSourcePortId, setPatchSourcePortId] = useState<string>('');
  const [patchDestDevId, setPatchDestDevId] = useState<string>('');
  const [patchDestPortId, setPatchDestPortId] = useState<string>('');
  const [patchCableType, setPatchCableType] = useState<PortType>('CAT6');
  const [patchVlanId, setPatchVlanId] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Active selected port object
  const activePort = useMemo(() => {
    return ports.find(p => p.id === (selectedPortId || highlightedPortId)) || null;
  }, [ports, selectedPortId, highlightedPortId]);

  // Destination linked port object
  const linkedPort = useMemo(() => {
    if (!activePort || !activePort.connected_port_id) return null;
    return ports.find(p => p.id === activePort.connected_port_id) || null;
  }, [activePort, ports]);

  // Filtered ports list
  const filteredPorts = useMemo(() => {
    return ports.filter(p => {
      const matchesSearch = 
        !searchTerm ||
        p.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.port_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.dest_device_name?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesVlan = 
        selectedVlanFilter === 'ALL' ||
        (selectedVlanFilter === 'NONE' && !p.vlan_id) ||
        p.vlan_id === selectedVlanFilter;

      return matchesSearch && matchesVlan;
    });
  }, [ports, searchTerm, selectedVlanFilter]);

  // Cable type styling helper
  const getCableVisual = (type: string) => {
    switch (type) {
      case 'SINGLE_MODE_FIBER':
        return {
          label: 'Single-Mode Fiber (OS2)',
          color: '#eab308', // Yellow
          bg: 'bg-yellow-500/15',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
          svgStroke: '#eab308'
        };
      case 'MULTI_MODE_FIBER':
        return {
          label: 'Multi-Mode Fiber (OM4)',
          color: '#06b6d4', // Cyan
          bg: 'bg-cyan-500/15',
          border: 'border-cyan-500/30',
          text: 'text-cyan-400',
          svgStroke: '#06b6d4'
        };
      case 'QSFP28':
      case 'SFP28':
        return {
          label: 'Direct Attach Copper / 100G',
          color: '#a855f7', // Purple
          bg: 'bg-purple-500/15',
          border: 'border-purple-500/30',
          text: 'text-purple-400',
          svgStroke: '#a855f7'
        };
      default:
        return {
          label: 'Cat6 UTP Ethernet',
          color: '#3b82f6', // Blue
          bg: 'bg-blue-500/15',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          svgStroke: '#3b82f6'
        };
    }
  };

  const handleCreatePatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patchSourcePortId || !patchDestPortId) return;
    setIsConnecting(true);
    try {
      await onConnectPorts(patchSourcePortId, patchDestPortId, patchCableType);
      setIsPatchModalOpen(false);
      setSelectedPortId(patchSourcePortId);
      // Reset form
      setPatchSourcePortId('');
      setPatchDestPortId('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (portId: string) => {
    try {
      await onDisconnectPort(portId);
      setConfirmDisconnect(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 glow-blue">
            <Cable className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
              Port-to-Port Cable Tracing Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Real-time physical layer cross-connects, fiber jumpers &amp; Cat6 tracing
            </p>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ports or devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {isAdminGranted && (
            <button
              onClick={() => setIsPatchModalOpen(true)}
              className="min-h-[40px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Cable Patch</span>
            </button>
          )}
        </div>
      </div>

      {/* Cable Type Color Legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <span className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">
          Cable Standards:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-slate-300">Cat6 Copper (RJ45)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="text-slate-300">Single-Mode Fiber (OS2)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-slate-300">Multi-Mode Fiber (OM4)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          <span className="text-slate-300">QSFP28 100G Direct Attach</span>
        </div>
      </div>

      {/* Selected Route Inspector Card */}
      {activePort && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-blue-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden animate-in fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <h3 className="font-bold text-sm text-white">
                Active Cable Circuit Trace
              </h3>
            </div>
            {activePort.connected_port_id && isAdminGranted && (
              confirmDisconnect ? (
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-rose-500/40 animate-in fade-in">
                  <span className="text-[11px] text-rose-400 font-bold">Disconnect Cable?</span>
                  <button
                    type="button"
                    onClick={() => handleDisconnect(activePort.id)}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Disconnect Cable
                </button>
              )
            )}
          </div>

          {/* End-to-End Hop Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Source Endpoint Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                Local Interface (A)
              </span>
              <div className="font-extrabold text-white text-sm mt-1 truncate">
                {activePort.device_name}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {activePort.device_model}
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="font-mono text-xs font-bold text-blue-400">
                  {activePort.port_name || `Port ${activePort.port_number}`}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {activePort.speed_mbps >= 1000 ? `${activePort.speed_mbps / 1000} Gbps` : `${activePort.speed_mbps}M`}
                </span>
              </div>
            </div>

            {/* Central Cable Conduit Status */}
            <div className="flex flex-col items-center justify-center p-3 text-center">
              {activePort.connected_port_id ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 mb-1">
                    <Activity className="w-4 h-4 animate-pulse" /> Signal Active • 100% Link
                  </div>
                  <div className="w-full relative py-2">
                    <div 
                      className="h-1.5 w-full rounded-full"
                      style={{ backgroundColor: getCableVisual(activePort.port_type).color }}
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-slate-200">
                      {getCableVisual(activePort.port_type).label}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-slate-400 mt-2">
                    <span>Loss: -1.8 dBm</span>
                    <span>•</span>
                    <span>Latency: 0.08 ms</span>
                  </div>
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="text-xs text-slate-400 mb-1">Port Unpatched</div>
                  <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                    No active jumper connected
                  </span>
                </div>
              )}
            </div>

            {/* Destination Endpoint Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                Remote Interface (B)
              </span>
              {activePort.connected_port_id ? (
                <>
                  <div className="font-extrabold text-white text-sm mt-1 truncate">
                    {activePort.dest_device_name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {activePort.dest_device_model}
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {activePort.dest_port_name || `Port ${activePort.dest_port_number}`}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {activePort.dest_rack_name}
                    </span>
                  </div>
                </>
              ) : (
                <div className="py-5 text-center text-slate-500 text-xs">
                  Available for patching
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Port Cross-Connect Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-sm text-slate-200">
            Physical Port Interface Registry ({filteredPorts.length} Ports)
          </h3>
          <span className="text-xs text-slate-400">
            Click any port row to trace signal or configure cross-connects
          </span>
        </div>

        {/* Responsive Table / Card Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Local Device</th>
                <th className="py-3.5 px-4 font-semibold">Interface</th>
                <th className="py-3.5 px-4 font-semibold">Media Type</th>
                <th className="py-3.5 px-4 font-semibold">Speed</th>
                <th className="py-3.5 px-4 font-semibold">Link Status</th>
                <th className="py-3.5 px-4 font-semibold">Connected Endpoint (Remote)</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredPorts.map((port) => {
                const isSelected = selectedPortId === port.id;
                const isLinked = !!port.connected_port_id;
                const cableStyle = getCableVisual(port.port_type);

                return (
                  <tr
                    key={port.id}
                    onClick={() => setSelectedPortId(port.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600/15 text-white'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    {/* Device Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-200">{port.device_name}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{port.device_model}</div>
                    </td>

                    {/* Port Name */}
                    <td className="py-3.5 px-4 font-bold text-blue-400">
                      {port.port_name || `Port ${port.port_number}`}
                    </td>

                    {/* Media Type */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${cableStyle.bg} ${cableStyle.border} ${cableStyle.text}`}>
                        {cableStyle.label}
                      </span>
                    </td>

                    {/* Speed */}
                    <td className="py-3.5 px-4 text-slate-400">
                      {port.speed_mbps >= 1000 ? `${port.speed_mbps / 1000} Gbps` : `${port.speed_mbps} Mbps`}
                    </td>

                    {/* Link Status */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isLinked
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isLinked ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        {isLinked ? 'UP (PATCHED)' : 'UNPATCHED'}
                      </span>
                    </td>

                    {/* Remote Endpoint */}
                    <td className="py-3.5 px-4">
                      {isLinked ? (
                        <div className="text-slate-200">
                          <span className="font-bold text-emerald-400">{port.dest_device_name}</span>
                          <span className="text-slate-400"> : {port.dest_port_name || `Port ${port.dest_port_number}`}</span>
                          <div className="text-[10px] text-slate-500 font-sans">{port.dest_rack_name}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">None</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPortId(port.id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-sans font-medium transition-colors"
                      >
                        Trace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Cable Patch Modal (Mobile-first step-by-step card selector) */}
      {isPatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Cable className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    Patch Cable Interconnect Wizard
                  </h3>
                  <p className="text-xs text-slate-400">
                    Connect two physical ports with optical fiber or twisted-pair copper
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPatchModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatch} className="p-6 overflow-y-auto space-y-5">
              {/* Step 1 & 2: Source Selection */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  1. Source Equipment &amp; Port
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Device:</label>
                    <select
                      value={patchSourceDevId}
                      onChange={(e) => {
                        setPatchSourceDevId(e.target.value);
                        setPatchSourcePortId('');
                      }}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Choose Device --</option>
                      {devices.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.model})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Available Port:</label>
                    <select
                      value={patchSourcePortId}
                      onChange={(e) => setPatchSourcePortId(e.target.value)}
                      required
                      disabled={!patchSourceDevId}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                    >
                      <option value="">-- Choose Port --</option>
                      {ports
                        .filter(p => p.device_id === patchSourceDevId)
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.port_name || `Port ${p.port_number}`} ({p.port_type}) {p.connected_port_id ? '[Connected]' : '[Free]'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 3 & 4: Destination Selection */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  2. Destination Equipment &amp; Port
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Target Device:</label>
                    <select
                      value={patchDestDevId}
                      onChange={(e) => {
                        setPatchDestDevId(e.target.value);
                        setPatchDestPortId('');
                      }}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Choose Destination --</option>
                      {devices
                        .filter(d => d.id !== patchSourceDevId)
                        .map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.model})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Target Port:</label>
                    <select
                      value={patchDestPortId}
                      onChange={(e) => setPatchDestPortId(e.target.value)}
                      required
                      disabled={!patchDestDevId}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    >
                      <option value="">-- Choose Port --</option>
                      {ports
                        .filter(p => p.device_id === patchDestDevId)
                        .map(p => (
                          <option key={p.id} value={p.id}>
                            {p.port_name || `Port ${p.port_number}`} ({p.port_type}) {p.connected_port_id ? '[Connected]' : '[Free]'}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 5: Physical Media & Active VLAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Cable Type / Standard:
                  </label>
                  <select
                    value={patchCableType}
                    onChange={(e) => setPatchCableType(e.target.value as PortType)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CAT6">Cat6 UTP Copper (1GbE/10GbE)</option>
                    <option value="SINGLE_MODE_FIBER">Single-Mode Fiber OS2 (Yellow)</option>
                    <option value="MULTI_MODE_FIBER">Multi-Mode Fiber OM4 (Aqua)</option>
                    <option value="QSFP28">QSFP28 / SFP28 100G Direct Attach</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Assigned 802.1Q VLAN:
                  </label>
                  <select
                    value={patchVlanId}
                    onChange={(e) => setPatchVlanId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Default Trunk (Untagged)</option>
                    {vlans.map(v => (
                      <option key={v.id} value={v.id}>
                        VLAN {v.vlan_number} - {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!patchSourcePortId || !patchDestPortId || isConnecting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isConnecting ? 'Linking Ports...' : 'Establish Cable Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
