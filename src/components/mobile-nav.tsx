import React, { useState } from 'react';
import { 
  Server, Cable, PlusCircle, Database, Layers, HardDrive, 
  Menu, X, Activity, RefreshCw, CheckCircle2, ChevronRight,
  ShieldCheck, MapPin, Gauge, Building2, LogOut, LogIn, Lock,
  ShieldAlert, User as UserIcon, Crown, Sparkles, KeyRound, Wifi, WifiOff
} from 'lucide-react';
import { DatabaseStatus, Site } from '../types/index.ts';
import { ThemeToggle } from './theme-toggle.tsx';
import { PWAInstallButton } from './pwa-install-button.tsx';

export type NavTab = 'elevation' | 'cable-tracer' | 'hardware-form' | 'inventory' | 'vlans' | 'sites-racks' | 'admin';

interface MobileNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  dbStatus: DatabaseStatus | null;
  sites: Site[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  onReseedData: () => void;
  isReseeding: boolean;
  isAdminGranted?: boolean;
  isSuperAdmin?: boolean;
  currentUserEmail?: string | null;
  currentUserName?: string;
  currentUserRole?: string;
  onLogout?: () => void;
  onOpenLogin?: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  isOnline?: boolean;
  offlineQueuedCount?: number;
  onOpenOfflineQueue?: () => void;
}

