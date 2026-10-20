import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, Users, Key, Trash2, RefreshCw, AlertTriangle, 
  CheckCircle2, Plus, Clock, Database, Server, Building2, 
  Lock, Unlock, UserCheck, ShieldAlert, X, Check, Eye, EyeOff,
  Activity, SlidersHorizontal, ArrowRight, Sparkles, Edit, Crown, KeyRound,
  HardDrive, Search, Filter, Layers, Zap, ToggleLeft, ToggleRight
} from 'lucide-react';
import { User, UserRole, AuditLog, SystemStats, DatabaseStatus, Site, Rack, Device, VLAN } from '../types/index.ts';

interface AdminPanelProps {
  currentUserEmail?: string | null;
  onChangeActiveUser: (email: string) => void;
  dbStatus: DatabaseStatus | null;
  sites: Site[];
  racks: Rack[];
  devices: Device[];
  vlans: VLAN[];
  adminOnlyMode: boolean;
  onToggleAdminOnlyMode: () => void;
  onAddSite: (siteData: { name: string; location: string; address: string }) => Promise<void>;
  onUpdateSite: (siteId: string, siteData: { name: string; location: string; address: string }) => Promise<void>;
  onDeleteSite: (siteId: string) => Promise<void>;
  onAddRack: (rackData: { name: string; siteId: string; height: number }) => Promise<void>;
  onUpdateRack: (rackId: string, rackData: { name: string; siteId: string; height: number }) => Promise<void>;
  onDeleteRack: (rackId: string) => Promise<void>;
  onDeleteDevice: (deviceId: string) => Promise<void>;
  onInspectDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onPurgeDemoData: (mode: 'DEVICES_ONLY' | 'FULL_WIPE') => Promise<void>;
  onReseedFactoryData: () => Promise<void>;
  onRefreshAllData: () => Promise<void>;
  onNavigateToIntake?: () => void;
}

