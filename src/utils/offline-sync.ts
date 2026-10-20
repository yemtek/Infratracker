import { DeviceType, DeviceStatus } from '../types/index.ts';

export interface QueuedDevice {
  kind?: 'DEVICE';
  localId: string;
  name: string;
  model: string;
  deviceType: DeviceType;
  serialNumber: string;
  macAddress?: string;
  ipAddress?: string;
  startU: number;
  unitHeight: number;
  status: DeviceStatus;
  powerWatts: number;
  rackId: string;
  rackName?: string;
  siteName?: string;
  portCount: number;
  defaultPortType?: string;
  queuedAt: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  errorMessage?: string;
}

export interface QueuedRack {
  kind: 'RACK';
  localId: string;
  name: string;
  siteId: string;
  siteName?: string;
  height: number;
  queuedAt: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  errorMessage?: string;
}

export interface QueuedSite {
  kind: 'SITE';
  localId: string;
  name: string;
  location: string;
  address?: string;
  queuedAt: string;
  syncStatus: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  errorMessage?: string;
}

export type OfflineQueueItem = 
  | (QueuedDevice & { kind?: 'DEVICE' })
  | QueuedRack 
  | QueuedSite;

const STORAGE_KEY = 'infratrack_offline_intake_queue';
const SIMULATION_KEY = 'infratrack_simulated_server_room_offline';

// Sound feedback using Web Audio API (100% offline, zero external audio files)
export function playHapticSound(type: 'success' | 'warning' | 'error' = 'success') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }

    // Haptic vibration on mobile devices
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'success') {
        navigator.vibrate([60, 40, 60]);
      } else if (type === 'warning') {
        navigator.vibrate([100, 50, 100]);
      } else {
        navigator.vibrate([200]);
      }
    }
  } catch {
    // Audio context may be restricted before user gesture
  }
}

// Queue Management
export function getOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse offline queue:', err);
    return [];
  }
}

// Save Device to offline queue (compatible with original saveToOfflineQueue)
export function saveToOfflineQueue(
  data: Omit<QueuedDevice, 'localId' | 'queuedAt' | 'syncStatus'>
): QueuedDevice {
  const queue = getOfflineQueue();

  const newItem: QueuedDevice = {
    ...data,
    kind: 'DEVICE',
    localId: `offline-device-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    queuedAt: new Date().toISOString(),
    syncStatus: 'PENDING',
  };

  const updated = [newItem, ...queue];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  playHapticSound('success');

  window.dispatchEvent(new CustomEvent('infratrack:queue-updated', { detail: updated }));
  return newItem;
}

export const saveDeviceToOfflineQueue = saveToOfflineQueue;

// Save Rack to offline queue
export function saveRackToOfflineQueue(data: {
  name: string;
  siteId: string;
  siteName?: string;
  height: number;
}): QueuedRack {
  const queue = getOfflineQueue();

  const newItem: QueuedRack = {
    kind: 'RACK',
    localId: `offline-rack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: data.name,
    siteId: data.siteId,
    siteName: data.siteName,
    height: data.height,
    queuedAt: new Date().toISOString(),
    syncStatus: 'PENDING',
  };

  const updated = [newItem, ...queue];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  playHapticSound('success');

  window.dispatchEvent(new CustomEvent('infratrack:queue-updated', { detail: updated }));
  return newItem;
}

