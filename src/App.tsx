import React, { useState, useEffect, useCallback } from 'react';
import { 
  Server, Cable, PlusCircle, HardDrive, Layers, Database, 
  MapPin, Activity, Zap, RefreshCw, AlertCircle, CheckCircle2,
  ExternalLink, Search, Building2, ShieldCheck, ShieldAlert,
  UserCheck, ChevronDown, SlidersHorizontal, LogOut, LogIn, Lock, Crown,
  Wifi, WifiOff
} from 'lucide-react';
import { MobileNav, NavTab } from './components/mobile-nav.tsx';
import { RackElevation } from './components/rack-elevation.tsx';
import { PortTracer } from './components/port-tracer.tsx';
import { HardwareForm } from './components/hardware-form.tsx';
import { AssetInventoryTable } from './components/asset-inventory-table.tsx';
import { VlanManager } from './components/vlan-manager.tsx';
import { DatacenterManager } from './components/datacenter-manager.tsx';
import { AdminPanel } from './components/admin-panel.tsx';
import { DeviceDetailModal } from './components/device-detail-modal.tsx';
import { AuthModal } from './components/auth-modal.tsx';
import { ThemeToggle } from './components/theme-toggle.tsx';
import { OfflineQueueModal } from './components/offline-queue-modal.tsx';
import { PWAInstallButton } from './components/pwa-install-button.tsx';
import { useOfflineStatus } from './hooks/use-offline-status.ts';
import { 
  saveRackToOfflineQueue, 
  saveSiteToOfflineQueue, 
  saveToOfflineQueue, 
  isEffectiveOnline 
} from './utils/offline-sync.ts';
import { Site, Rack, Device, Port, VLAN, DatabaseStatus, PortType, User } from './types/index.ts';
import { isUserSuperAdmin, isUserAdminGranted } from './utils/permissions.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('elevation');
  const {
    isOnline,
    isSimulatedOffline,
    queue: offlineQueue,
    queuedCount: offlineQueuedCount,
    isSyncing: isOfflineSyncing,
    syncProgress: offlineSyncProgress,
    toggleSimulation: toggleServerRoomSimulation,
    triggerSync: triggerOfflineSync
  } = useOfflineStatus();
  const [isOfflineQueueModalOpen, setIsOfflineQueueModalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('infratrack_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    if (localStorage.getItem('infratrack_guest_mode') === 'true') {
      return null;
    }
    return localStorage.getItem('infratrack_user_email') || null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);

  // Persistent offline-first state caches
  const [sites, setSites] = useState<Site[]>(() => {
    try {
      const raw = localStorage.getItem('infratrack_cache_sites');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('infratrack_cache_sites');
      const list = raw ? JSON.parse(raw) : [];
      return list[0]?.id || '';
    } catch { return ''; }
  });
  const [racks, setRacks] = useState<Rack[]>(() => {
    try {
      const raw = localStorage.getItem('infratrack_cache_racks');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [selectedRackId, setSelectedRackId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('infratrack_cache_racks');
      const list = raw ? JSON.parse(raw) : [];
      return list[0]?.id || '';
    } catch { return ''; }
  });
  const [devices, setDevices] = useState<Device[]>(() => {
    try {
      const raw = localStorage.getItem('infratrack_cache_devices');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [ports, setPorts] = useState<Port[]>(() => {
    try {
      const raw = localStorage.getItem('infratrack_cache_ports');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [vlans, setVlans] = useState<VLAN[]>(() => {
    try {
      const raw = localStorage.getItem('infratrack_cache_vlans');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !localStorage.getItem('infratrack_cache_racks');
  });
  const [isReseeding, setIsReseeding] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Inspector & Modal states
  const [inspectedDevice, setInspectedDevice] = useState<Device | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailModalEditMode, setIsDetailModalEditMode] = useState(false);
  const [highlightedPortId, setHighlightedPortId] = useState<string | null>(null);

  // Preselected slot state for hardware intake
  const [intakePreselect, setIntakePreselect] = useState<{ rackId: string; startU: number } | null>(null);

  // Enterprise mutation policy: Contextual RBAC (default) vs Strict Admin-Only Mode
  const [adminOnlyMode, setAdminOnlyMode] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('infratrack_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSelectUser = (email: string) => {
    setCurrentUserEmail(email);
    localStorage.setItem('infratrack_user_email', email);
    localStorage.removeItem('infratrack_guest_mode');
    showToast(`Signed in as ${email}`);
  };

  const handleLogout = () => {
    setCurrentUserEmail(null);
    localStorage.removeItem('infratrack_user_email');
    localStorage.setItem('infratrack_guest_mode', 'true');
    showToast('Logged out. You are now in Guest Mode (Read-Only).');
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch DB Health
  const fetchDbHealth = async () => {
    if (!isEffectiveOnline()) {
      setDbStatus({
        status: 'connected',
        provider: 'Local Storage (Offline Cache Mode)',
        latencyMs: 0
      });
      return;
    }

    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
      }
    } catch (e: any) {
      if (!isEffectiveOnline()) {
        setDbStatus({
          status: 'connected',
          provider: 'Local Storage (Offline Cache Mode)',
          latencyMs: 0
        });
      } else {
        setDbStatus({
          status: 'error',
          provider: 'Neon.tech PostgreSQL',
          message: e.message
        });
      }
    }
  };

  // Fetch all sites, racks, devices, ports, vlans, users
  const loadAllData = useCallback(async () => {
    if (!isEffectiveOnline()) {
      setIsLoading(false);
      return;
    }

    try {
      const [sitesRes, racksRes, devicesRes, portsRes, vlansRes, usersRes] = await Promise.all([
        fetch('/api/sites'),
        fetch('/api/racks'),
        fetch('/api/devices'),
        fetch('/api/ports'),
        fetch('/api/vlans'),
        fetch('/api/users')
      ]);

      const [sitesData, racksData, devicesData, portsData, vlansData, usersData] = await Promise.all([
        sitesRes.json(),
        racksRes.json(),
        devicesRes.json(),
        portsRes.json(),
        vlansRes.json(),
        usersRes.ok ? usersRes.json() : []
      ]);

      setSites(sitesData);
      localStorage.setItem('infratrack_cache_sites', JSON.stringify(sitesData));
      setSelectedSiteId(prev => {
        if (!sitesData || sitesData.length === 0) return '';
        if (prev && sitesData.some((s: Site) => s.id === prev)) return prev;
        return sitesData[0].id;
      });

      setRacks(racksData);
      localStorage.setItem('infratrack_cache_racks', JSON.stringify(racksData));
      setSelectedRackId(prev => {
        if (!racksData || racksData.length === 0) return '';
        if (prev && racksData.some((r: Rack) => r.id === prev)) return prev;
        return racksData[0].id;
      });

      setDevices(devicesData);
      localStorage.setItem('infratrack_cache_devices', JSON.stringify(devicesData));
      setPorts(portsData);
      localStorage.setItem('infratrack_cache_ports', JSON.stringify(portsData));
      setVlans(vlansData);
      localStorage.setItem('infratrack_cache_vlans', JSON.stringify(vlansData));

      if (Array.isArray(usersData) && usersData.length > 0) {
        setUsers(usersData);
      }
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError') {
        console.log('[InfraTrack] Offline mode active - serving from local cache');
      } else {
        console.error('Error fetching data from API:', err);
        showToast('Error synchronizing with Neon PostgreSQL database', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDbHealth();
    loadAllData();
    // Refresh DB latency every 30s
    const timer = setInterval(fetchDbHealth, 30000);
    return () => clearInterval(timer);
  }, [loadAllData]);

  // Automatic sync when connection is restored
  useEffect(() => {
    const handleAutoSync = async () => {
      if (isEffectiveOnline() && offlineQueuedCount > 0 && !isOfflineSyncing) {
        const res = await triggerOfflineSync();
        if (res && res.successCount > 0) {
          await loadAllData();
          showToast(`Signal restored! ${res.successCount} staged server room ${res.successCount === 1 ? 'item' : 'items'} synced.`);
        }
      }
    };

    window.addEventListener('online', handleAutoSync);
    window.addEventListener('infratrack:connection-changed', handleAutoSync);
    return () => {
      window.removeEventListener('online', handleAutoSync);
      window.removeEventListener('infratrack:connection-changed', handleAutoSync);
    };
  }, [offlineQueuedCount, isOfflineSyncing, triggerOfflineSync, loadAllData]);

  // Fetch single rack with full 42U devices when rack changes
  const fetchSelectedRackDetails = async (rackId: string) => {
    if (!rackId) return;
    try {
      const res = await fetch(`/api/racks/${rackId}`);
      if (res.ok) {
        const fullRack = await res.json();
        setRacks(prev => prev.map(r => r.id === rackId ? fullRack : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedRackId) {
      fetchSelectedRackDetails(selectedRackId);
    }
  }, [selectedRackId]);

  // Reseed enterprise database
  const handleReseedData = async () => {
    setIsReseeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (res.ok) {
        await loadAllData();
        if (selectedRackId) {
          await fetchSelectedRackDetails(selectedRackId);
        }
        showToast('Database reset and restored with enterprise equipment seeds!');
      } else {
        showToast('Failed to reset database', 'error');
      }
    } catch (err) {
      showToast('Failed to reset database', 'error');
    } finally {
      setIsReseeding(false);
    }
  };

  // Hardware Intake Submit
  const handleHardwareSubmit = async (deviceData: any) => {
    if (!isEffectiveOnline()) {
      const targetRack = racks.find(r => r.id === deviceData.rackId);
      const targetSite = sites.find(s => s.id === (targetRack?.site_id || selectedSiteId));
      saveToOfflineQueue({
        ...deviceData,
        rackName: targetRack?.name || 'Selected Rack',
        siteName: targetSite?.name || 'Selected Facility'
      });

      const optimisticDevice: Device = {
        id: `offline-device-${Date.now()}`,
        name: deviceData.name,
        model: deviceData.model,
        device_type: deviceData.deviceType,
        serial_number: deviceData.serialNumber,
        mac_address: deviceData.macAddress,
        ip_address: deviceData.ipAddress,
        start_u: deviceData.startU,
        unit_height: deviceData.unitHeight,
        status: deviceData.status,
        power_watts: deviceData.powerWatts,
        rack_id: deviceData.rackId,
        ports: []
      };

      setDevices(prev => {
        const next = [...prev, optimisticDevice];
        localStorage.setItem('infratrack_cache_devices', JSON.stringify(next));
        return next;
      });

      if (deviceData.rackId) {
        setRacks(prev => {
          const next = prev.map(r => {
            if (r.id === deviceData.rackId) {
              return {
                ...r,
                used_u: (r.used_u || 0) + deviceData.unitHeight,
                total_power_watts: (r.total_power_watts || 0) + deviceData.powerWatts,
                device_count: (r.device_count || 0) + 1,
                devices: [...(r.devices || []), optimisticDevice]
              };
            }
            return r;
          });
          localStorage.setItem('infratrack_cache_racks', JSON.stringify(next));
          return next;
        });
        setSelectedRackId(deviceData.rackId);
      }

      showToast(`Asset "${deviceData.name}" staged in Offline Queue for ${targetRack?.name || 'Rack'}!`);
      setCurrentTab('elevation');
      return;
    }

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deviceData, userEmail: currentUserEmail })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to intake device');
      }

      await loadAllData();
      if (deviceData.rackId) {
        await fetchSelectedRackDetails(deviceData.rackId);
        setSelectedRackId(deviceData.rackId);
      }
      showToast(`Device ${deviceData.name} successfully installed into Rack!`);
      setCurrentTab('elevation');
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError' || err.message?.includes('fetch')) {
        const targetRack = racks.find(r => r.id === deviceData.rackId);
        const targetSite = sites.find(s => s.id === (targetRack?.site_id || selectedSiteId));
        saveToOfflineQueue({
          ...deviceData,
          rackName: targetRack?.name || 'Selected Rack',
          siteName: targetSite?.name || 'Selected Facility'
        });
        showToast(`Offline Mode: Asset "${deviceData.name}" staged locally for sync!`);
        setCurrentTab('elevation');
        return;
      }
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Device Status Update
  const handleDeviceStatusChange = async (deviceId: string, newStatus: Device['status']) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, userEmail: currentUserEmail })
      });
      if (res.ok) {
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: newStatus } : d));
        if (inspectedDevice?.id === deviceId) {
          setInspectedDevice(prev => prev ? { ...prev, status: newStatus } : null);
        }
        if (selectedRackId) {
          fetchSelectedRackDetails(selectedRackId);
        }
        showToast(`Device status changed to ${newStatus}`);
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  // Device Specifications Update
  const handleUpdateDevice = async (deviceId: string, updatedData: Partial<Device>) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updatedData, userEmail: currentUserEmail })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update device');
      }
      const updated = await res.json();
      await loadAllData();
      if (selectedRackId) {
        await fetchSelectedRackDetails(selectedRackId);
      }
      if (inspectedDevice?.id === deviceId) {
        setInspectedDevice(updated);
      }
      showToast(`Asset "${updated.name}" updated successfully!`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update device', 'error');
      throw err;
    }
  };

  // Device Decommission & Delete
  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}?userEmail=${encodeURIComponent(currentUserEmail || '')}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete device');
      }
      await loadAllData();
      if (selectedRackId) {
        await fetchSelectedRackDetails(selectedRackId);
      }
      if (inspectedDevice?.id === deviceId) {
        setIsDetailModalOpen(false);
        setInspectedDevice(null);
      }
      showToast('Device decommissioned and removed from rack');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove device', 'error');
    }
  };

  // Connect Ports (Cable patch)
  const handleConnectPorts = async (sourcePortId: string, destPortId: string, cableType: PortType) => {
    try {
      const res = await fetch('/api/ports/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePortId, destPortId, cableType })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to establish cable link');
      }

      await loadAllData();
      if (selectedRackId) {
        await fetchSelectedRackDetails(selectedRackId);
      }
      showToast('Cable patch connection established!');
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Disconnect Cable
  const handleDisconnectPort = async (portId: string) => {
    try {
      const res = await fetch('/api/ports/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portId })
      });

      if (res.ok) {
        await loadAllData();
        if (selectedRackId) {
          await fetchSelectedRackDetails(selectedRackId);
        }
        showToast('Cable patch disconnected');
      }
    } catch (err) {
      showToast('Failed to disconnect cable', 'error');
    }
  };

  // Create VLAN
  const handleCreateVlan = async (vlanData: any) => {
    const res = await fetch('/api/vlans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vlanData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create VLAN');
    }

    const newVlan = await res.json();
    setVlans(prev => [...prev, newVlan]);
    showToast(`VLAN ${vlanData.vlanNumber} created successfully!`);
  };

  // Update VLAN
  const handleUpdateVlan = async (vlanId: string, vlanData: any) => {
    const res = await fetch(`/api/vlans/${vlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vlanData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update VLAN');
    }

    const updated = await res.json();
    setVlans(prev => prev.map(v => v.id === vlanId ? updated : v));
    showToast(`VLAN ${vlanData.vlanNumber} updated!`);
  };

  // Delete VLAN
  const handleDeleteVlan = async (vlanId: string) => {
    const res = await fetch(`/api/vlans/${vlanId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete VLAN');
    }
    setVlans(prev => prev.filter(v => v.id !== vlanId));
    showToast('VLAN segment removed');
  };

  // Add Datacenter Facility
  const handleAddSite = async (siteData: { name: string; location: string; address: string }) => {
    if (!isEffectiveOnline()) {
      const queued = saveSiteToOfflineQueue(siteData);
      const optimisticSite: Site = {
        id: queued.localId,
        name: siteData.name,
        location: siteData.location,
        address: siteData.address,
        rack_count: 0,
        device_count: 0
      };
      setSites(prev => {
        const next = [...prev, optimisticSite];
        localStorage.setItem('infratrack_cache_sites', JSON.stringify(next));
        return next;
      });
      setSelectedSiteId(optimisticSite.id);
      showToast(`Datacenter facility "${siteData.name}" staged in Offline Mode!`);
      return;
    }

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create site');
      }
      const newSite = await res.json();
      await loadAllData();
      setSelectedSiteId(newSite.id);
      showToast(`Datacenter facility "${siteData.name}" created!`);
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError' || err.message?.includes('fetch')) {
        const queued = saveSiteToOfflineQueue(siteData);
        const optimisticSite: Site = {
          id: queued.localId,
          name: siteData.name,
          location: siteData.location,
          address: siteData.address,
          rack_count: 0,
          device_count: 0
        };
        setSites(prev => {
          const next = [...prev, optimisticSite];
          localStorage.setItem('infratrack_cache_sites', JSON.stringify(next));
          return next;
        });
        setSelectedSiteId(optimisticSite.id);
        showToast(`Offline Mode: Facility "${siteData.name}" staged locally for sync!`);
        return;
      }
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Update Datacenter Facility
  const handleUpdateSite = async (siteId: string, siteData: { name: string; location: string; address: string }) => {
    if (!isEffectiveOnline()) {
      setSites(prev => {
        const next = prev.map(s => s.id === siteId ? { ...s, ...siteData } : s);
        localStorage.setItem('infratrack_cache_sites', JSON.stringify(next));
        return next;
      });
      showToast(`Facility "${siteData.name}" updated (saved locally)!`);
      return;
    }

    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update facility');
      }
      await loadAllData();
      showToast(`Facility "${siteData.name}" updated!`);
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError' || err.message?.includes('fetch')) {
        setSites(prev => {
          const next = prev.map(s => s.id === siteId ? { ...s, ...siteData } : s);
          localStorage.setItem('infratrack_cache_sites', JSON.stringify(next));
          return next;
        });
        showToast(`Facility "${siteData.name}" updated locally!`);
        return;
      }
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Delete Datacenter Facility
  const handleDeleteSite = async (siteId: string) => {
    if (!isEffectiveOnline()) {
      setSites(prev => {
        const next = prev.filter(s => s.id !== siteId);
        localStorage.setItem('infratrack_cache_sites', JSON.stringify(next));
        return next;
      });
      if (selectedSiteId === siteId) {
        setSelectedSiteId('');
        setSelectedRackId('');
      }
      showToast('Facility removed locally');
      return;
    }

    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete site');
      }
      if (selectedSiteId === siteId) {
        setSelectedSiteId('');
        setSelectedRackId('');
      }
      await loadAllData();
      showToast('Datacenter facility removed');
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError' || err.message?.includes('fetch')) {
        setSites(prev => prev.filter(s => s.id !== siteId));
        if (selectedSiteId === siteId) {
          setSelectedSiteId('');
          setSelectedRackId('');
        }
        showToast('Facility removed locally');
        return;
      }
      showToast(err.message, 'error');
    }
  };

  // Add Server Rack (Offline Supported!)
  const handleAddRack = async (rackData: { name: string; siteId: string; height: number }) => {
    if (!isEffectiveOnline()) {
      const targetSite = sites.find(s => s.id === rackData.siteId);
      const queuedRack = saveRackToOfflineQueue({
        name: rackData.name,
        siteId: rackData.siteId,
        siteName: targetSite?.name || 'Selected Facility',
        height: rackData.height || 42
      });

      const optimisticRack: Rack = {
        id: queuedRack.localId,
        site_id: rackData.siteId,
        name: rackData.name,
        height: rackData.height || 42,
        used_u: 0,
        total_power_watts: 0,
        device_count: 0,
        devices: []
      };

      setRacks(prev => {
        const next = [...prev, optimisticRack];
        localStorage.setItem('infratrack_cache_racks', JSON.stringify(next));
        return next;
      });
      setSelectedSiteId(rackData.siteId);
      setSelectedRackId(optimisticRack.id);
      showToast(`Server Rack "${rackData.name}" staged in Offline Mode! Ready for equipment intake.`);
      return;
    }

    try {
      const res = await fetch('/api/racks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rackData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to deploy rack');
      }
      const newRack = await res.json();
      await loadAllData();
      setSelectedSiteId(rackData.siteId);
      setSelectedRackId(newRack.id);
      showToast(`Server Rack "${rackData.name}" deployed into facility!`);
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError' || err.message?.includes('fetch')) {
        const targetSite = sites.find(s => s.id === rackData.siteId);
        const queuedRack = saveRackToOfflineQueue({
          name: rackData.name,
          siteId: rackData.siteId,
          siteName: targetSite?.name || 'Selected Facility',
          height: rackData.height || 42
        });

        const optimisticRack: Rack = {
          id: queuedRack.localId,
          site_id: rackData.siteId,
          name: rackData.name,
          height: rackData.height || 42,
          used_u: 0,
          total_power_watts: 0,
          device_count: 0,
          devices: []
        };

        setRacks(prev => {
          const next = [...prev, optimisticRack];
          localStorage.setItem('infratrack_cache_racks', JSON.stringify(next));
          return next;
        });
        setSelectedSiteId(rackData.siteId);
        setSelectedRackId(optimisticRack.id);
        showToast(`Offline Mode: Server Rack "${rackData.name}" staged locally for sync!`);
        return;
      }
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Update Server Rack
  const handleUpdateRack = async (rackId: string, rackData: { name: string; siteId: string; height: number }) => {
    if (!isEffectiveOnline()) {
      setRacks(prev => {
        const next = prev.map(r => r.id === rackId ? { ...r, ...rackData } : r);
        localStorage.setItem('infratrack_cache_racks', JSON.stringify(next));
        return next;
      });
      showToast(`Server Rack "${rackData.name}" updated (saved locally)!`);
      return;
    }

    try {
      const res = await fetch(`/api/racks/${rackId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rackData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update rack');
      }
      await loadAllData();
      if (selectedRackId === rackId) {
        await fetchSelectedRackDetails(rackId);
      }
      showToast(`Server Rack "${rackData.name}" updated!`);
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError' || err.message?.includes('fetch')) {
        setRacks(prev => {
          const next = prev.map(r => r.id === rackId ? { ...r, ...rackData } : r);
          localStorage.setItem('infratrack_cache_racks', JSON.stringify(next));
          return next;
        });
        showToast(`Server Rack "${rackData.name}" updated locally!`);
        return;
      }
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Delete Server Rack
  const handleDeleteRack = async (rackId: string) => {
    if (!isEffectiveOnline()) {
      setRacks(prev => {
        const next = prev.filter(r => r.id !== rackId);
        localStorage.setItem('infratrack_cache_racks', JSON.stringify(next));
        return next;
      });
      if (selectedRackId === rackId) {
        setSelectedRackId('');
      }
      showToast('Rack removed from local layout');
      return;
    }

    try {
      const res = await fetch(`/api/racks/${rackId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete rack');
      }
      if (selectedRackId === rackId) {
        setSelectedRackId('');
      }
      await loadAllData();
      showToast('Rack decommissioned and removed');
    } catch (err: any) {
      if (!isEffectiveOnline() || err?.name === 'TypeError' || err.message?.includes('fetch')) {
        setRacks(prev => prev.filter(r => r.id !== rackId));
        if (selectedRackId === rackId) setSelectedRackId('');
        showToast('Rack removed locally');
        return;
      }
      showToast(err.message, 'error');
    }
  };

  // Purge Demo Data
  const handlePurgeDemoData = async (mode: 'DEVICES_ONLY' | 'FULL_WIPE') => {
    try {
      const res = await fetch('/api/admin/purge-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to purge demo data');
      }
      await loadAllData();
      if (selectedRackId) {
        await fetchSelectedRackDetails(selectedRackId);
      }
      showToast(mode === 'FULL_WIPE' ? 'All demo infrastructure purged.' : 'Demo hardware assets purged! Facilities & Racks ready for clean production.');
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  // Slot click handling: clicking empty slot opens Hardware Intake with pre-filled rack and U!
  const handleEmptySlotClick = (rackId: string, startU: number) => {
    setIntakePreselect({ rackId, startU });
    setCurrentTab('hardware-form');
    showToast(`Slot U${startU} selected in ${racks.find(r => r.id === rackId)?.name}. Ready for intake!`);
  };

  // Inspect hardware click
  const handleDeviceClick = (device: Device) => {
    setInspectedDevice(device);
    setIsDetailModalEditMode(false);
    setIsDetailModalOpen(true);
  };

  // Edit hardware click from table
  const handleEditDeviceFromTable = (device: Device) => {
    setInspectedDevice(device);
    setIsDetailModalEditMode(true);
    setIsDetailModalOpen(true);
  };

  // Trace port jump
  const handleTracePortFromDetail = (port: Port) => {
    setHighlightedPortId(port.id);
    setCurrentTab('cable-tracer');
  };

  // Current Site and Rack objects
  const currentSite = sites.find(s => s.id === selectedSiteId) || sites[0];
  const currentRack = racks.find(r => r.id === selectedRackId) || racks[0];

  // Active user details - null when logged out / in guest mode
  const activeUser = currentUserEmail
    ? (users.find(u => u.email.toLowerCase() === currentUserEmail.toLowerCase()) || (
        currentUserEmail.toLowerCase() === 'bossyemzee@gmail.com' ? {
          id: 'usr-super-admin',
          name: 'EMZEE (Lead Admin)',
          email: 'bossyemzee@gmail.com',
          role: 'SUPER_ADMIN' as const,
          status: 'ACTIVE' as const,
          permissions: ['ALL', 'SUPER_ADMIN', 'WIPE_DATA', 'MANAGE_USERS']
        } : null
      ))
    : null;

  const isSuperAdmin = isUserSuperAdmin(activeUser, currentUserEmail);
  const isAdminGranted = isUserAdminGranted(activeUser, currentUserEmail);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col lg:flex-row antialiased selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-bottom duration-300 text-xs sm:text-sm font-semibold text-white bg-slate-900/95 border-slate-700">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Navigation (Sidebar on Desktop, Drawer on Mobile) */}
      <MobileNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        dbStatus={dbStatus}
        sites={sites}
        selectedSiteId={selectedSiteId}
        onSelectSite={(id) => {
          setSelectedSiteId(id);
          const firstRack = racks.find(r => r.site_id === id);
          if (firstRack) setSelectedRackId(firstRack.id);
        }}
        onReseedData={handleReseedData}
        isReseeding={isReseeding}
        isAdminGranted={isAdminGranted}
        isSuperAdmin={isSuperAdmin}
        currentUserEmail={currentUserEmail}
        currentUserName={activeUser?.name}
        currentUserRole={activeUser?.role}
        onLogout={handleLogout}
        onOpenLogin={() => setIsAuthModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        isOnline={isOnline}
        offlineQueuedCount={offlineQueuedCount}
        onOpenOfflineQueue={() => setIsOfflineQueueModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">
        {/* Desktop Top Breadcrumb & Status Bar */}
        <div className="hidden lg:flex items-center justify-between px-4 xl:px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-2 text-xs font-mono min-w-0 truncate mr-3">
            <span className="text-slate-400 flex items-center gap-1.5 truncate max-w-[140px] xl:max-w-[200px]">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">{currentSite?.name || 'Datacenter'}</span>
            </span>
            <span className="text-slate-600 shrink-0">/</span>
            <span className="text-emerald-400 font-bold truncate max-w-[120px] xl:max-w-[180px]">
              {currentRack?.name || 'Rack Elevation'}
            </span>
            <span className="text-slate-600 shrink-0">/</span>
            <span className="text-slate-300 font-semibold uppercase tracking-wider text-[11px] shrink-0">
              {currentTab}
            </span>
          </div>

          {/* Top Actions: Compact, sleek, zero-overflow */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Action: New Hardware Intake */}
            {isAdminGranted ? (
              <button
                type="button"
                onClick={() => {
                  setIntakePreselect(null);
                  setCurrentTab('hardware-form');
                }}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all shrink-0"
                title="Intake new hardware into rack"
              >
                <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                <span>+ Intake</span>
              </button>
            ) : null}

            {/* Server Room Field Sync Status Button (Compact) */}
            <button
              type="button"
              onClick={() => setIsOfflineQueueModalOpen(true)}
              className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95 ${
                !isOnline
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 animate-pulse'
                  : offlineQueuedCount > 0
                  ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
              title={!isOnline ? "Server Room Mode (Offline) - Tap to review staged assets" : "Datacenter Signal & Offline Intake Queue"}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs">Offline</span>
                  {offlineQueuedCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[10px]">
                      {offlineQueuedCount}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {offlineQueuedCount > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px]">
                      {offlineQueuedCount}
                    </span>
                  ) : (
                    <span className="hidden 2xl:inline text-[11px] font-mono">Sync</span>
                  )}
                </>
              )}
            </button>

            {/* Super Admin Quick Credentials Shortcut (when not already logged in as super admin) */}
            {!isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shrink-0 group"
                title="Super Admin Identity: bossyemzee@gmail.com"
              >
                <Crown className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="hidden 2xl:inline text-xs">Super Admin</span>
              </button>
            )}

            {/* Active User Session & Log Out / Sign In */}
            {currentUserEmail ? (
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-200 font-semibold flex items-center gap-1.5 transition-colors"
                  title="Click to view permissions or switch persona"
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isSuperAdmin ? 'bg-rose-400 glow-rose' : 'bg-emerald-400'}`} />
                  <span className="font-bold text-xs truncate max-w-[90px] xl:max-w-[130px]">{activeUser?.name || currentUserEmail}</span>
                  {isSuperAdmin ? (
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose">
                      SUPER
                    </span>
                  ) : isAdminGranted ? (
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      ADMIN
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all shrink-0"
                  title="Log Out to Guest Mode"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-xs shrink-0">
                <span className="text-[11px] font-mono text-amber-400 px-2 py-1 flex items-center gap-1 font-semibold">
                  <Lock className="w-3 h-3 text-amber-400" /> <span className="hidden xl:inline">Guest</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-sm shadow-emerald-600/20"
                >
                  <LogIn className="w-3 h-3" /> Sign In
                </button>
              </div>
            )}

            {/* PWA Install Button */}
            <PWAInstallButton compact={true} />

            {/* Dark & Light Mode Switch */}
            <ThemeToggle theme={theme} onToggle={toggleTheme} compact={true} />
          </div>
        </div>

        {/* Dynamic Page Views */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isLoading ? (
            <div className="h-96 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-sm font-mono text-slate-400">
                Connecting to Neon Serverless PostgreSQL &amp; Loading Assets...
              </p>
            </div>
          ) : (
            <>
              {currentTab === 'elevation' && (
                <RackElevation
                  racks={racks}
                  selectedRackId={selectedRackId}
                  onSelectRack={setSelectedRackId}
                  onDeviceClick={handleDeviceClick}
                  onEmptySlotClick={handleEmptySlotClick}
                  onNavigateToAddRack={() => setCurrentTab('sites-racks')}
                  isAdminGranted={isAdminGranted}
                />
              )}

              {currentTab === 'sites-racks' && (
                <DatacenterManager
                  sites={sites}
                  racks={racks}
                  onAddSite={handleAddSite}
                  onUpdateSite={handleUpdateSite}
                  onDeleteSite={handleDeleteSite}
                  onAddRack={handleAddRack}
                  onUpdateRack={handleUpdateRack}
                  onDeleteRack={handleDeleteRack}
                  adminOnlyMode={adminOnlyMode}
                  isSuperAdmin={isSuperAdmin}
                  isAdminGranted={isAdminGranted}
                  onNavigateToAdmin={() => setCurrentTab('admin')}
                  onSelectRackForElevation={(rackId) => {
                    setSelectedRackId(rackId);
                    const r = racks.find(rack => rack.id === rackId);
                    if (r) setSelectedSiteId(r.site_id);
                    setCurrentTab('elevation');
                  }}
                  onNavigateToIntakeForRack={(rackId) => {
                    setIntakePreselect({ rackId, startU: 1 });
                    setCurrentTab('hardware-form');
                  }}
                  isOnline={isOnline}
                  onOpenOfflineQueue={() => setIsOfflineQueueModalOpen(true)}
                  offlineQueuedCount={offlineQueuedCount}
                />
              )}

              {currentTab === 'cable-tracer' && (
                <PortTracer
                  ports={ports}
                  devices={devices}
                  vlans={vlans}
                  onConnectPorts={handleConnectPorts}
                  onDisconnectPort={handleDisconnectPort}
                  highlightedPortId={highlightedPortId}
                  isAdminGranted={isAdminGranted}
                />
              )}

              {currentTab === 'hardware-form' && (
                <HardwareForm
                  sites={sites}
                  racks={racks}
                  preselectedRackId={intakePreselect?.rackId || selectedRackId}
                  preselectedStartU={intakePreselect?.startU || 1}
                  onSubmit={handleHardwareSubmit}
                  onCancel={() => setCurrentTab('elevation')}
                  isAdminGranted={isAdminGranted}
                  onOpenLogin={() => setIsAuthModalOpen(true)}
                  isOnline={isOnline}
                  onOpenOfflineQueue={() => setIsOfflineQueueModalOpen(true)}
                  offlineQueuedCount={offlineQueuedCount}
                />
              )}

              {currentTab === 'inventory' && (
                <AssetInventoryTable
                  devices={devices}
                  onSelectDevice={handleDeviceClick}
                  onEditDevice={handleEditDeviceFromTable}
                  onDeleteDevice={handleDeleteDevice}
                  adminOnlyMode={adminOnlyMode}
                  isSuperAdmin={isSuperAdmin}
                  isAdminGranted={isAdminGranted}
                  onNavigateToIntake={() => {
                    setIntakePreselect(null);
                    setCurrentTab('hardware-form');
                  }}
                />
              )}

              {currentTab === 'vlans' && (
                <VlanManager
                  vlans={vlans}
                  onCreateVlan={handleCreateVlan}
                  onUpdateVlan={handleUpdateVlan}
                  onDeleteVlan={handleDeleteVlan}
                  isAdminGranted={isAdminGranted}
                />
              )}

              {currentTab === 'admin' && (
                isAdminGranted ? (
                  <AdminPanel
                    currentUserEmail={currentUserEmail}
                    onChangeActiveUser={(email) => {
                      if (email.toLowerCase() === 'bossyemzee@gmail.com' && currentUserEmail?.toLowerCase() !== 'bossyemzee@gmail.com') {
                        setIsAuthModalOpen(true);
                        showToast('Super Admin identity requires master secret password', 'error');
                      } else {
                        handleSelectUser(email);
                      }
                    }}
                    dbStatus={dbStatus}
                    sites={sites}
                    racks={racks}
                    devices={devices}
                    vlans={vlans}
                    adminOnlyMode={adminOnlyMode}
                    onToggleAdminOnlyMode={() => {
                      setAdminOnlyMode(prev => {
                        const next = !prev;
                        showToast(next ? 'Strict Admin Mode: mutations isolated to Admin Console' : 'Contextual RBAC: inline edits & deletions active for Admins');
                        return next;
                      });
                    }}
                    onAddSite={handleAddSite}
                    onUpdateSite={handleUpdateSite}
                    onDeleteSite={handleDeleteSite}
                    onAddRack={handleAddRack}
                    onUpdateRack={handleUpdateRack}
                    onDeleteRack={handleDeleteRack}
                    onDeleteDevice={handleDeleteDevice}
                    onInspectDevice={handleDeviceClick}
                    onEditDevice={handleEditDeviceFromTable}
                    onPurgeDemoData={handlePurgeDemoData}
                    onReseedFactoryData={handleReseedData}
                    onRefreshAllData={loadAllData}
                    onNavigateToIntake={() => {
                      setIntakePreselect(null);
                      setCurrentTab('hardware-form');
                    }}
                  />
                ) : (
                  <div className="max-w-2xl mx-auto py-12 px-4 animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
                      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
                        <ShieldAlert className="w-8 h-8" />
                      </div>

                      <div className="space-y-2">
                        <h2 className="text-xl font-extrabold text-white tracking-tight">
                          InfraTrack Administration Console (Restricted)
                        </h2>
                        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                          Access to user directory administration, role assignments, audit logs, and infrastructure wipe operations requires authenticated Admin privileges.
                        </p>
                      </div>

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

                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAuthModalOpen(true)}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95"
                        >
                          <Crown className="w-4 h-4 text-amber-300" />
                          <span>Sign In as Super Admin / Choose Persona</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </main>

      {/* Equipment Inspector & Editor Modal */}
      <DeviceDetailModal
        device={inspectedDevice}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setIsDetailModalEditMode(false);
        }}
        onDelete={handleDeleteDevice}
        onUpdateDevice={handleUpdateDevice}
        onStatusChange={handleDeviceStatusChange}
        onTracePort={handleTracePortFromDetail}
        initialEditMode={isDetailModalEditMode}
        isAdminGranted={isAdminGranted}
      />

      {/* Enterprise Authentication & Super Admin Credentials Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUserEmail={currentUserEmail}
        users={users}
        onSelectUser={handleSelectUser}
        onLogout={handleLogout}
      />

      {/* Server Room Offline Field Sync Modal */}
      <OfflineQueueModal
        isOpen={isOfflineQueueModalOpen}
        onClose={() => setIsOfflineQueueModalOpen(false)}
        queue={offlineQueue}
        isOnline={isOnline}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulation={toggleServerRoomSimulation}
        onSyncAll={triggerOfflineSync}
        isSyncing={isOfflineSyncing}
        syncProgress={offlineSyncProgress}
        onSuccessSync={() => {
          loadAllData();
          showToast('Server room assets synced successfully to database!');
        }}
      />
    </div>
  );
}
