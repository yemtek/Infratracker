import React, { useState, useMemo } from 'react';
import { 
  HardDrive, Search, Filter, Download, ExternalLink, 
  Trash2, Shield, Network, Zap, Hash, Server, Activity,
  SlidersHorizontal, CheckCircle2, AlertTriangle, Eye, Edit, Lock
} from 'lucide-react';
import { Device, DeviceStatus, DeviceType } from '../types/index.ts';

interface AssetInventoryTableProps {
  devices: Device[];
  onSelectDevice: (device: Device) => void;
  onEditDevice?: (device: Device) => void;
  onDeleteDevice: (deviceId: string) => void;
  onNavigateToIntake: () => void;
  adminOnlyMode?: boolean;
  isSuperAdmin?: boolean;
  isAdminGranted?: boolean;
}

export function AssetInventoryTable({
  devices,
  onSelectDevice,
  onEditDevice,
  onDeleteDevice,
  onNavigateToIntake,
  adminOnlyMode = false,
  isSuperAdmin = true,
  isAdminGranted = false
}: AssetInventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const matchesSearch = 
        !searchTerm ||
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.ip_address && d.ip_address.includes(searchTerm)) ||
        (d.mac_address && d.mac_address.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || d.device_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [devices, searchTerm, statusFilter, typeFilter]);

  const exportCSV = () => {
    const headers = ['Hostname', 'Model', 'Category', 'Serial Number', 'MAC Address', 'IP Address', 'Rack Unit', 'Power (W)', 'Status'];
    const rows = filteredDevices.map(d => [
      d.name,
      d.model,
      d.device_type,
      d.serial_number,
      d.mac_address || '',
      d.ip_address || '',
      `U${d.start_u} (${d.unit_height}U)`,
      d.power_watts || 0,
      d.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `infratrack-assets-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            WARN
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            ALERT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Search Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 glow-emerald">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
              Enterprise Asset Inventory Registry
            </h2>
            <p className="text-xs text-slate-400">
              Total Assets Tracked: {devices.length} Units • Filtered: {filteredDevices.length}
            </p>
          </div>
        </div>

        {/* Search, Filter & Export */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search serial, IP, MAC, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={exportCSV}
            className="min-h-[40px] px-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Export CSV spreadsheet"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {isAdminGranted ? (
            <button
              onClick={onNavigateToIntake}
              className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all"
            >
              + Intake Asset
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 font-mono">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Read-Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Status:</span>
          {(['ALL', 'ONLINE', 'WARNING', 'CRITICAL'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Type:</span>
          {(['ALL', 'SERVER', 'SWITCH', 'BLADE_CHASSIS', 'FIREWALL', 'PATCH_PANEL'] as const).map(tp => (
            <button
              key={tp}
              onClick={() => setTypeFilter(tp)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                typeFilter === tp
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tp}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table View (>= 768px) */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Equipment Hostname</th>
                <th className="py-3.5 px-4 font-semibold">Model &amp; Category</th>
                <th className="py-3.5 px-4 font-semibold">Rack Location</th>
                <th className="py-3.5 px-4 font-semibold">Serial / Tag</th>
                <th className="py-3.5 px-4 font-semibold">Management IP</th>
                <th className="py-3.5 px-4 font-semibold">Power</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredDevices.map((dev) => (
                <tr
                  key={dev.id}
                  onClick={() => onSelectDevice(dev)}
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-white">
                    {dev.name}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="text-slate-200 font-sans">{dev.model}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{dev.device_type}</div>
                  </td>
                  <td className="py-3.5 px-4 text-emerald-400 font-semibold">
                    U{dev.start_u}{dev.unit_height > 1 ? `-U${dev.start_u + dev.unit_height - 1}` : ''} ({dev.unit_height}U)
                    <div className="text-[10px] text-slate-500 font-sans">{dev.rack_name}</div>
                  </td>
                  <td className="py-3.5 px-4 text-indigo-300">
                    {dev.serial_number}
                  </td>
                  <td className="py-3.5 px-4 text-sky-300">
                    {dev.ip_address || 'Unassigned'}
                  </td>
                  <td className="py-3.5 px-4 text-amber-400">
                    {dev.power_watts ? `${dev.power_watts}W` : '0W'}
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(dev.status)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectDevice(dev)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Inspect Hardware"
                      >
                        <Eye className="w-4 h-4 text-cyan-400" />
                      </button>

                      {adminOnlyMode ? (
                        <span 
                          className="p-1.5 rounded-lg text-slate-600 cursor-not-allowed" 
                          title="Enterprise Policy: Asset Edit & Delete restricted to Admin Console"
                        >
                          <Shield className="w-3.5 h-3.5 text-slate-600" />
                        </span>
                      ) : (
                        <>
                          {onEditDevice && isAdminGranted && (
                            <button
                              onClick={() => onEditDevice(dev)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                              title="Edit Asset Specifications"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {isAdminGranted && (
                            confirmDeleteId === dev.id ? (
                              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-rose-500/40 animate-in fade-in">
                                <span className="text-[10px] text-rose-400 font-bold">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteDevice(dev.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shadow-sm shadow-rose-600/30"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(dev.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Decommission & Delete Asset"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View (< 768px) with zero horizontal scrolling and 44px touch targets */}
      <div className="md:hidden space-y-3">
        {filteredDevices.map((dev) => (
          <div
            key={dev.id}
            onClick={() => onSelectDevice(dev)}
            className="p-4 rounded-xl bg-slate-900 border border-slate-800 active:bg-slate-850 transition-colors shadow-lg space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-white text-sm font-mono">{dev.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{dev.model}</p>
              </div>
              {getStatusBadge(dev.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block">RACK UNIT</span>
                <span className="text-emerald-400 font-bold">U{dev.start_u} ({dev.unit_height}U)</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">POWER DRAW</span>
                <span className="text-amber-400 font-bold">{dev.power_watts || 0} Watts</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">MGMT IP</span>
                <span className="text-sky-300 truncate block">{dev.ip_address || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">SERIAL TAG</span>
                <span className="text-indigo-300 truncate block">{dev.serial_number}</span>
              </div>
            </div>

            {/* Mobile Actions: Inspect, Edit, Delete */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => onSelectDevice(dev)}
                  className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Inspect</span>
                </button>

                {onEditDevice && isAdminGranted && (!adminOnlyMode || isSuperAdmin) && (
                  <button
                    type="button"
                    onClick={() => onEditDevice(dev)}
                    className="min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    title="Edit Asset"
                  >
                    <Edit className="w-4 h-4 text-sky-400" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {isAdminGranted && (!adminOnlyMode || isSuperAdmin) && (
                confirmDeleteId === dev.id ? (
                  <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-xl border border-rose-500/50 animate-in fade-in">
                    <span className="text-[11px] text-rose-400 font-bold">Delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteDevice(dev.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(dev.id)}
                    className="min-h-[44px] px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Decommission & Delete Asset"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