export function AdminPanel({
  currentUserEmail,
  onChangeActiveUser,
  dbStatus,
  sites,
  racks,
  devices,
  vlans,
  adminOnlyMode,
  onToggleAdminOnlyMode,
  onAddSite,
  onUpdateSite,
  onDeleteSite,
  onAddRack,
  onUpdateRack,
  onDeleteRack,
  onDeleteDevice,
  onInspectDevice,
  onEditDevice,
  onPurgeDemoData,
  onReseedFactoryData,
  onRefreshAllData,
  onNavigateToIntake
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'infrastructure' | 'users' | 'purge' | 'audit' | 'telemetry'>('infrastructure');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('DC_TECH');
  const [formDepartment, setFormDepartment] = useState('Datacenter Operations');
  const [formPermissions, setFormPermissions] = useState<string[]>(['INTAKE_HARDWARE']);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // In-app delete confirmations for users, sites, racks, devices
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [confirmDeleteSiteId, setConfirmDeleteSiteId] = useState<string | null>(null);
  const [confirmDeleteRackId, setConfirmDeleteRackId] = useState<string | null>(null);
  const [confirmDeleteDeviceId, setConfirmDeleteDeviceId] = useState<string | null>(null);

  // Super Admin Password Rotation State
  const [showPasswordChangeForm, setShowPasswordChangeForm] = useState(false);
  const [currentSecretPassword, setCurrentSecretPassword] = useState('');
  const [newSecretPassword, setNewSecretPassword] = useState('');
  const [confirmSecretPassword, setConfirmSecretPassword] = useState('');
  const [showNewSecretPassword, setShowNewSecretPassword] = useState(false);
  const [isRotatingPassword, setIsRotatingPassword] = useState(false);
  const [passwordRotationError, setPasswordRotationError] = useState<string | null>(null);
  const [passwordRotationSuccess, setPasswordRotationSuccess] = useState<string | null>(null);

  // Site Modal State in Admin
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteName, setSiteName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [isSubmittingSite, setIsSubmittingSite] = useState(false);

  // Rack Modal State in Admin
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [editingRack, setEditingRack] = useState<Rack | null>(null);
  const [rackName, setRackName] = useState('');
  const [rackSiteId, setRackSiteId] = useState('');
  const [rackHeight, setRackHeight] = useState('42');
  const [isSubmittingRack, setIsSubmittingRack] = useState(false);

  // Infrastructure search & filter state
  const [infraSubTab, setInfraSubTab] = useState<'sites' | 'racks' | 'devices'>('sites');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceFilterSite, setDeviceFilterSite] = useState('ALL');

  // Purge Confirmation State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeMode, setPurgeMode] = useState<'DEVICES_ONLY' | 'FULL_WIPE'>('DEVICES_ONLY');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [isExecutingPurge, setIsExecutingPurge] = useState(false);

  const availablePermissions = [
    { id: 'ADMIN_ACCESS', label: 'Admin Access (Full Add, Edit & Delete Permissions)' },
    { id: 'INTAKE_HARDWARE', label: 'Intake & Mount Hardware Assets' },
    { id: 'PATCH_CABLING', label: 'Establish & Disconnect Cable Links' },
    { id: 'PROVISION_RACKS', label: 'Deploy & Manage Server Racks & Facilities' },
    { id: 'MANAGE_VLANS', label: 'Configure 802.1Q VLAN Segments' },
    { id: 'EXPORT_INVENTORY', label: 'Export Inventory CSV / Reports' },
    { id: 'MANAGE_USERS', label: 'Manage Users, Roles & Permissions' },
    { id: 'WIPE_DATA', label: 'Execute Data Purge & Factory Resets' },
  ];

  // Fetch Users & Audit Logs
  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, logsRes, statsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/audit-logs'),
        fetch('/api/admin/system-stats')
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (logsRes.ok) setAuditLogs(await logsRes.json());
      if (statsRes.ok) setSystemStats(await statsRes.json());
    } catch (err: any) {
      setActionError(err.message || 'Failed to fetch admin data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const openAddUser = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormRole('DC_TECH');
    setFormDepartment('Datacenter Operations');
    setFormPermissions(['INTAKE_HARDWARE', 'INSPECT_ASSETS']);
    setIsUserModalOpen(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormDepartment(u.department || 'Datacenter Operations');
    setFormPermissions(u.permissions || []);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    try {
      if (editingUser) {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            role: formRole,
            department: formDepartment,
            permissions: formPermissions
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to update user');
        showSuccess(`User ${formName} updated successfully!`);
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            role: formRole,
            department: formDepartment,
            permissions: formPermissions
          })
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to create user');
        showSuccess(`User ${formName} added to directory!`);
      }
      setIsUserModalOpen(false);
      await fetchAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to save user');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // 1-Click Admin Grant / Revoke by Super Admin
  const handleToggleGrantAdmin = async (targetUser: User) => {
    if (targetUser.email === 'bossyemzee@gmail.com' || targetUser.role === 'SUPER_ADMIN') {
      setActionError('Super Admin root credentials cannot be demoted.');
      return;
    }
    const isCurrentlyAdmin = targetUser.role === 'ADMIN' || targetUser.permissions?.includes('ADMIN') || targetUser.permissions?.includes('ADMIN_ACCESS') || targetUser.permissions?.includes('ALL');
    const newRole: UserRole = isCurrentlyAdmin ? 'DC_TECH' : 'ADMIN';
    const newPermissions = isCurrentlyAdmin 
      ? ['INTAKE_HARDWARE', 'INSPECT_ASSETS']
      : ['ALL', 'ADMIN_ACCESS', 'INTAKE_HARDWARE', 'PATCH_CABLING', 'PROVISION_RACKS', 'MANAGE_VLANS', 'MANAGE_USERS'];

    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRole,
          permissions: newPermissions
        })
      });
      if (!res.ok) throw new Error('Failed to update admin permissions');
      showSuccess(
        isCurrentlyAdmin 
          ? `Revoked Admin privileges from ${targetUser.name}. User demoted to DC_TECH.`
          : `Granted Admin privileges to ${targetUser.name}! They can now Add, Edit, and Delete data.`
      );
      await fetchAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to toggle admin status');
    }
  };

  // Safe user deletion with in-app confirmation
  const executeDeleteUser = async (userId: string, userName: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete user');
      }
      showSuccess(`User credentials for "${userName}" revoked.`);
      setConfirmDeleteUserId(null);
      await fetchAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to revoke credentials');
    }
  };

  // Rotate Super Admin Secret Password
  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordRotationError(null);
    setPasswordRotationSuccess(null);

    if (!currentSecretPassword.trim() || !newSecretPassword.trim()) {
      setPasswordRotationError('Please enter both your current and new secret passwords');
      return;
    }
    if (newSecretPassword.trim().length < 6) {
      setPasswordRotationError('New secret password must be at least 6 characters');
      return;
    }
    if (newSecretPassword !== confirmSecretPassword) {
      setPasswordRotationError('New secret password and confirmation do not match');
      return;
    }

    setIsRotatingPassword(true);
    try {
      const res = await fetch('/api/auth/super-admin-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentSecretPassword.trim(),
          newPassword: newSecretPassword.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update secret password');
      }

      setPasswordRotationSuccess('Super Admin secret password updated successfully!');
      setCurrentSecretPassword('');
      setNewSecretPassword('');
      setConfirmSecretPassword('');
      setShowPasswordChangeForm(false);
      showSuccess('Super Admin secret master password updated!');
      await fetchAdminData();
    } catch (err: any) {
      setPasswordRotationError(err.message || 'Password rotation failed');
    } finally {
      setIsRotatingPassword(false);
    }
  };

  // Site Modal in Admin Panel
  const openAddSite = () => {
    setEditingSite(null);
    setSiteName('');
    setSiteLocation('');
    setSiteAddress('');
    setIsSiteModalOpen(true);
  };

  const openEditSite = (s: Site) => {
    setEditingSite(s);
    setSiteName(s.name);
    setSiteLocation(s.location);
    setSiteAddress(s.address);
    setIsSiteModalOpen(true);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSite(true);
    try {
      if (editingSite) {
        await onUpdateSite(editingSite.id, {
          name: siteName,
          location: siteLocation,
          address: siteAddress
        });
        showSuccess(`Facility "${siteName}" updated successfully!`);
      } else {
        await onAddSite({
          name: siteName,
          location: siteLocation,
          address: siteAddress
        });
        showSuccess(`Datacenter facility "${siteName}" created!`);
      }
      setIsSiteModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save site');
    } finally {
      setIsSubmittingSite(false);
    }
  };

  // Rack Modal in Admin Panel
  const openAddRack = () => {
    setEditingRack(null);
    setRackName('');
    setRackSiteId(sites[0]?.id || '');
    setRackHeight('42');
    setIsRackModalOpen(true);
  };

  const openEditRack = (r: Rack) => {
    setEditingRack(r);
    setRackName(r.name);
    setRackSiteId(r.site_id);
    setRackHeight(String(r.height || 42));
    setIsRackModalOpen(true);
  };

  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRack(true);
    try {
      if (editingRack) {
        await onUpdateRack(editingRack.id, {
          name: rackName,
          siteId: rackSiteId,
          height: parseInt(rackHeight, 10) || 42
        });
        showSuccess(`Server rack "${rackName}" updated successfully!`);
      } else {
        await onAddRack({
          name: rackName,
          siteId: rackSiteId,
          height: parseInt(rackHeight, 10) || 42
        });
        showSuccess(`Server rack "${rackName}" deployed!`);
      }
      setIsRackModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save rack');
    } finally {
      setIsSubmittingRack(false);
    }
  };

  const handleExecutePurge = async () => {
    if (confirmPhrase !== 'CONFIRM PURGE') return;
    setIsExecutingPurge(true);
    try {
      await onPurgeDemoData(purgeMode);
      setIsPurgeModalOpen(false);
      setConfirmPhrase('');
      showSuccess(purgeMode === 'FULL_WIPE' ? 'Complete database wipe executed.' : 'All demo hardware and cable links purged! Racks and Facilities ready for clean production.');
      await fetchAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Purge failed');
    } finally {
      setIsExecutingPurge(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 glow-rose">
            SUPER_ADMIN
          </span>
        );
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <ShieldCheck className="w-3 h-3 text-amber-400" /> ADMIN (GRANTED)
          </span>
        );
      case 'NETWORK_ENGINEER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 glow-blue">
            NETWORK_ENGINEER
          </span>
        );
      case 'DC_TECH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 glow-emerald">
            DC_TECH
          </span>
        );
      case 'READ_ONLY_AUDITOR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            AUDITOR (READ-ONLY)
          </span>
        );
    }
  };

  // Filtered devices for Admin Infrastructure tab
  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const matchesSearch = !deviceSearch || 
        d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        d.model.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        d.serial_number.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        (d.ip_address && d.ip_address.includes(deviceSearch));
      
      const rack = racks.find(r => r.id === d.rack_id);
      const matchesSite = deviceFilterSite === 'ALL' || (rack && rack.site_id === deviceFilterSite);

      return matchesSearch && matchesSite;
    });
  }, [devices, racks, deviceSearch, deviceFilterSite]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Architecture Statement */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 glow-rose">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-extrabold text-base sm:text-xl text-white tracking-tight">
                InfraTrack Administration &amp; RBAC Console
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-400 font-bold uppercase">
                Super Admin Root
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Centralized command center to Add, Edit, Delete facilities, racks, hardware assets, and manage credentials
            </p>
          </div>
        </div>

        {/* Persona Switcher Quick Dropdown */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl text-xs">
          <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider pl-1">
            Active Persona:
          </span>
          <select
            value={currentUserEmail || ''}
            onChange={(e) => onChangeActiveUser(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-400 focus:outline-none"
          >
            {users.map(u => (
              <option key={u.id} value={u.email}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Enterprise Policy Configuration Card: "Edit/Add/Manage Only in Admin Panel vs Contextual RBAC" */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Enterprise Mutation &amp; Management Policy
              </h3>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                adminOnlyMode 
                  ? 'bg-rose-950/60 border border-rose-500/40 text-rose-400' 
                  : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
              }`}>
                {adminOnlyMode ? 'Strict Admin Panel Only' : 'Contextual RBAC (Recommended)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
              {adminOnlyMode ? (
                <span className="text-rose-300/90 font-medium">
                  <strong>Strict Admin Mode Active:</strong> All Add, Edit, Delete, and Decommission buttons are strictly isolated inside this Admin Console. Main views (Elevation, Inventory Table, Facilities) are set to read-only monitoring.
                </span>
              ) : (
                <span>
                  <strong>Contextual RBAC Active:</strong> Super Admins can add, edit, and delete both contextually in-place (in Elevation &amp; Inventory) AND via this central Admin Console. Read-only users remain restricted.
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleAdminOnlyMode}
            className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all shrink-0 ${
              adminOnlyMode
                ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/50 glow-rose'
                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/50 glow-emerald'
            }`}
          >
            {adminOnlyMode ? (
              <>
                <ToggleRight className="w-4 h-4 text-rose-400" />
                <span>Switch to Contextual RBAC</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-emerald-400" />
                <span>Enforce Admin-Only Mode</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span className="font-semibold">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="font-semibold">{actionError}</span>
          <button onClick={() => setActionError(null)} className="ml-auto text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs in Admin Console */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('infrastructure')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'infrastructure'
              ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 glow-cyan'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Server className="w-4 h-4 text-cyan-400" />
          <span>Infrastructure &amp; Assets ({sites.length} Facilities, {devices.length} Assets)</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'users'
              ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 glow-rose'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Users &amp; Roles ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('purge')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'purge'
              ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 glow-rose'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Trash2 className="w-4 h-4 text-amber-400" />
          <span>Purge &amp; Factory Reset</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'audit'
              ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 glow-rose'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'telemetry'
              ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 glow-rose'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Database Telemetry</span>
        </button>
      </div>

      {/* TAB 1: Centralized Enterprise Infrastructure & Assets Management */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Sub-selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setInfraSubTab('sites')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  infraSubTab === 'sites' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Facilities ({sites.length})
              </button>
              <button
                type="button"
                onClick={() => setInfraSubTab('racks')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  infraSubTab === 'racks' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Server Racks ({racks.length})
              </button>
              <button
                type="button"
                onClick={() => setInfraSubTab('devices')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  infraSubTab === 'devices' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hardware Assets ({devices.length})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {infraSubTab === 'sites' && (
                <button
                  type="button"
                  onClick={openAddSite}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20"
                >
                  <Plus className="w-4 h-4" /> Add Datacenter Facility
                </button>
              )}
              {infraSubTab === 'racks' && (
                <button
                  type="button"
                  onClick={openAddRack}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20"
                >
                  <Plus className="w-4 h-4" /> Deploy Server Rack
                </button>
              )}
              {infraSubTab === 'devices' && onNavigateToIntake && (
                <button
                  type="button"
                  onClick={onNavigateToIntake}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
                >
                  <Plus className="w-4 h-4" /> Intake New Hardware Asset
                </button>
              )}
            </div>
          </div>

          {/* Sub Tab: Datacenter Sites */}
          {infraSubTab === 'sites' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map(site => {
                const siteRacks = racks.filter(r => r.site_id === site.id);
                const isDeleting = confirmDeleteSiteId === site.id;
                return (
                  <div key={site.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white tracking-tight">{site.name}</h4>
                            <p className="text-[11px] font-mono text-cyan-400">{site.location}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                          {siteRacks.length} Racks
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-3 line-clamp-2">{site.address}</p>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      {isDeleting ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <span className="text-[11px] text-rose-400 font-bold">Cascade Delete?</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteSite(site.id);
                              setConfirmDeleteSiteId(null);
                              showSuccess(`Facility "${site.name}" removed.`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
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
                          title="Delete facility and all associated racks"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Facility
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditSite(site)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5 text-cyan-400" /> Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub Tab: Server Racks */}
          {infraSubTab === 'racks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {racks.map(rack => {
                const site = sites.find(s => s.id === rack.site_id);
                const rackDevices = devices.filter(d => d.rack_id === rack.id);
                const isDeleting = confirmDeleteRackId === rack.id;
                return (
                  <div key={rack.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-white tracking-tight">{rack.name}</h4>
                            <p className="text-[11px] font-mono text-purple-400">{site?.name || 'Unassigned'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-bold">
                          {rack.height || 42}U EIA
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-mono">
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">MOUNTED ASSETS</span>
                          <span className="text-emerald-400 font-bold">{rackDevices.length} Devices</span>
                        </div>
                        <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">TOTAL POWER</span>
                          <span className="text-amber-400 font-bold">{rack.total_power_watts || 0} W</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      {isDeleting ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in">
                          <span className="text-[11px] text-rose-400 font-bold">Decommission?</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteRack(rack.id);
                              setConfirmDeleteRackId(null);
                              showSuccess(`Rack "${rack.name}" deleted.`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
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
                          title="Decommission rack and unmount hardware"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Rack
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openEditRack(rack)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5 text-cyan-400" /> Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub Tab: Hardware Assets with Direct Edit and Decommission Delete */}
          {infraSubTab === 'devices' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by asset name, model, serial #, or IP..."
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 whitespace-nowrap">Facility:</span>
                  <select
                    value={deviceFilterSite}
                    onChange={(e) => setDeviceFilterSite(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-300 focus:outline-none"
                  >
                    <option value="ALL">All Facilities</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Devices Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Hardware Asset</th>
                        <th className="py-3 px-4">Rack Position</th>
                        <th className="py-3 px-4">Serial / IP</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {filteredDevices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                            No hardware assets matching filters.
                          </td>
                        </tr>
                      ) : (
                        filteredDevices.map(dev => {
                          const rack = racks.find(r => r.id === dev.rack_id);
                          const isDeleting = confirmDeleteDeviceId === dev.id;
                          return (
                            <tr key={dev.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-white font-mono">{dev.name}</div>
                                <div className="text-[11px] text-slate-400">{dev.model} • {dev.device_type}</div>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-300">
                                <div>{rack?.name || 'Unassigned'}</div>
                                <div className="text-[10px] text-cyan-400">U{dev.start_u} ({dev.unit_height}U)</div>
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px]">
                                <div className="text-slate-300">{dev.serial_number}</div>
                                <div className="text-emerald-400">{dev.ip_address || 'DHCP unassigned'}</div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                  dev.status === 'ONLINE'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : dev.status === 'WARNING'
                                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                }`}>
                                  {dev.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onInspectDevice(dev)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                    title="Inspect Hardware Specs"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onEditDevice(dev)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                                    title="Edit Device Specifications"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-emerald-400" />
                                  </button>

                                  {isDeleting ? (
                                    <div className="flex items-center gap-1 animate-in fade-in">
                                      <span className="text-[10px] text-rose-400 font-bold">Wipe?</span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await onDeleteDevice(dev.id);
                                          setConfirmDeleteDeviceId(null);
                                          showSuccess(`Device "${dev.name}" decommissioned.`);
                                        }}
                                        className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteDeviceId(null)}
                                        className="px-1.5 py-1 rounded bg-slate-800 text-slate-300 text-[10px]"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteDeviceId(dev.id)}
                                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                                      title="Decommission Asset"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Users & RBAC */}
      {activeTab === 'users' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Super Admin Secret Master Password Management Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-amber-950/20 border-2 border-rose-500/40 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose">
                  <Crown className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                      Super Admin Root Security &amp; Secret Password
                    </h4>
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-400/50 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> STRICT PASSWORD
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Root identity: <span className="font-mono text-rose-300 font-bold">bossyemzee@gmail.com</span> &bull; 1-click bypass disabled
                  </p>
                </div>
              </div>

              {currentUserEmail?.toLowerCase() === 'bossyemzee@gmail.com' ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChangeForm(!showPasswordChangeForm);
                    setPasswordRotationError(null);
                    setPasswordRotationSuccess(null);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                >
                  <KeyRound className="w-4 h-4 text-amber-300" />
                  <span>{showPasswordChangeForm ? 'Close Form' : 'Rotate Secret Password'}</span>
                </button>
              ) : (
                <span className="text-[11px] font-mono text-slate-400 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                  Root Admin Authentication Required to Rotate
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To safeguard your datacenter, <strong>one-click login has been replaced with a mandatory secret password</strong>. No visitor can casually escalate into Super Admin without knowing your secret key.
            </p>

            {/* Inline Password Rotation Form */}
            {showPasswordChangeForm && currentUserEmail?.toLowerCase() === 'bossyemzee@gmail.com' && (
              <form onSubmit={handleRotatePassword} className="p-4 rounded-xl bg-slate-950/90 border border-rose-500/30 space-y-3.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-300 border-b border-slate-800 pb-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Rotate Super Admin Secret Master Password</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Current Secret Password:
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Current secret key..."
                      value={currentSecretPassword}
                      onChange={(e) => setCurrentSecretPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      New Secret Password:
                    </label>
                    <div className="relative">
                      <input
                        type={showNewSecretPassword ? 'text' : 'password'}
                        required
                        placeholder="At least 6 characters..."
                        value={newSecretPassword}
                        onChange={(e) => setNewSecretPassword(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewSecretPassword(!showNewSecretPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showNewSecretPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Confirm New Password:
                    </label>
                    <input
                      type={showNewSecretPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat new password..."
                      value={confirmSecretPassword}
                      onChange={(e) => setConfirmSecretPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {passwordRotationError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{passwordRotationError}</span>
                  </div>
                )}

                {passwordRotationSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{passwordRotationSuccess}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswordChangeForm(false)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRotatingPassword}
                    className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isRotatingPassword ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save New Secret Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Active User Registry</h3>
              <p className="text-xs text-slate-400">
                Grant or revoke credentials, assign role capabilities, and enforce enterprise access tiers
              </p>
            </div>
            <button
              onClick={openAddUser}
              className="min-h-[38px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30"
            >
              <Plus className="w-4 h-4" /> Provision New User
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role Tier</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Permissions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{u.name}</div>
                        <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {getRoleBadge(u.role)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {u.department || 'Datacenter Ops'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.permissions?.map(perm => (
                            <span key={perm} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                              {perm}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.email !== 'bossyemzee@gmail.com' && u.role !== 'SUPER_ADMIN' && (
                            u.role === 'ADMIN' ? (
                              <button
                                type="button"
                                onClick={() => handleToggleGrantAdmin(u)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                title="Revoke Admin permissions from this user"
                              >
                                <ShieldAlert className="w-3 h-3 text-amber-400" /> Revoke Admin
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleGrantAdmin(u)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-all"
                                title="Grant Admin permissions to allow adding, editing, and deleting data"
                              >
                                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Grant Admin
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => openEditUser(u)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Edit Role & Permissions"
                          >
                            <SlidersHorizontal className="w-4 h-4" />
                          </button>
                          {confirmDeleteUserId === u.id ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in">
                              <span className="text-[11px] text-rose-400 font-semibold">Revoke?</span>
                              <button
                                type="button"
                                onClick={() => executeDeleteUser(u.id, u.name)}
                                className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold shadow"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            users.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(u.id)}
                                className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                title="Revoke User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Purge & Factory Reset */}
      {activeTab === 'purge' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="bg-gradient-to-br from-rose-950/30 via-slate-900 to-slate-950 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">One-Click Demo Data Purge</h3>
                <p className="text-xs text-rose-300/80">
                  Clean up seeded test hardware assets or execute a complete wipe for production handoff
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">1. Purge Demo Hardware Only</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Removes all demo servers, switches, and patch cables. Preserves your Datacenter Facilities, Racks, and VLANs so you can start intake with clean, empty 42U racks.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPurgeMode('DEVICES_ONLY');
                    setConfirmPhrase('CONFIRM PURGE');
                    setIsPurgeModalOpen(true);
                  }}
                  className="w-full mt-2 min-h-[38px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Purge Demo Hardware
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">2. Full Database Infrastructure Wipe</span>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                    High Impact
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Completely wipes all sites, racks, devices, VLANs, and cable patches in Neon PostgreSQL. Leaves an empty database shell for greenfield installations.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPurgeMode('FULL_WIPE');
                    setConfirmPhrase('CONFIRM PURGE');
                    setIsPurgeModalOpen(true);
                  }}
                  className="w-full mt-2 min-h-[38px] px-4 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Full Infrastructure Wipe
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <span>Accidentally purged too much? You can restore the standard enterprise demo seeds at any time.</span>
              <button
                type="button"
                onClick={onReseedFactoryData}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Restore Default Seed Catalog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">System &amp; Hardware Audit Trail</h3>
              <p className="text-xs text-slate-400">Tamper-evident log of all hardware changes, status transitions, and user actions</p>
            </div>
            <button
              onClick={fetchAdminData}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800">
                  <tr className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No audit events recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/30 font-mono text-[11px]">
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at || Date.now()).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-cyan-400">
                            {log.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300">
                          {log.user_email}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 max-w-md truncate">
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Database Telemetry */}
      {activeTab === 'telemetry' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-xs font-mono">DATABASE ENGINE</span>
              <div className="text-base font-extrabold text-emerald-400 mt-1 flex items-center gap-1.5">
                <Database className="w-4 h-4" /> Neon Serverless PG
              </div>
              <span className="text-[10px] text-slate-500 font-mono">PostgreSQL v16 (Scale-to-zero)</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-xs font-mono">ROUNDTRIP LATENCY</span>
              <div className="text-base font-extrabold text-cyan-400 mt-1 flex items-center gap-1.5">
                <Activity className="w-4 h-4" /> {dbStatus?.latencyMs || 24} ms
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">Optimal connection health</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-xs font-mono">TOTAL MANAGED ASSETS</span>
              <div className="text-base font-extrabold text-white mt-1">
                {systemStats?.counts?.devices || devices.length} Devices
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{racks.length} Server Racks deployed</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <span className="text-slate-400 text-xs font-mono">FACILITY SITES</span>
              <div className="text-base font-extrabold text-purple-400 mt-1">
                {sites.length} Active Regions
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{vlans.length} 802.1Q VLANs</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit User */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-white">
                {editingUser ? `Edit Credentials: ${editingUser.name}` : 'Provision New System User'}
              </h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Email / SSO Identifier</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="elena.rostova@infraops.internal"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Role Tier</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-rose-500"
                  >
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Root Access)</option>
                    <option value="ADMIN">ADMIN (Granted by Super Admin - Add, Edit, Delete)</option>
                    <option value="NETWORK_ENGINEER">NETWORK_ENGINEER (Cabling &amp; VLANs)</option>
                    <option value="DC_TECH">DC_TECH (Intake &amp; Racks)</option>
                    <option value="READ_ONLY_AUDITOR">READ_ONLY_AUDITOR (Read-only)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Department</label>
                  <input
                    type="text"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder="Datacenter Engineering"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Granular Capabilities</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-slate-800">
                  {availablePermissions.map(p => {
                    const isChecked = formPermissions.includes(p.id) || formPermissions.includes('ALL');
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormPermissions(prev => [...prev, p.id]);
                            } else {
                              setFormPermissions(prev => prev.filter(x => x !== p.id && x !== 'ALL'));
                            }
                          }}
                          className="rounded border-slate-700 text-rose-500 focus:ring-0"
                        />
                        <span>{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUser}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold disabled:opacity-50"
                >
                  {isSubmittingUser ? 'Saving...' : 'Save User Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Datacenter Facility */}
      {isSiteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-white">
                {editingSite ? `Edit Facility: ${editingSite.name}` : 'Provision Datacenter Facility'}
              </h3>
              <button onClick={() => setIsSiteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Facility Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frankfurt DC-2 (Main Hub)"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Metropolitan Region / Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frankfurt, Germany (FRA-1)"
                  value={siteLocation}
                  onChange={(e) => setSiteLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Physical Address / Campus</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Hanauer Landstraße 300, 60314 Frankfurt am Main"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsSiteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSite}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold disabled:opacity-50"
                >
                  {isSubmittingSite ? 'Saving...' : editingSite ? 'Update Facility' : 'Provision Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Server Rack */}
      {isRackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base text-white">
                {editingRack ? `Edit Rack: ${editingRack.name}` : 'Deploy Server Rack'}
              </h3>
              <button onClick={() => setIsRackModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRack} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rack Identifier / Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack-C03 (Storage SAN)"
                  value={rackName}
                  onChange={(e) => setRackName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Facility Location</label>
                <select
                  required
                  value={rackSiteId}
                  onChange={(e) => setRackSiteId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-purple-500"
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.location})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rack Height (EIA Units)</label>
                <select
                  value={rackHeight}
                  onChange={(e) => setRackHeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-bold focus:outline-none focus:border-purple-500"
                >
                  <option value="42">42U (Standard EIA-310 Enterprise)</option>
                  <option value="48">48U (High Density Telco Enclosure)</option>
                  <option value="24">24U (Half Rack / Edge Enclosure)</option>
                  <option value="12">12U (Wall Mount Cabinet)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsRackModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRack}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
                >
                  {isSubmittingRack ? 'Saving...' : editingRack ? 'Update Rack' : 'Deploy Rack'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmation for Data Purge */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-2.5 text-rose-400 mb-3">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="font-extrabold text-base text-white">
                Confirm Infrastructure Purge
              </h3>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              This will permanently delete all demo devices, blade modules, and active cable patches in Neon PostgreSQL.
            </p>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono mb-4 text-slate-300">
              Type <strong className="text-rose-400">CONFIRM PURGE</strong> below to proceed:
            </div>

            <input
              type="text"
              placeholder="CONFIRM PURGE"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-rose-400 focus:outline-none focus:border-rose-500 mb-4"
            />

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmPhrase !== 'CONFIRM PURGE' || isExecutingPurge}
                onClick={handleExecutePurge}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-rose-600/30"
              >
                {isExecutingPurge ? 'Purging...' : 'Execute Purge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