// Save Facility/Site to offline queue
export function saveSiteToOfflineQueue(data: {
  name: string;
  location: string;
  address?: string;
}): QueuedSite {
  const queue = getOfflineQueue();

  const newItem: QueuedSite = {
    kind: 'SITE',
    localId: `offline-site-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: data.name,
    location: data.location,
    address: data.address,
    queuedAt: new Date().toISOString(),
    syncStatus: 'PENDING',
  };

  const updated = [newItem, ...queue];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  playHapticSound('success');

  window.dispatchEvent(new CustomEvent('infratrack:queue-updated', { detail: updated }));
  return newItem;
}

export function removeFromOfflineQueue(localId: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter(item => item.localId !== localId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent('infratrack:queue-updated', { detail: filtered }));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('infratrack:queue-updated', { detail: [] }));
}

// Server Room Simulation: Lets technicians test or force offline mode even on Wi-Fi
export function isServerRoomSimulatedOffline(): boolean {
  return localStorage.getItem(SIMULATION_KEY) === 'true';
}

export function setServerRoomSimulatedOffline(active: boolean): void {
  if (active) {
    localStorage.setItem(SIMULATION_KEY, 'true');
  } else {
    localStorage.removeItem(SIMULATION_KEY);
  }
  window.dispatchEvent(new CustomEvent('infratrack:connection-changed'));
}

// Check effective online state (considering physical connectivity + simulation)
export function isEffectiveOnline(): boolean {
  if (isServerRoomSimulatedOffline()) {
    return false;
  }
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

// Execute single item sync
export async function syncOfflineQueueItem(
  item: OfflineQueueItem,
  idMap?: Record<string, string>
): Promise<{ success: boolean; newId?: string; error?: string }> {
  try {
    // 1. SITE sync
    if (item.kind === 'SITE') {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          location: item.location,
          address: item.address || ''
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync site to database');
      }
      removeFromOfflineQueue(item.localId);
      return { success: true, newId: data.id };
    }

    // 2. RACK sync
    if (item.kind === 'RACK') {
      // Resolve siteId in case it was an offline-created site
      const effectiveSiteId = (idMap && idMap[item.siteId]) ? idMap[item.siteId] : item.siteId;
      const res = await fetch('/api/racks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          siteId: effectiveSiteId,
          height: item.height || 42
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync rack to database');
      }
      removeFromOfflineQueue(item.localId);
      return { success: true, newId: data.id };
    }

    // 3. DEVICE sync (kind === 'DEVICE' or default)
    const effectiveRackId = (idMap && idMap[item.rackId]) ? idMap[item.rackId] : item.rackId;
    const payload = {
      name: item.name,
      model: item.model,
      deviceType: item.deviceType,
      serialNumber: item.serialNumber,
      macAddress: item.macAddress,
      ipAddress: item.ipAddress,
      startU: item.startU,
      unitHeight: item.unitHeight,
      status: item.status,
      powerWatts: item.powerWatts,
      rackId: effectiveRackId,
      portCount: item.portCount,
      defaultPortType: item.defaultPortType || 'CAT6',
    };

    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sync hardware to database');
    }

    removeFromOfflineQueue(item.localId);
    return { success: true, newId: data.id };
  } catch (err: any) {
    const queue = getOfflineQueue();
    const updated = queue.map(q => 
      q.localId === item.localId 
        ? { ...q, syncStatus: 'FAILED' as const, errorMessage: err.message || 'Sync failed' }
        : q
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('infratrack:queue-updated', { detail: updated }));
    return { success: false, error: err.message };
  }
}

// Synchronize all pending offline actions in topological order (Sites -> Racks -> Devices)
export async function syncAllOfflineQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<{ successCount: number; failCount: number; errors: { localId: string; error: string }[] }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { successCount: 0, failCount: 0, errors: [] };

  // Sort queue so dependencies resolve: SITES first, then RACKS, then DEVICES
  const sites = queue.filter(item => item.kind === 'SITE');
  const racks = queue.filter(item => item.kind === 'RACK');
  const devices = queue.filter(item => item.kind !== 'SITE' && item.kind !== 'RACK');
  const orderedQueue = [...sites, ...racks, ...devices];

  let successCount = 0;
  let failCount = 0;
  const errors: { localId: string; error: string }[] = [];
  const idMap: Record<string, string> = {};

  for (let i = 0; i < orderedQueue.length; i++) {
    const item = orderedQueue[i];
    const res = await syncOfflineQueueItem(item, idMap);
    if (res.success) {
      successCount++;
      if (res.newId) {
        idMap[item.localId] = res.newId;
      }
    } else {
      failCount++;
      errors.push({ localId: item.localId, error: res.error || 'Unknown error' });
    }
    if (onProgress) {
      onProgress(i + 1, orderedQueue.length);
    }
  }

  if (successCount > 0) {
    playHapticSound('success');
  } else if (failCount > 0) {
    playHapticSound('error');
  }

  return { successCount, failCount, errors };
}

// Export Staged Queue as CSV (Handy for shift handoffs & datacenter records)
export function exportQueueToCSV(): void {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;

  const headers = ['Action Type', 'Item Name', 'Details', 'Target Rack / Facility', 'Serial Number', 'Timestamp', 'Status'];
  const rows = queue.map(item => {
    if (item.kind === 'SITE') {
      return [
        '"FACILITY_DEPLOY"',
        `"${item.name}"`,
        `"${item.location} - ${item.address || ''}"`,
        '""',
        '""',
        `"${item.queuedAt}"`,
        `"${item.syncStatus}"`
      ];
    }
    if (item.kind === 'RACK') {
      return [
        '"RACK_DEPLOY"',
        `"${item.name}"`,
        `"${item.height}U Enclosure"`,
        `"${item.siteName || item.siteId}"`,
        '""',
        `"${item.queuedAt}"`,
        `"${item.syncStatus}"`
      ];
    }
    return [
      '"HARDWARE_INTAKE"',
      `"${item.name}"`,
      `"${item.model} (${item.deviceType}) U${item.startU}-${item.startU + item.unitHeight - 1}"`,
      `"${item.rackName || item.rackId}"`,
      `"${item.serialNumber}"`,
      `"${item.queuedAt}"`,
      `"${item.syncStatus}"`
    ];
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `InfraTrack_Offline_Queue_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
