import React, { useState, useEffect } from 'react';
import { 
  X, Server, Cpu, Activity, Zap, Network, Shield, Trash2, 
  ExternalLink, Hash, Radio, HardDrive, AlertTriangle, CheckCircle2,
  Edit, Save, Check
} from 'lucide-react';
import { Device, Port, DeviceStatus, DeviceType } from '../types/index.ts';

interface DeviceDetailModalProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (deviceId: string) => void;
  onStatusChange?: (deviceId: string, newStatus: Device['status']) => void;
  onTracePort?: (port: Port) => void;
  onUpdateDevice?: (deviceId: string, updatedData: Partial<Device>) => Promise<void>;
  initialEditMode?: boolean;
  isAdminGranted?: boolean;
}

export function DeviceDetailModal({
  device,
  isOpen,
  onClose,
  onDelete,
  onStatusChange,
  onTracePort,
  onUpdateDevice,
  initialEditMode = false,
  isAdminGranted = false
}: DeviceDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable form state
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('SERVER');
  const [serialNumber, setSerialNumber] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [startU, setStartU] = useState<number>(1);
  const [unitHeight, setUnitHeight] = useState<number>(1);
  const [powerWatts, setPowerWatts] = useState<number>(350);
  const [status, setStatus] = useState<DeviceStatus>('ONLINE');

  useEffect(() => {
    if (device) {
      setName(device.name || '');
      setModel(device.model || '');
      setDeviceType(device.device_type || 'SERVER');
      setSerialNumber(device.serial_number || '');
      setMacAddress(device.mac_address || '');
      setIpAddress(device.ip_address || '');
      setStartU(device.start_u || 1);
      setUnitHeight(device.unit_height || 1);
      setPowerWatts(device.power_watts || 0);
      setStatus(device.status || 'ONLINE');
      setIsEditing(initialEditMode);
      setConfirmDelete(false);
    }
  }, [device, isOpen, initialEditMode]);

  if (!isOpen || !device) return null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateDevice) return;
    setIsSaving(true);
    try {
      await onUpdateDevice(device.id, {
        name,
        model,
        device_type: deviceType,
        serial_number: serialNumber,
        mac_address: macAddress || null,
        ip_address: ipAddress || null,
        start_u: startU,
        unit_height: unitHeight,
        power_watts: powerWatts,
        status
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (s: Device['status']) => {
    switch (s) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 glow-emerald">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            ONLINE
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 glow-amber">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            WARNING
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 glow-rose">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            CRITICAL
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            MAINTENANCE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {s}
          </span>
        );
    }
  };

  const getPortTypeBadge = (type: string) => {
    switch (type) {
      case 'SINGLE_MODE_FIBER':
        return <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">SMF Fiber</span>;
      case 'MULTI_MODE_FIBER':
        return <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">MMF Fiber</span>;
      case 'QSFP28':
      case 'SFP28':
        return <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">{type} 100G</span>;
      default:
        return <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">Cat6 RJ45</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-bold text-slate-100 text-base sm:text-lg">
                  {isEditing ? `Edit Asset: ${device.name}` : device.name}
                </h3>
                {!isEditing && getStatusBadge(device.status)}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {device.model} • {device.device_type}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onUpdateDevice && isAdminGranted && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isEditing 
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Edit className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Asset'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Edit Mode vs View Mode */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Device Hostname: *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Hardware Model: *</label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Category / Type:</label>
                <select
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="SERVER">Server / Compute Node</option>
                  <option value="SWITCH">Network Switch</option>
                  <option value="FIREWALL">Firewall Appliance</option>
                  <option value="BLADE_CHASSIS">Modular Blade Chassis</option>
                  <option value="PATCH_PANEL">Patch Panel</option>
                  <option value="CABLE_ORGANIZER">Cable Organizer</option>
                  <option value="PDU">Rack PDU / Power</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Operational Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as DeviceStatus)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ONLINE">ONLINE</option>
                  <option value="WARNING">WARNING</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="MAINTENANCE">MAINTENANCE</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Serial Number / Tag: *</label>
                <input
                  type="text"
                  required
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">MAC Address:</label>
                <input
                  type="text"
                  value={macAddress}
                  onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Management IP Address:</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sky-300 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Power Draw (Watts):</label>
                <input
                  type="number"
                  min={0}
                  value={powerWatts}
                  onChange={(e) => setPowerWatts(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-amber-400 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving Changes...' : 'Save Asset Specifications'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Quick Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-500" /> Rack Unit Slot
                </div>
                <div className="text-sm font-semibold font-mono text-slate-200 mt-1">
                  U{device.start_u} {device.unit_height > 1 ? `- U${device.start_u + device.unit_height - 1}` : ''} ({device.unit_height}U)
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Power Draw
                </div>
                <div className="text-sm font-semibold font-mono text-amber-400 mt-1">
                  {device.power_watts || 0} Watts
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-sky-400" /> Management IP
                </div>
                <div className="text-xs font-semibold font-mono text-sky-300 mt-1 truncate">
                  {device.ip_address || 'Unassigned'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-400" /> Serial / Tag
                </div>
                <div className="text-xs font-semibold font-mono text-indigo-300 mt-1 truncate">
                  {device.serial_number}
                </div>
              </div>
            </div>

            {/* MAC & Network Details */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Hardware MAC Address: </span>
                <span className="font-mono text-slate-200 font-semibold">{device.mac_address || 'N/A (Layer 1 Asset)'}</span>
              </div>
              {device.rack_name && (
                <div>
                  <span className="text-slate-400 font-medium">Enclosure: </span>
                  <span className="font-semibold text-emerald-400">{device.rack_name}</span>
                </div>
              )}
            </div>

            {/* Physical Interfaces / Ports Matrix */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-slate-200">
                    Physical Port Interfaces ({device.ports?.length || 0})
                  </h4>
                </div>
                <span className="text-xs text-slate-400">
                  {device.ports?.filter(p => p.connected_port_id).length || 0} Connected
                </span>
              </div>

              {device.ports && device.ports.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {device.ports.map((port) => {
                    const isConnected = !!port.connected_port_id;
                    return (
                      <div
                        key={port.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              port.status === 'UP'
                                ? 'bg-emerald-400 animate-pulse'
                                : 'bg-rose-500'
                            }`}
                          />
                          <div>
                            <div className="font-mono font-bold text-slate-200">
                              {port.port_name || `Port ${port.port_number}`}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {port.speed_mbps >= 1000 ? `${port.speed_mbps / 1000} Gbps` : `${port.speed_mbps} Mbps`} • Duplex Full
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5">
                          {getPortTypeBadge(port.port_type)}
                          {isConnected ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Linked
                              </span>
                              {onTracePort && (
                                <button
                                  onClick={() => {
                                    onTracePort(port);
                                    onClose();
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                                  title="Trace Cable Path"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded">
                              Unpatched
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                  No active physical ports configured for this unit.
                </div>
              )}
            </div>

            {/* Operational Status Toggles */}
            {onStatusChange && isAdminGranted && (
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Operational Status Override:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ONLINE', 'WARNING', 'CRITICAL'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onStatusChange(device.id, s)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        device.status === s
                          ? s === 'ONLINE'
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                            : s === 'WARNING'
                            ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                            : 'bg-rose-600/20 border-rose-500 text-rose-300'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions with In-App Confirmation (Zero window.confirm) */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          {onDelete && !isEditing && isAdminGranted ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 animate-in fade-in">
                <span className="text-xs text-rose-400 font-semibold">Permanently delete?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(device.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
                >
                  Yes, Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Decommission Asset
              </button>
            )
          ) : <div />}

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
