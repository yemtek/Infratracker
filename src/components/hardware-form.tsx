import React, { useState, useMemo, useEffect } from 'react';
import { 
  Server, PlusCircle, Camera, Check, AlertTriangle, 
  ShieldCheck, Cpu, HardDrive, Zap, Network, Hash, 
  MapPin, Layers, RefreshCw, Barcode, CheckCircle2, Lock, Crown,
  Wifi, WifiOff, Clock, ArrowRight
} from 'lucide-react';
import { Site, Rack, Device, DeviceType, DeviceStatus } from '../types/index.ts';
import { ScannerModal } from './scanner-modal.tsx';
import { saveToOfflineQueue, getOfflineQueue, isEffectiveOnline, playHapticSound, QueuedDevice } from '../utils/offline-sync.ts';

interface HardwareFormProps {
  sites: Site[];
  racks: Rack[];
  preselectedRackId?: string;
  preselectedStartU?: number;
  onSubmit: (deviceData: any) => Promise<void>;
  onCancel?: () => void;
  isAdminGranted?: boolean;
  onOpenLogin?: () => void;
  isOnline?: boolean;
  onOpenOfflineQueue?: () => void;
  offlineQueuedCount?: number;
}

export function HardwareForm({
  sites,
  racks,
  preselectedRackId,
  preselectedStartU,
  onSubmit,
  onCancel,
  isAdminGranted = false,
  onOpenLogin,
  isOnline = true,
  onOpenOfflineQueue,
  offlineQueuedCount = 0
}: HardwareFormProps) {
  const [siteId, setSiteId] = useState<string>(sites[0]?.id || '');
  const [rackId, setRackId] = useState<string>(preselectedRackId || racks[0]?.id || '');
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceType>('SERVER');
  const [serialNumber, setSerialNumber] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [startU, setStartU] = useState<number>(preselectedStartU || 1);
  const [unitHeight, setUnitHeight] = useState<number>(1);
  const [powerWatts, setPowerWatts] = useState<number>(350);
  const [status, setStatus] = useState<DeviceStatus>('ONLINE');
  const [portCount, setPortCount] = useState<number>(4);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Sync props when preselected values change
  useEffect(() => {
    if (preselectedRackId) {
      setRackId(preselectedRackId);
      const rack = racks.find(r => r.id === preselectedRackId);
      if (rack) setSiteId(rack.site_id);
    }
  }, [preselectedRackId, racks]);

  useEffect(() => {
    if (preselectedStartU) {
      setStartU(preselectedStartU);
    }
  }, [preselectedStartU]);

  // Selected rack object
  const currentRack = useMemo(() => {
    return racks.find(r => r.id === rackId) || null;
  }, [racks, rackId]);

  // Racks for selected site
  const filteredRacks = useMemo(() => {
    if (!siteId) return racks;
    return racks.filter(r => r.site_id === siteId);
  }, [racks, siteId]);

  // Live Collision Detection (checking both server database devices AND local offline queued devices)
  const collisionConflict = useMemo(() => {
    if (!currentRack) return null;
    const endU = startU + unitHeight - 1;

    // 1. Check existing rack devices
    if (currentRack.devices) {
      for (const dev of currentRack.devices) {
        const devEndU = dev.start_u + dev.unit_height - 1;
        const overlaps = !(endU < dev.start_u || startU > devEndU);
        if (overlaps) {
          return { name: dev.name, model: dev.model, start_u: dev.start_u, unit_height: dev.unit_height, isQueued: false };
        }
      }
    }

    // 2. Check offline queued devices for this rack
    const queuedDevices = getOfflineQueue().filter(
      (q): q is QueuedDevice => (q.kind === 'DEVICE' || !q.kind) && (q as QueuedDevice).rackId === currentRack.id
    );
    for (const q of queuedDevices) {
      const qEndU = q.startU + q.unitHeight - 1;
      const overlaps = !(endU < q.startU || startU > qEndU);
      if (overlaps) {
        return { name: q.name, model: q.model, start_u: q.startU, unit_height: q.unitHeight, isQueued: true };
      }
    }

    return null;
  }, [currentRack, startU, unitHeight]);

  // Handle Enterprise Presets for quick autofill
  const enterprisePresets = [
    {
      name: 'Dell PowerEdge R750',
      type: 'SERVER' as DeviceType,
      height: 2,
      power: 750,
      ports: 4,
      model: 'Dell PowerEdge R750 2U'
    },
    {
      name: 'Cisco Catalyst 9300-48P',
      type: 'SWITCH' as DeviceType,
      height: 1,
      power: 600,
      ports: 48,
      model: 'Cisco Catalyst 9300 48-Port PoE+'
    },
    {
      name: 'Ubiquiti UniFi Pro 48',
      type: 'SWITCH' as DeviceType,
      height: 1,
      power: 450,
      ports: 48,
      model: 'Ubiquiti UniFi Switch Pro 48 PoE'
    },
    {
      name: 'Dell PowerEdge MX7000',
      type: 'BLADE_CHASSIS' as DeviceType,
      height: 4,
      power: 2400,
      ports: 8,
      model: 'Dell PowerEdge MX7000 Modular Chassis'
    },
    {
      name: 'Fortinet FortiGate 100F',
      type: 'FIREWALL' as DeviceType,
      height: 1,
      power: 120,
      ports: 8,
      model: 'Fortinet FortiGate 100F Next-Gen'
    },
    {
      name: 'Panduit 1U Brush Manager',
      type: 'CABLE_ORGANIZER' as DeviceType,
      height: 1,
      power: 0,
      ports: 0,
      model: 'Panduit Horizontal Brush Strip'
    }
  ];

  const handleApplyPreset = (p: typeof enterprisePresets[0]) => {
    setModel(p.model);
    setDeviceType(p.type);
    setUnitHeight(p.height);
    setPowerWatts(p.power);
    setPortCount(p.ports);
    if (!name) {
      setName(p.name.replace(/\s+/g, '-').toUpperCase());
    }
    playHapticSound('success');
  };

  const handleScanResult = (result: { serial: string; mac?: string; model?: string }) => {
    setSerialNumber(result.serial);
    if (result.mac) setMacAddress(result.mac);
    if (result.model) {
      setModel(result.model);
      if (!name) setName(`${result.model.split(' ')[0]}-${result.serial.slice(-4)}`.toUpperCase());
    }
    setFormSuccess(`Scanned Barcode: ${result.serial} (Audio beep verified)`);
    setTimeout(() => setFormSuccess(null), 4000);
  };

  const handleSaveOffline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!name.trim() || !model.trim() || !serialNumber.trim() || !rackId) {
      setFormError('Please fill in Device Name, Model, Serial Number, and Rack.');
      return;
    }

    if (collisionConflict) {
      setFormError(`Cannot place hardware: U${startU}-U${startU + unitHeight - 1} collides with "${collisionConflict.name}" at U${collisionConflict.start_u}.`);
      return;
    }

    if (startU + unitHeight - 1 > 42) {
      setFormError(`Unit height extends to U${startU + unitHeight - 1}, exceeding the 42U rack boundary.`);
      return;
    }

    const currentSiteObj = sites.find(s => s.id === siteId);

    saveToOfflineQueue({
      name,
      model,
      deviceType,
      serialNumber: serialNumber.trim().toUpperCase(),
      macAddress: macAddress.trim() || undefined,
      ipAddress: ipAddress.trim() || undefined,
      startU,
      unitHeight,
      status,
      powerWatts,
      rackId,
      rackName: currentRack?.name || 'Selected Rack',
      siteName: currentSiteObj?.name || 'Selected Facility',
      portCount,
      defaultPortType: 'CAT6'
    });

    setFormSuccess(`Asset "${name}" successfully saved to Server Room Offline Queue! Staged for ${currentRack?.name || 'Rack'} at U${startU}.`);
    
    // Clear form
    setName('');
    setModel('');
    setSerialNumber('');
    setMacAddress('');
    setIpAddress('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (collisionConflict) {
      setFormError(`Cannot place hardware: U${startU}-U${startU + unitHeight - 1} collides with "${collisionConflict.name}" (U${collisionConflict.start_u}-U${collisionConflict.start_u + collisionConflict.unit_height - 1}).`);
      return;
    }

    if (startU + unitHeight - 1 > 42) {
      setFormError(`Unit height extends to U${startU + unitHeight - 1}, which exceeds the 42U rack boundary.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name,
        model,
        deviceType,
        serialNumber: serialNumber.trim().toUpperCase(),
        macAddress: macAddress.trim() || undefined,
        ipAddress: ipAddress.trim() || undefined,
        startU,
        unitHeight,
        status,
        powerWatts,
        rackId,
        portCount
      });

      playHapticSound('success');
      // Reset form fields
      setName('');
      setModel('');
      setSerialNumber('');
      setMacAddress('');
      setIpAddress('');
    } catch (err: any) {
      playHapticSound('warning');
      // Fallback: save to offline queue if submit threw network error
      handleSaveOffline();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdminGranted) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Hardware Intake Authorization Required
            </h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Mounting and registering physical server hardware into datacenter rack enclosures is restricted to users with Admin privileges granted by Super Admin EMZEE.
            </p>
          </div>

          {/* Super Admin Credentials card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <Crown className="w-4 h-4 text-rose-400" />
              <span>Super Admin Master Details:</span>
            </div>
            <div className="text-xs font-mono text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span>bossyemzee@gmail.com</span>
              <span className="text-[10px] text-rose-400 font-bold">SUPER_ADMIN</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            {onOpenLogin && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                <Crown className="w-4 h-4 text-amber-300" />
                <span>Sign In as Super Admin / Persona</span>
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
              >
                Back to Rack Elevation
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Offline / Server Room Signal Notice Banner */}
      {!isOnline ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 border border-amber-500/40 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-white text-xs sm:text-sm block">
                Server Room Field Mode Active (Offline)
              </span>
              <span className="text-amber-200/90 text-xs block">
                Weak signal detected in server room. Hardware scans and specs are safely staged in local browser storage.
              </span>
            </div>
          </div>
          {onOpenOfflineQueue && (
            <button
              type="button"
              onClick={onOpenOfflineQueue}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <span>Queue ({offlineQueuedCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        offlineQueuedCount > 0 && onOpenOfflineQueue && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>You have {offlineQueuedCount} staged assets from the server room ready to sync to PostgreSQL!</span>
            </div>
            <button
              type="button"
              onClick={onOpenOfflineQueue}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shrink-0"
            >
              Review &amp; Sync
            </button>
          </div>
        )
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 glow-emerald">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                Hardware Intake &amp; Asset Registry Form
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 ${
                !isOnline ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
              }`}>
                {!isOnline ? <WifiOff className="w-2.5 h-2.5" /> : <Wifi className="w-2.5 h-2.5" />}
                {!isOnline ? 'Offline Queue Ready' : 'Database Connected'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Provision datacenter assets with offline barcode scan, slot collision check &amp; zero-signal buffer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Camera / Barcode OCR Scanner Trigger */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-none min-h-[42px] px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold text-xs flex items-center justify-center gap-2 glow-emerald active:scale-95 transition-all"
          >
            <Camera className="w-4 h-4 text-emerald-400" />
            <span>Scan Barcode / Service Tag</span>
          </button>

          {onOpenOfflineQueue && (
            <button
              type="button"
              onClick={onOpenOfflineQueue}
              className="min-h-[42px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Open Server Room Sync Queue"
            >
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-cyan-300 font-bold">{offlineQueuedCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Alert */}
      {formSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{formSuccess}</span>
          </div>
          {onOpenOfflineQueue && (
            <button
              type="button"
              onClick={onOpenOfflineQueue}
              className="text-emerald-400 hover:text-white underline text-xs font-bold shrink-0"
            >
              View Sync Queue &rarr;
            </button>
          )}
        </div>
      )}

      {/* Error Alert */}
      {formError && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-semibold">{formError}</span>
          </div>
          <button
            type="button"
            onClick={() => handleSaveOffline()}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 text-xs font-bold transition-all shrink-0"
          >
            Stage Offline Instead
          </button>
        </div>
      )}

      {/* Enterprise Quick Presets Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Quick Enterprise Specifications
          </span>
          <span className="text-[11px] text-slate-500 font-mono">1-Click Auto-fill</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {enterprisePresets.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handleApplyPreset(p)}
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 hover:text-white shrink-0 transition-all flex items-center gap-2 active:scale-95"
            >
              <span>{p.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 border border-emerald-500/20">
                {p.height}U
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Facility & Rack Enclosure Target */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-3">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>1. Physical Rack Placement Target</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Datacenter Site:
              </label>
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  const firstRack = racks.find(r => r.site_id === e.target.value);
                  if (firstRack) setRackId(firstRack.id);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Rack Enclosure:
              </label>
              <select
                value={rackId}
                onChange={(e) => setRackId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-semibold"
              >
                {filteredRacks.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.height || 42}U Enclosure)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Hardware Specifications */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>2. Asset Specifications &amp; Identifiers</span>
            </div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Scan Barcode</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Device Hostname / Asset Label:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SVR-ASH-APP-04"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hardware Model:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dell PowerEdge R750 2U"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Device Category:
              </label>
              <select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="SERVER">Server (Compute Node)</option>
                <option value="SWITCH">Switch (Top-of-Rack / Spine)</option>
                <option value="ROUTER">Core Router / Edge Gateway</option>
                <option value="FIREWALL">Security Appliance / Firewall</option>
                <option value="STORAGE">SAN / NAS Storage Array</option>
                <option value="BLADE_CHASSIS">Blade Modular Chassis</option>
                <option value="PDU">Rack Power Distribution (PDU)</option>
                <option value="PATCH_PANEL">Fiber / Cat6 Patch Panel</option>
                <option value="CABLE_ORGANIZER">Horizontal Cable Organizer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Serial Number / Service Tag:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. 7BR8QK2"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400"
                  title="Scan with Camera"
                >
                  <Barcode className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Primary MAC Address (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. B0:4F:13:55:66:77"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Management IP (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. 10.240.12.45"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Physical Rack U Geometry & Electrical Power */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-3">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>3. Unit Geometry &amp; Capacity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Start Position (U):
              </label>
              <input
                type="number"
                min={1}
                max={42}
                required
                value={startU}
                onChange={(e) => setStartU(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Height (RU):
              </label>
              <select
                value={unitHeight}
                onChange={(e) => setUnitHeight(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 font-bold"
              >
                <option value={1}>1U (Standard)</option>
                <option value={2}>2U (Dual-Socket Svr)</option>
                <option value={3}>3U (Storage Shelf)</option>
                <option value={4}>4U (Blade Chassis)</option>
                <option value={8}>8U (Mainframe/Encl)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Max Power Draw (Watts):
              </label>
              <input
                type="number"
                min={0}
                max={15000}
                value={powerWatts}
                onChange={(e) => setPowerWatts(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Initial Port Count:
              </label>
              <select
                value={portCount}
                onChange={(e) => setPortCount(parseInt(e.target.value, 10))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value={0}>0 Ports (Passive Asset)</option>
                <option value={2}>2 Ports (Dual NIC)</option>
                <option value={4}>4 Ports (Quad NIC)</option>
                <option value={8}>8 Ports (Blade / Host)</option>
                <option value={24}>24 Ports (Switch / Patch)</option>
                <option value={48}>48 Ports (Full Switch)</option>
              </select>
            </div>
          </div>

          {/* Live Slot Collision Warning / Pass Banner */}
          <div className="mt-4">
            {collisionConflict ? (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    <strong>Unit Collision Detected:</strong> Units U{startU}-U{startU + unitHeight - 1} overlap with &quot;{collisionConflict.name}&quot; ({collisionConflict.model}) at U{collisionConflict.start_u}
                    {collisionConflict.isQueued ? ' (Staged in Offline Queue)' : ''}.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-rose-400 font-bold shrink-0 ml-2">CONFLICT</span>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Slot Verified:</strong> Units U{startU} through U{startU + unitHeight - 1} ({unitHeight}U) are completely clear in {currentRack?.name}.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-emerald-400 font-bold shrink-0 ml-2">AVAILABLE</span>
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Optional manual offline stage button */}
            <button
              type="button"
              onClick={handleSaveOffline}
              disabled={!!collisionConflict}
              className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Store in offline buffer without network call"
            >
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span>Stage in Offline Queue</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            )}

            {!isOnline ? (
              <button
                type="submit"
                disabled={!!collisionConflict}
                className="min-h-[44px] px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-600/20 disabled:opacity-50 active:scale-95 transition-all"
              >
                <WifiOff className="w-4 h-4" />
                <span>Save to Offline Queue (Server Room Mode)</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !!collisionConflict}
                className="min-h-[44px] px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Registering into Neon DB...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Intake &amp; Mount to Rack</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Modular Camera Barcode Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanResult={handleScanResult}
      />
    </div>
  );
}
