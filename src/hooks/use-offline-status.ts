import { useState, useEffect, useCallback } from 'react';
import { 
  getOfflineQueue, 
  OfflineQueueItem,
  isEffectiveOnline, 
  isServerRoomSimulatedOffline, 
  setServerRoomSimulatedOffline,
  syncAllOfflineQueue
} from '../utils/offline-sync.ts';

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => isEffectiveOnline());
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => isServerRoomSimulatedOffline());
  const [queue, setQueue] = useState<OfflineQueueItem[]>(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);

  const updateState = useCallback(() => {
    setIsOnline(isEffectiveOnline());
    setIsSimulatedOffline(isServerRoomSimulatedOffline());
    setQueue(getOfflineQueue());
  }, []);

  useEffect(() => {
    const handleOnline = () => updateState();
    const handleOffline = () => updateState();
    const handleQueueUpdated = (e: any) => {
      setQueue(e.detail || getOfflineQueue());
    };
    const handleConnectionChanged = () => updateState();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('infratrack:queue-updated', handleQueueUpdated);
    window.addEventListener('infratrack:connection-changed', handleConnectionChanged);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('infratrack:queue-updated', handleQueueUpdated);
      window.removeEventListener('infratrack:connection-changed', handleConnectionChanged);
    };
  }, [updateState]);

  const toggleSimulation = useCallback(() => {
    const next = !isServerRoomSimulatedOffline();
    setServerRoomSimulatedOffline(next);
    setIsSimulatedOffline(next);
    setIsOnline(!next && (typeof navigator !== 'undefined' ? navigator.onLine : true));
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isEffectiveOnline()) return null;
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: queue.length });

    try {
      const result = await syncAllOfflineQueue((current, total) => {
        setSyncProgress({ current, total });
      });
      setQueue(getOfflineQueue());
      return result;
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [queue.length]);

  return {
    isOnline,
    isSimulatedOffline,
    queue,
    queuedCount: queue.length,
    isSyncing,
    syncProgress,
    toggleSimulation,
    triggerSync,
    refreshQueue: () => setQueue(getOfflineQueue())
  };
}
