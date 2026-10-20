import React, { useState, useMemo } from 'react';
import { 
  Building2, Server, Plus, MapPin, Layers, Zap, HardDrive, 
  Trash2, ExternalLink, Check, AlertCircle, CheckCircle2, 
  Sparkles, ArrowRight, X, Gauge, ShieldCheck, ChevronRight,
  Edit, Save, Lock, Wifi, WifiOff, Clock
} from 'lucide-react';
import { Site, Rack } from '../types/index.ts';

interface DatacenterManagerProps {
  sites: Site[];
  racks: Rack[];
  onAddSite: (siteData: { name: string; location: string; address: string }) => Promise<void>;
  onUpdateSite?: (siteId: string, siteData: { name: string; location: string; address: string }) => Promise<void>;
  onDeleteSite: (siteId: string) => Promise<void>;
  onAddRack: (rackData: { name: string; siteId: string; height: number }) => Promise<void>;
  onUpdateRack?: (rackId: string, rackData: { name: string; siteId: string; height: number }) => Promise<void>;
  onDeleteRack: (rackId: string) => Promise<void>;
  onSelectRackForElevation: (rackId: string) => void;
  onNavigateToIntakeForRack: (rackId: string) => void;
  adminOnlyMode?: boolean;
  isSuperAdmin?: boolean;
  isAdminGranted?: boolean;
  onNavigateToAdmin?: () => void;
  isOnline?: boolean;
  onOpenOfflineQueue?: () => void;
  offlineQueuedCount?: number;
}

