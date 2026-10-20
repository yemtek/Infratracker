import React, { useState } from 'react';
import { 
  Wifi, WifiOff, RefreshCw, Trash2, Download, AlertTriangle, 
  CheckCircle2, Server, Clock, X, ArrowUpRight, ShieldCheck,
  HardDrive, Layers, Zap, Radio, SlidersHorizontal, Check, Building2
} from 'lucide-react';
import { 
  OfflineQueueItem, 
  removeFromOfflineQueue, 
  clearOfflineQueue, 
  syncOfflineQueueItem, 
  exportQueueToCSV 
} from '../utils/offline-sync.ts';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: OfflineQueueItem[];
  isOnline: boolean;
  isSimulatedOffline: boolean;
  onToggleSimulation: () => void;
  onSyncAll: () => Promise<any>;
  isSyncing: boolean;
  syncProgress: { current: number; total: number } | null;
  onSuccessSync?: () => void;
}

export function OfflineQueueModal({
  isOpen,
  onClose,
  queue,
  isOnline,
  isSimulatedOffline,
  onToggleSimulation,
  onSyncAll,
  isSyncing,
  syncProgress,
  onSuccessSync
}: OfflineQueueModalProps) {
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<{ id: string; msg: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!isOpen) return null;

  const handleSyncSingle = async (item: OfflineQueueItem) => {
    if (!isOnline) return;
    setSyncingItemId(item.localId);
    setItemError(null);
    try {
      const res = await syncOfflineQueueItem(item);
      if (res.success) {
        if (onSuccessSync) onSuccessSync();
      } else {
        setItemError({ id: item.localId, msg: res.error || 'Sync failed' });
      }
    } finally {
      setSyncingItemId(null);
    }
  };

  const handleBatchSync = async () => {
    if (!isOnline || isSyncing) return;
    const res = await onSyncAll();
    if (res && res.successCount > 0 && onSuccessSync) {
      onSuccessSync();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
              !isOnline 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}>
              {!isOnline ? <WifiOff className="w-5 h-5" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base tracking-tight">
                  Server Room Field Intake Queue
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {queue.length} Staged {queue.length === 1 ? 'Asset' : 'Assets'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Zero-signal server room intake buffer &bull; Syncs safely to PostgreSQL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Signal Simulation Banner */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full shrink-0 ${
              !isOnline ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
            }`} />
            <div>
              <span className="font-bold text-white">
                {!isOnline ? 'Basement / Cold Aisle (Offline Mode)' : 'Connected to Datacenter Network (Online)'}
              </span>
              <p className="text-[11px] text-slate-400 font-mono">
                {!isOnline 
                  ? 'Assets are staged safely in local storage with zero packet loss' 
                  : 'Ready to commit staged hardware assets to PostgreSQL database'}
              </p>
            </div>
          </div>

          {/* Simulate Server Room Signal button */}
          <button
            type="button"
            onClick={onToggleSimulation}
            className={`min-h-[34px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
              isSimulatedOffline
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-800'
            }`}
            title="Simulate losing cell/Wi-Fi signal down in server room"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isSimulatedOffline ? 'Simulating Server Room (Active)' : 'Simulate Server Room'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {queue.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-center mx-auto text-slate-500">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">No Pending Offline Assets</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  All scanned hardware assets have been synced to the primary database. You can continue scanning servers and switches down in the server room anytime.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => {
                const isItemSyncing = syncingItemId === item.localId || isSyncing;
                const hasError = itemError?.id === item.localId || item.syncStatus === 'FAILED';

                return (
                  <div
                    key={item.localId}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.kind === 'SITE' ? (
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                        ) : item.kind === 'RACK' ? (
                          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
                            <Server className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 shrink-0">
                            <Server className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">{item.name}</span>
                            {item.kind === 'SITE' ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                                FACILITY
                              </span>
                            ) : item.kind === 'RACK' ? (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                                {item.height}U ENCLOSURE
                              </span>
                            ) : (
                              <>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                  {item.deviceType}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                                  U{item.startU} ({item.unitHeight}U)
                                </span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                            {item.kind === 'SITE' ? (
                              <span>Metro: <span className="text-white font-bold">{item.location}</span>{item.address ? ` • ${item.address}` : ''}</span>
                            ) : item.kind === 'RACK' ? (
                              <span>Target Datacenter: <span className="text-white font-bold">{item.siteName || item.siteId}</span></span>
                            ) : (
                              <span>SN: <span className="text-white font-bold">{item.serialNumber}</span> &bull; {item.model}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={!isOnline || isItemSyncing}
                          onClick={() => handleSyncSingle(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1 active:scale-95"
                          title="Sync this item immediately"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isItemSyncing ? 'animate-spin' : ''}`} />
                          <span>Sync</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => removeFromOfflineQueue(item.localId)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                          title="Discard staged item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Staged: {new Date(item.queuedAt).toLocaleTimeString()}
                      </span>
                      <span>
                        {item.kind === 'SITE' 
                          ? 'Action: Deploy Facility' 
                          : item.kind === 'RACK' 
                            ? 'Action: Deploy Server Rack' 
                            : `Rack: ${item.rackName || item.rackId}`}
                      </span>
                    </div>

                    {hasError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{itemError?.msg || item.errorMessage || 'Synchronization conflict or error'}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/90 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={exportQueueToCSV}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Export offline queue as CSV file for audit records"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>

                {confirmClear ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-rose-400 font-bold">Clear all?</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearOfflineQueue();
                        setConfirmClear(false);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                    >
                      Yes, Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-900 text-xs transition-colors"
                    title="Clear offline queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Close
            </button>

            {queue.length > 0 && (
              <button
                type="button"
                disabled={!isOnline || isSyncing}
                onClick={handleBatchSync}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing 
                    ? `Syncing (${syncProgress ? `${syncProgress.current}/${syncProgress.total}` : '...'})` 
                    : !isOnline 
                    ? 'Sync Unavailable (Offline)' 
                    : `Sync All ${queue.length} Assets`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