export function MobileNav({
  currentTab,
  onSelectTab,
  dbStatus,
  sites,
  selectedSiteId,
  onSelectSite,
  onReseedData,
  isReseeding,
  isAdminGranted = false,
  isSuperAdmin = false,
  currentUserEmail,
  currentUserName,
  currentUserRole,
  onLogout,
  onOpenLogin,
  theme = 'dark',
  onToggleTheme,
  isOnline = true,
  offlineQueuedCount = 0,
  onOpenOfflineQueue
}: MobileNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: NavTab; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'elevation', label: '42U Rack Elevation', icon: Server, badge: 'Interactive' },
    { id: 'sites-racks', label: 'Datacenters & Racks', icon: Building2, badge: `${sites.length} Sites` },
    { id: 'cable-tracer', label: 'Port Cable Tracer', icon: Cable, badge: 'Live SVG' },
    ...(isAdminGranted ? [{ id: 'hardware-form' as NavTab, label: 'Hardware Intake', icon: PlusCircle, badge: 'OCR/Barcode' }] : []),
    { id: 'inventory', label: 'Asset Inventory', icon: HardDrive },
    { id: 'vlans', label: 'VLAN Segments', icon: Layers },
    ...(isAdminGranted ? [{ id: 'admin' as NavTab, label: 'Admin & RBAC Console', icon: ShieldCheck, badge: isSuperAdmin ? 'Root' : 'Admin' }] : [])
  ];

  const handleTabClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const renderRoleBadge = () => {
    if (!currentUserEmail) {
      return (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-800/60 font-semibold">
          GUEST (READ-ONLY)
        </span>
      );
    }
    if (isSuperAdmin) {
      return (
        <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 glow-rose flex items-center gap-1">
          <Crown className="w-3 h-3 text-rose-400" /> SUPER ADMIN
        </span>
      );
    }
    if (isAdminGranted) {
      return (
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-amber-400" /> ADMIN GRANTED
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
        {currentUserRole || 'OPERATOR'}
      </span>
    );
  };

  return (
    <>
      {/* Top Mobile Bar (Fixed header for mobile screens < 1024px) */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white active:bg-slate-800 transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-sm glow-emerald">
              IT
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white block leading-tight">
                Infra<span className="text-emerald-400">Track</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                DC Operations
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Header Actions: PWA + Offline Queue + Theme Toggle + Auth */}
        <div className="flex items-center gap-1.5">
          {/* Offline / Server Room indicator button */}
          {!isOnline ? (
            <button
              type="button"
              onClick={onOpenOfflineQueue}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1 animate-pulse"
              title="Server Room Offline Mode Active - Tap to view queue"
            >
              <WifiOff className="w-3.5 h-3.5" />
              {offlineQueuedCount > 0 && (
                <span className="font-mono text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full font-black">
                  {offlineQueuedCount}
                </span>
              )}
            </button>
          ) : (
            offlineQueuedCount > 0 && (
              <button
                type="button"
                onClick={onOpenOfflineQueue}
                className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1"
                title="Pending server room queue"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span className="font-mono text-[10px]">{offlineQueuedCount}</span>
              </button>
            )
          )}

          <PWAInstallButton compact={true} />

          {onToggleTheme && (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} compact={true} />
          )}

          {currentUserEmail ? (
            <button
              onClick={onOpenLogin}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-800 flex items-center gap-1.5"
              title="Account Details & Roles"
            >
              <div className={`w-2 h-2 rounded-full ${isSuperAdmin ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="text-[11px] font-mono truncate max-w-[80px]">
                {isSuperAdmin ? 'SUPER' : 'ADMIN'}
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1"
              title="Sign In or View Super Admin Details"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {isAdminGranted && (
            <button
              onClick={() => handleTabClick('hardware-form')}
              className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
              title="Intake Hardware"
              aria-label="Intake Hardware"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Mobile Slide-out Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in"
          />

          {/* Drawer Panel */}
          <div className="relative w-4/5 max-w-xs bg-slate-950 border-r border-slate-800 p-5 flex flex-col h-full z-10 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black">
                  IT
                </div>
                <div>
                  <h2 className="font-extrabold text-base text-white tracking-tight">
                    Infra<span className="text-emerald-400">Track</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Enterprise DC Ops
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Super Admin Credentials Banner */}
            <div className="py-3 border-b border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  if (onOpenLogin) onOpenLogin();
                  setMobileMenuOpen(false);
                }}
                className="w-full p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Crown className="w-4 h-4 text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-rose-300 block truncate">
                      Super Admin Credentials
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block truncate">
                      bossyemzee@gmail.com
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
              </button>
            </div>

            {/* Datacenter Site Switcher */}
            <div className="py-3 border-b border-slate-800/80">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Active Datacenter
                </label>
                {isAdminGranted && (
                  <button
                    type="button"
                    onClick={() => handleTabClick('sites-racks')}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    + Manage
                  </button>
                )}
              </div>
              <select
                value={selectedSiteId}
                onChange={(e) => onSelectSite(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.location})
                  </option>
                ))}
              </select>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full min-h-[46px] px-3.5 rounded-xl text-left flex items-center justify-between font-medium text-xs transition-all ${
                      isActive
                        ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 glow-emerald font-semibold'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                        isActive 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Drawer Footer: Theme Toggle & Session */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              {onToggleTheme && (
                <ThemeToggle theme={theme} onToggle={onToggleTheme} compact={false} />
              )}

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {currentUserEmail ? (currentUserName || currentUserEmail) : 'Guest Visitor'}
                  </div>
                  <div className="mt-0.5">{renderRoleBadge()}</div>
                </div>

                {currentUserEmail ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onLogout) onLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="p-2 rounded-lg bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30 text-xs font-bold transition-all shrink-0"
                    title="Log Out to Guest Mode"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenLogin) onOpenLogin();
                      setMobileMenuOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Sign In
                  </button>
                )}
              </div>

              <button
                onClick={onReseedData}
                disabled={isReseeding}
                className="w-full min-h-[38px] px-3 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReseeding ? 'animate-spin text-emerald-400' : ''}`} />
                {isReseeding ? 'Resetting...' : 'Reset Demo Seeds'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Desktop Sidebar (Screen >= 1024px) */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-slate-950 border-r border-slate-800/80 h-screen sticky top-0 shrink-0">
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black text-lg glow-emerald">
              IT
            </div>
            <div>
              <h1 className="font-extrabold text-lg text-white tracking-tight">
                Infra<span className="text-emerald-400">Track</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                IT &amp; Network Asset Ops
              </p>
            </div>
          </div>

          {/* Quick Super Admin Credentials Banner */}
          <div className="mt-4">
            <button
              type="button"
              onClick={onOpenLogin}
              className="w-full p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-left transition-all flex items-center justify-between group"
              title="View Super Admin credentials and access matrix"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Crown className="w-4 h-4 text-rose-400 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-rose-300 block truncate">
                    Super Admin Master
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 block truncate">
                    bossyemzee@gmail.com
                  </span>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            </button>
          </div>

          {/* Datacenter Site Dropdown */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Datacenter Site
              </label>
              {isAdminGranted && (
                <button
                  type="button"
                  onClick={() => handleTabClick('sites-racks')}
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold hover:underline"
                >
                  + Manage / Add
                </button>
              )}
            </div>
            <select
              value={selectedSiteId}
              onChange={(e) => onSelectSite(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.location})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Datacenter Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full min-h-[46px] px-3.5 rounded-xl text-left flex items-center justify-between font-medium text-xs xl:text-sm transition-all ${
                  isActive
                    ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 glow-emerald font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    isActive 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer: Theme Toggle & Session Info */}
        <div className="p-4 border-t border-slate-800/80 space-y-2.5">
          {/* Theme Mode Toggle (Everyone can switch anytime) */}
          {onToggleTheme && (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} compact={false} />
          )}

          {/* PWA Install App Button for Desktop & Mobile */}
          <PWAInstallButton compact={false} />

          {/* Server Room Field Sync Status Button */}
          {onOpenOfflineQueue && (
            <button
              type="button"
              onClick={onOpenOfflineQueue}
              className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-colors ${
                !isOnline
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : offlineQueuedCount > 0
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title="Server Room Sync Queue - Store assets offline and sync when connected"
            >
              <div className="flex items-center gap-2 min-w-0">
                {!isOnline ? (
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-bold text-[11px] truncate">
                    {!isOnline ? 'Server Room Offline' : 'NOC Connected'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {offlineQueuedCount > 0 
                      ? `${offlineQueuedCount} staged waiting sync` 
                      : '0 queued &bull; Tap to test'}
                  </div>
                </div>
              </div>

              {offlineQueuedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-mono text-[10px] font-black shrink-0">
                  {offlineQueuedCount}
                </span>
              )}
            </button>
          )}

          {/* Active User Identity & Log Out Button */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onOpenLogin}
                className="text-left w-full group"
                title="Click to view details or switch persona"
              >
                <div className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                  {currentUserEmail ? (currentUserName || currentUserEmail) : 'Guest Visitor'}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {renderRoleBadge()}
                </div>
              </button>
            </div>

            {currentUserEmail ? (
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-colors shrink-0"
                title="Log Out to Guest Mode"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm shadow-emerald-600/30"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In
              </button>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1 text-slate-300">
              <Database className="w-3 h-3 text-emerald-400" /> Neon PG
            </span>
            <span className="text-emerald-400 font-bold">{dbStatus?.latencyMs || 24}ms</span>
          </div>

          <button
            onClick={onReseedData}
            disabled={isReseeding}
            className="w-full min-h-[38px] px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            title="Reset to factory enterprise demo seed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReseeding ? 'animate-spin text-emerald-400' : ''}`} />
            {isReseeding ? 'Resetting...' : 'Reset Demo Seeds'}
          </button>
        </div>
      </aside>
    </>
  );
}