export function DatacenterManager({
  sites,
  racks,
  onAddSite,
  onUpdateSite,
  onDeleteSite,
  onAddRack,
  onUpdateRack,
  onDeleteRack,
  onSelectRackForElevation,
  onNavigateToIntakeForRack,
  adminOnlyMode = false,
  isSuperAdmin = true,
  isAdminGranted = false,
  onNavigateToAdmin,
  isOnline = true,
  onOpenOfflineQueue,
  offlineQueuedCount = 0
}: DatacenterManagerProps) {
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);

  // In-app delete confirmation states (replaces window.confirm)
  const [confirmDeleteSiteId, setConfirmDeleteSiteId] = useState<string | null>(null);
  const [confirmDeleteRackId, setConfirmDeleteRackId] = useState<string | null>(null);

  // Site Form State
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [isSubmittingSite, setIsSubmittingSite] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);

  // Rack Form State
  const [rackName, setRackName] = useState('');
  const [targetSiteId, setTargetSiteId] = useState<string>(sites[0]?.id || '');
  const [rackHeight, setRackHeight] = useState<number>(42);
  const [isSubmittingRack, setIsSubmittingRack] = useState(false);
  const [rackError, setRackError] = useState<string | null>(null);

  const [filterSiteId, setFilterSiteId] = useState<string>('ALL');

  // Enterprise Datacenter Facility Templates
  const siteTemplates = [
    {
      name: 'Equinix DC11 (Ashburn Core)',
      location: 'Ashburn, VA',
      address: '21741 Red Rum Dr, Ashburn, VA 20147'
    },
    {
      name: 'Digital Realty SV1 (Silicon Valley)',
      location: 'Santa Clara, CA',
      address: '1500 Space Park Dr, Santa Clara, CA 95054'
    },
    {
      name: 'Interxion FRA-1 (Frankfurt Metro)',
      location: 'Frankfurt, Germany',
      address: 'Hanauer Landstraße 300, 60314 Frankfurt'
    },
    {
      name: 'CyrusOne DFW3 (Texas Data Hub)',
      location: 'Carrollton, TX',
      address: '1649 W Frankford Rd, Carrollton, TX 75007'
    }
  ];

  // Quick Rack Naming Suggestions
  const rackSuggestions = [
    'Rack A-03 [AI Inference Cluster]',
    'Rack A-04 [High-Density Storage]',
    'Rack B-02 [WAN & Transit Gateway]',
    'Rack C-01 [Bare-Metal Virtualization]',
    'Edge-Cabinet-01 [Branch Micro-DC]'
  ];

  // Metrics
  const metrics = useMemo(() => {
    const totalRacks = racks.length;
    const totalCapacityU = racks.reduce((acc, r) => acc + (r.height || 42), 0);
    const totalUsedU = racks.reduce((acc, r) => acc + (r.used_u || 0), 0);
    const totalPower = racks.reduce((acc, r) => acc + (r.total_power_watts || 0), 0);
    const totalDevices = racks.reduce((acc, r) => acc + (r.device_count || 0), 0);
    return {
      totalRacks,
      totalCapacityU,
      totalUsedU,
      totalPower,
      totalDevices,
      occupancyPercent: totalCapacityU > 0 ? Math.round((totalUsedU / totalCapacityU) * 100) : 0
    };
  }, [racks]);

  // Filtered racks list
  const filteredRacks = useMemo(() => {
    if (filterSiteId === 'ALL') return racks;
    return racks.filter(r => r.site_id === filterSiteId);
  }, [racks, filterSiteId]);

  const openAddSiteModal = () => {
    setEditingSite(null);
    setSiteName('');
    setSiteLocation('');
    setSiteAddress('');
    setSiteError(null);
    setIsSiteModalOpen(true);
  };

  const openEditSiteModal = (site: Site) => {
    setEditingSite(site);
    setSiteName(site.name);
    setSiteLocation(site.location);
    setSiteAddress(site.address || '');
    setSiteError(null);
    setIsSiteModalOpen(true);
  };

  const openAddRackModal = (siteId?: string) => {
    setEditingRack(null);
    setRackName('');
    setTargetSiteId(siteId || sites[0]?.id || '');
    setRackHeight(42);
    setRackError(null);
    setIsRackModalOpen(true);
  };

  const openEditRackModal = (rack: Rack) => {
    setEditingRack(rack);
    setRackName(rack.name);
    setTargetSiteId(rack.site_id);
    setRackHeight(rack.height || 42);
    setRackError(null);
    setIsRackModalOpen(true);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiteError(null);
    if (!siteName || !siteLocation) {
      setSiteError('Facility Name and Metro Location are required');
      return;
    }

    setIsSubmittingSite(true);
    try {
      if (editingSite && onUpdateSite) {
        await onUpdateSite(editingSite.id, {
          name: siteName.trim(),
          location: siteLocation.trim(),
          address: siteAddress.trim()
        });
      } else {
        await onAddSite({
          name: siteName.trim(),
          location: siteLocation.trim(),
          address: siteAddress.trim()
        });
      }
      setIsSiteModalOpen(false);
    } catch (err: any) {
      setSiteError(err.message || 'Failed to save datacenter facility');
    } finally {
      setIsSubmittingSite(false);
    }
  };

  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    setRackError(null);
    if (!rackName.trim() || !targetSiteId) {
      setRackError('Rack Name and Target Datacenter are required');
      return;
    }

    setIsSubmittingRack(true);
    try {
      if (editingRack && onUpdateRack) {
        await onUpdateRack(editingRack.id, {
          name: rackName.trim(),
          siteId: targetSiteId,
          height: rackHeight
        });
      } else {
        await onAddRack({
          name: rackName.trim(),
          siteId: targetSiteId,
          height: rackHeight
        });
      }
      setIsRackModalOpen(false);
    } catch (err: any) {
      setRackError(err.message || 'Failed to save server rack');
    } finally {
      setIsSubmittingRack(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Offline Mode Field Banner */}
      {!isOnline && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-amber-300 text-sm">Server Room Offline Mode Active</span>
              <p className="text-slate-300 text-xs mt-0.5">
                Working in a shielded basement or server aisle with zero signal? You can deploy server racks, create facilities, and intake equipment. All infrastructure changes are staged locally and immediately accessible.
              </p>
            </div>
          </div>
          {onOpenOfflineQueue && (
            <button
              type="button"
              onClick={onOpenOfflineQueue}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Review Offline Queue ({offlineQueuedCount})</span>
            </button>
          )}
        </div>
      )}

      {/* Top Banner & Quick Provisioning Triggers */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 glow-emerald">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-base sm:text-xl text-white tracking-tight">
              Datacenter Facilities &amp; Rack Infrastructure
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Provision new datacenter sites, deploy 42U/48U server enclosures &amp; track facility capacity
            </p>
          </div>
        </div>

        {/* Action Buttons: Add Facility + Add Rack */}
        {isAdminGranted ? (
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            {adminOnlyMode && !isSuperAdmin ? (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 font-mono">
                <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Strict Admin Mode (Mutations in Admin Console)</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openAddSiteModal}
                  className="flex-1 md:flex-none min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>+ Add Datacenter Facility</span>
                </button>

                <button
                  type="button"
                  onClick={() => openAddRackModal()}
                  className="flex-1 md:flex-none min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Deploy Server Rack</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 font-mono">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Read-Only Viewer &bull; Adding/Editing Facilities Requires Admin Grant</span>
          </div>
        )}
      </div>

      {/* Infrastructure Telemetry Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Datacenters</span>
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-white">
            {sites.length}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            Active Regional Facilities
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Server Racks</span>
            <Server className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-sky-300">
            {metrics.totalRacks}
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {metrics.totalCapacityU}U Total Slot Capacity
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Rack Space Utilized</span>
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-emerald-400">
            {metrics.occupancyPercent}%
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {metrics.totalUsedU}U Occupied / {metrics.totalCapacityU - metrics.totalUsedU}U Free
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Power Load</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 font-mono text-xl sm:text-2xl font-extrabold text-amber-400">
            {(metrics.totalPower / 1000).toFixed(1)} kW
          </div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            Across {metrics.totalDevices} Hardware Assets
          </div>
        </div>
      </div>

      {/* Datacenter Facilities Section */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-100">
              Datacenter Facilities ({sites.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Click &quot;Deploy Rack Here&quot; or Edit / Delete to manage facilities
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sites.map((site) => {
            const siteRacks = racks.filter(r => r.site_id === site.id);
            const sitePower = siteRacks.reduce((a, b) => a + (b.total_power_watts || 0), 0);
            const isDeleting = confirmDeleteSiteId === site.id;

            return (
              <div
                key={site.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse glow-emerald" />
                        <h4 className="font-bold text-base text-white">
                          {site.name}
                        </h4>
                      </div>
                      <p className="text-xs text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {site.location}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {site.address || 'Address on file'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditSiteModal(site)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit Facility"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        {siteRacks.length} {siteRacks.length === 1 ? 'Rack' : 'Racks'}
                      </span>
                    </div>
                  </div>

                  {/* Facility Racks Overview */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Racks in Facility:</span>
                      <span>Power: {(sitePower / 1000).toFixed(1)} kW</span>
                    </div>

                    {siteRacks.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {siteRacks.map(r => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => onSelectRackForElevation(r.id)}
                            className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 hover:border-emerald-500/40 text-left transition-all group flex items-center justify-between"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300 truncate font-mono">
                                {r.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                {r.used_u || 0}/{r.height}U ({Math.round(((r.used_u || 0) / r.height) * 100)}% Full)
                              </div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-3 text-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                        No racks currently deployed in this facility.
                      </div>
                    )}
                  </div>
                </div>

                {/* Facility Card Footer Actions (with in-app two-step delete, no window.confirm) */}
                {isAdminGranted && (!adminOnlyMode || isSuperAdmin) ? (
                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in">
                        <span className="text-xs text-rose-400 font-semibold">Delete Facility?</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteSite(site.id);
                            setConfirmDeleteSiteId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSiteId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteSiteId(site.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                        title="Delete Facility"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Facility
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditSiteModal(site)}
                        className="min-h-[36px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAddRackModal(site.id)}
                        className="min-h-[36px] px-3.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Deploy Rack Here</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1 text-slate-400"><MapPin className="w-3 h-3 text-emerald-400" /> {site.location}</span>
                    <span>{racks.filter(r => r.site_id === site.id).length} Enclosures</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Racks Management & Quick Actions Grid */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-100">
              All Server Enclosures &amp; Racks ({filteredRacks.length})
            </h3>
          </div>

          {/* Filter by Site */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Filter Facility:</span>
            <select
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Datacenters ({sites.length})</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rack Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRacks.map((rack) => {
            const usedU = rack.used_u || 0;
            const percent = Math.round((usedU / rack.height) * 100);
            const isDeleting = confirmDeleteRackId === rack.id;

            return (
              <div
                key={rack.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-base text-white font-mono">
                        {rack.name}
                      </h4>
                      <p className="text-xs text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {rack.site_name || 'Datacenter'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {rack.id.startsWith('offline-') && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" /> STAGED OFFLINE
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditRackModal(rack)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit Rack Details"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
                        {rack.height}U EIA-310
                      </span>
                    </div>
                  </div>

                  {/* Occupancy bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Space Used:</span>
                      <span className="text-slate-200 font-bold">{usedU} / {rack.height} U ({percent}%)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats list */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">ASSETS</span>
                      <span className="text-white font-bold">{rack.device_count || 0} Units</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block">EST. POWER</span>
                      <span className="text-amber-400 font-bold">{rack.total_power_watts || 0} W</span>
                    </div>
                  </div>
                </div>

                {/* Actions (Two-step safe deletion, no window.confirm) */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  {isAdminGranted && (!adminOnlyMode || isSuperAdmin) ? (
                    isDeleting ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in">
                        <span className="text-xs text-rose-400 font-semibold">Delete?</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteRack(rack.id);
                            setConfirmDeleteRackId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRackId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRackId(rack.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                        title="Decommission Rack"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )
                  ) : (
                    <span className="text-[11px] text-slate-500 font-mono">Enclosure EIA-310</span>
                  )}

                  <div className="flex items-center gap-2">
                    {isAdminGranted && (!adminOnlyMode || isSuperAdmin) && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditRackModal(rack)}
                          className="min-h-[36px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onNavigateToIntakeForRack(rack.id)}
                          className="min-h-[36px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Intake</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => onSelectRackForElevation(rack.id)}
                      className="min-h-[36px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <span>Elevation</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal 1: Add / Edit Datacenter Facility */}
      {isSiteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    {editingSite ? `Edit Datacenter Facility: ${editingSite.name}` : 'Add New Datacenter Facility'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingSite ? 'Modify facility specifications & location' : 'Register a new datacenter site or regional edge facility'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSiteModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSite} className="p-6 overflow-y-auto space-y-5 text-xs">
              {siteError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                  {siteError}
                </div>
              )}

              {/* Quick Template Presets (when adding new) */}
              {!editingSite && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Enterprise Presets (Click to Auto-fill):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {siteTemplates.map(tpl => (
                      <button
                        key={tpl.name}
                        type="button"
                        onClick={() => {
                          setSiteName(tpl.name);
                          setSiteLocation(tpl.location);
                          setSiteAddress(tpl.address);
                        }}
                        className="p-2.5 rounded-xl text-left bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 hover:border-emerald-500/40 transition-all"
                      >
                        <div className="font-bold text-slate-200 truncate">{tpl.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tpl.location}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Facility Name: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Equinix DC11 (Ashburn Core)"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Metro / City Location: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ashburn, VA or Frankfurt, Germany"
                  value={siteLocation}
                  onChange={(e) => setSiteLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Physical Street Address:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 21741 Red Rum Dr, Ashburn, VA 20147"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSiteModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSite}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingSite ? 'Saving...' : editingSite ? 'Update Facility' : 'Add Datacenter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Server Rack */}
      {isRackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-base">
                    {editingRack ? `Edit Server Rack: ${editingRack.name}` : 'Deploy New Server Rack'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingRack ? 'Update enclosure name, form factor or site' : 'Mount an EIA-310 19-inch equipment enclosure to a facility'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRackModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRack} className="p-6 overflow-y-auto space-y-5 text-xs">
              {!isOnline && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                  <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
                  <div>
                    <span className="font-bold">Offline Field Intake Active:</span> This rack will be deployed instantly into your local environment and staged for automated database synchronization once network connectivity returns.
                  </div>
                </div>
              )}

              {rackError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                  {rackError}
                </div>
              )}

              {/* Suggestions (when adding new) */}
              {!editingRack && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Suggested Naming Patterns:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {rackSuggestions.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRackName(s)}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/40 text-slate-300 font-mono text-[11px] hover:text-white transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Datacenter Facility: *
                </label>
                <select
                  value={targetSiteId}
                  onChange={(e) => setTargetSiteId(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.location})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Rack Name / Identifier: *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack A-03 [AI Inference Cluster]"
                  value={rackName}
                  onChange={(e) => setRackName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Standard Rack Form Factor / Height:
                </label>
                <select
                  value={rackHeight}
                  onChange={(e) => setRackHeight(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value={42}>42U (Standard Full Datacenter Enclosure - 78&quot;)</option>
                  <option value={48}>48U (High-Density Hyperscale Enclosure - 84&quot;)</option>
                  <option value={24}>24U (Half Rack / Medium Office - 48&quot;)</option>
                  <option value={12}>12U (Edge Cabinet / Wall-Mount)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRackModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRack}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSubmittingRack 
                      ? 'Saving...' 
                      : editingRack 
                        ? (isOnline ? 'Update Rack' : 'Update Rack (Offline)') 
                        : (isOnline ? 'Deploy Server Rack' : 'Deploy Rack (Offline Mode)')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
