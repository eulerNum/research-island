import { createContext, useContext } from 'react';
import type { MapDataActions } from '../hooks/useMapData';

export const MapDataContext = createContext<MapDataActions | null>(null);

export function useMapDataContext(): MapDataActions {
  const ctx = useContext(MapDataContext);
  if (!ctx) throw new Error('useMapDataContext must be used within MapDataContext.Provider');
  return ctx;
}
