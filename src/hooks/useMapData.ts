import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  ResearchMap,
  Island,
  City,
  Bridge,
  Road,
  Paper,
  ResearchGap,
  BridgeDirection,
  RoadDirection,
} from '../services/types';
import * as mapService from '../services/mapService';
import * as githubService from '../services/githubService';
import { ConflictError } from '../services/githubService';
import { generateId } from '../utils/idGenerator';

export function useMapData(mapId?: string) {
  // Set active map ID in mapService before loading
  const effectiveMapId = mapId ?? null;
  mapService.setActiveMapId(effectiveMapId);

  const [mapData, setMapData] = useState<ResearchMap>(mapService.getFullMap);

  const refresh = useCallback(() => {
    setMapData(mapService.getFullMap());
  }, []);

  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataVersionRef = useRef(0); // tracks mutations for auto-save

  // Auto-load from GitHub when mapId changes
  useEffect(() => {
    mapService.setActiveMapId(effectiveMapId);
    const config = githubService.getGitHubConfig();
    if (config && effectiveMapId) {
      setSyncing(true);
      githubService.loadFromGitHub(config, effectiveMapId)
        .then((map) => {
          mapService.importMap(map);
          refresh();
          setLastSyncError(null);
        })
        .catch((e) => {
          // 404 = new map with no data yet, that's fine
          if (!(e as Error).message.includes('404')) {
            setLastSyncError((e as Error).message);
          }
          refresh(); // still load from localStorage
        })
        .finally(() => setSyncing(false));
    } else {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMapId]);

  // ─── Islands ────────────────────────────────────────────

  const addIsland = useCallback(
    (name: string, position: { x: number; y: number }, color?: string) => {
      const island: Island = {
        id: generateId(),
        name,
        position,
        cities: [],
        color,
      };
      mapService.addIsland(island);
      refresh();
    },
    [refresh],
  );

  const updateIsland = useCallback(
    (island: Island) => {
      mapService.updateIsland(island);
      refresh();
    },
    [refresh],
  );

  /** Save island position to localStorage without triggering React re-render.
   *  D3 already moved the element visually, so no state refresh needed. */
  const saveIslandPosition = useCallback(
    (id: string, position: { x: number; y: number }) => {
      mapService.updateIslandPosition(id, position);
    },
    [],
  );

  const deleteIsland = useCallback(
    (id: string) => {
      mapService.deleteIsland(id);
      refresh();
    },
    [refresh],
  );

  // ─── Cities ─────────────────────────────────────────────

  const addCity = useCallback(
    (islandId: string, name: string, position: { x: number; y: number }) => {
      const city: City = {
        id: generateId(),
        islandId,
        name,
        position,
        paperIds: [],
      };
      mapService.addCity(islandId, city);
      refresh();
    },
    [refresh],
  );

  const updateCity = useCallback(
    (islandId: string, city: City) => {
      mapService.updateCity(islandId, city);
      refresh();
    },
    [refresh],
  );

  /** Save city position to localStorage without triggering React re-render. */
  const saveCityPosition = useCallback(
    (islandId: string, cityId: string, position: { x: number; y: number }) => {
      mapService.updateCityPosition(islandId, cityId, position);
    },
    [],
  );

  const deleteCity = useCallback(
    (islandId: string, cityId: string) => {
      mapService.deleteCity(islandId, cityId);
      refresh();
    },
    [refresh],
  );

  // ─── Bridges ────────────────────────────────────────────

  const addBridge = useCallback(
    (
      sourceIslandId: string,
      targetIslandId: string,
      direction: BridgeDirection,
      label?: string,
    ) => {
      const bridge: Bridge = {
        id: generateId(),
        sourceIslandId,
        targetIslandId,
        direction,
        label,
        paperIds: [],
        gapIds: [],
      };
      mapService.addBridge(bridge);
      refresh();
    },
    [refresh],
  );

  const updateBridge = useCallback(
    (bridge: Bridge) => {
      mapService.updateBridge(bridge);
      refresh();
    },
    [refresh],
  );

  const deleteBridge = useCallback(
    (id: string) => {
      mapService.deleteBridge(id);
      refresh();
    },
    [refresh],
  );

  // ─── Roads ──────────────────────────────────────────────

  const addRoad = useCallback(
    (
      sourceCityId: string,
      targetCityId: string,
      direction: RoadDirection,
      label?: string,
    ) => {
      const road: Road = {
        id: generateId(),
        sourceCityId,
        targetCityId,
        direction,
        label,
        paperIds: [],
        gapIds: [],
      };
      mapService.addRoad(road);
      refresh();
    },
    [refresh],
  );

  const updateRoad = useCallback(
    (road: Road) => {
      mapService.updateRoad(road);
      refresh();
    },
    [refresh],
  );

  const deleteRoad = useCallback(
    (id: string) => {
      mapService.deleteRoad(id);
      refresh();
    },
    [refresh],
  );

  // ─── Papers ─────────────────────────────────────────────

  /** Add paper. Returns actual stored ID (existing if duplicate). */
  const addPaper = useCallback(
    (paper: Paper): string => {
      const actualId = mapService.addPaper(paper);
      refresh();
      return actualId;
    },
    [refresh],
  );

  const updatePaper = useCallback(
    (paper: Paper) => {
      mapService.updatePaper(paper);
      refresh();
    },
    [refresh],
  );

  const deletePaper = useCallback(
    (id: string) => {
      mapService.deletePaper(id);
      refresh();
    },
    [refresh],
  );

  const addPaperToBridge = useCallback(
    (paperId: string, bridgeId: string) => {
      const map = mapService.getFullMap();
      const bridge = map.bridges.find((b) => b.id === bridgeId);
      if (bridge && !bridge.paperIds.includes(paperId)) {
        bridge.paperIds.push(paperId);
        mapService.updateBridge(bridge);
        refresh();
      }
    },
    [refresh],
  );

  const addPaperToRoad = useCallback(
    (paperId: string, roadId: string) => {
      const map = mapService.getFullMap();
      const road = map.roads.find((r) => r.id === roadId);
      if (road && !road.paperIds.includes(paperId)) {
        road.paperIds.push(paperId);
        mapService.updateRoad(road);
        refresh();
      }
    },
    [refresh],
  );

  /** Remove paper from bridge, and delete globally if no longer referenced anywhere */
  const removePaperFromBridge = useCallback(
    (paperId: string, bridgeId: string) => {
      const map = mapService.getFullMap();
      const bridge = map.bridges.find((b) => b.id === bridgeId);
      if (bridge) {
        bridge.paperIds = bridge.paperIds.filter((id) => id !== paperId);
        mapService.updateBridge(bridge);
      }
      // Check if paper is still referenced anywhere
      const freshMap = mapService.getFullMap();
      const stillUsed =
        freshMap.bridges.some((b) => b.paperIds.includes(paperId)) ||
        freshMap.roads.some((r) => r.paperIds.includes(paperId)) ||
        freshMap.islands.some((isl) => isl.cities.some((c) => c.paperIds.includes(paperId)));
      if (!stillUsed) {
        mapService.deletePaper(paperId);
      }
      refresh();
    },
    [refresh],
  );

  /** Remove paper from road, and delete globally if no longer referenced anywhere */
  const removePaperFromRoad = useCallback(
    (paperId: string, roadId: string) => {
      const map = mapService.getFullMap();
      const road = map.roads.find((r) => r.id === roadId);
      if (road) {
        road.paperIds = road.paperIds.filter((id) => id !== paperId);
        mapService.updateRoad(road);
      }
      const freshMap = mapService.getFullMap();
      const stillUsed =
        freshMap.bridges.some((b) => b.paperIds.includes(paperId)) ||
        freshMap.roads.some((r) => r.paperIds.includes(paperId)) ||
        freshMap.islands.some((isl) => isl.cities.some((c) => c.paperIds.includes(paperId)));
      if (!stillUsed) {
        mapService.deletePaper(paperId);
      }
      refresh();
    },
    [refresh],
  );

  // ─── Gaps ───────────────────────────────────────────────

  const addGap = useCallback(
    (gap: ResearchGap) => {
      mapService.addGap(gap);
      refresh();
    },
    [refresh],
  );

  const deleteGap = useCallback(
    (id: string) => {
      mapService.deleteGap(id);
      refresh();
    },
    [refresh],
  );

  const addGapToBridge = useCallback(
    (gapId: string, bridgeId: string) => {
      const map = mapService.getFullMap();
      const bridge = map.bridges.find((b) => b.id === bridgeId);
      if (bridge && !bridge.gapIds.includes(gapId)) {
        bridge.gapIds.push(gapId);
        mapService.updateBridge(bridge);
        refresh();
      }
    },
    [refresh],
  );

  const addGapToRoad = useCallback(
    (gapId: string, roadId: string) => {
      const map = mapService.getFullMap();
      const road = map.roads.find((r) => r.id === roadId);
      if (road && !road.gapIds.includes(gapId)) {
        road.gapIds.push(gapId);
        mapService.updateRoad(road);
        refresh();
      }
    },
    [refresh],
  );

  // ─── Persistence ────────────────────────────────────────

  const importMap = useCallback(
    (map: ResearchMap) => {
      mapService.importMap(map);
      refresh();
    },
    [refresh],
  );

  const saveToGitHub = useCallback(async () => {
    const config = githubService.getGitHubConfig();
    if (!config) throw new Error('GitHub 설정이 없습니다.');
    try {
      await githubService.saveToGitHub(config, mapData, effectiveMapId ?? undefined);
    } catch (e) {
      if (e instanceof ConflictError) {
        const force = confirm(
          '다른 기기에서 변경된 데이터가 있습니다.\n\n' +
          '• 확인 → 현재 내 데이터로 덮어쓰기\n' +
          '• 취소 → 저장 중단 (Load로 최신 데이터를 먼저 가져오세요)',
        );
        if (force) {
          await githubService.saveToGitHub(config, mapData, effectiveMapId ?? undefined, true);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }, [mapData, effectiveMapId]);

  const loadFromGitHub = useCallback(async () => {
    const config = githubService.getGitHubConfig();
    if (!config) throw new Error('GitHub 설정이 없습니다.');
    const map = await githubService.loadFromGitHub(config, effectiveMapId ?? undefined);
    mapService.importMap(map);
    refresh();
  }, [refresh, effectiveMapId]);

  // Auto-save to GitHub (5s debounce after any data mutation)
  const flushSave = useCallback(async () => {
    if (!effectiveMapId) return;
    const config = githubService.getGitHubConfig();
    if (!config) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      const data = mapService.getFullMap();
      await githubService.saveToGitHub(config, data, effectiveMapId);
      setLastSyncError(null);
    } catch (e) {
      if (e instanceof ConflictError) {
        // Don't overwrite — alert user to load first
        setLastSyncError(e.message);
      } else {
        setLastSyncError((e as Error).message);
      }
    }
  }, [effectiveMapId]);

  const scheduleAutoSave = useCallback(() => {
    if (!effectiveMapId) return;
    const config = githubService.getGitHubConfig();
    if (!config) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      flushSave();
    }, 5_000);
  }, [effectiveMapId, flushSave]);

  // Trigger auto-save when mapData changes (skip initial load)
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    dataVersionRef.current++;
    scheduleAutoSave();
  }, [mapData, scheduleAutoSave]);

  // Sync when tab visibility changes:
  //   hidden  → flush save to GitHub
  //   visible → reload from GitHub to pick up changes from other devices
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSave();
      } else if (document.visibilityState === 'visible') {
        // Re-fetch from GitHub when returning to this tab
        if (!effectiveMapId) return;
        const config = githubService.getGitHubConfig();
        if (!config) return;
        setSyncing(true);
        githubService.loadFromGitHub(config, effectiveMapId)
          .then((map) => {
            mapService.importMap(map);
            refresh();
            setLastSyncError(null);
          })
          .catch((e) => {
            if (!(e as Error).message.includes('404')) {
              setLastSyncError((e as Error).message);
            }
          })
          .finally(() => setSyncing(false));
      }
    };
    const handleBeforeUnload = () => {
      if (!effectiveMapId) return;
      // Save to localStorage as fallback so data isn't lost
      const data = mapService.getFullMap();
      localStorage.setItem(`pending-save-${effectiveMapId}`, JSON.stringify(data));
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Flush pending auto-save on unmount (navigating away)
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (effectiveMapId) {
        const config = githubService.getGitHubConfig();
        if (config) {
          const data = mapService.getFullMap();
          githubService.saveToGitHub(config, data, effectiveMapId).catch(() => {});
        }
      }
    };
  }, [effectiveMapId, flushSave]);

  // ─── Undo / Redo ────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (mapService.undo()) refresh();
  }, [refresh]);

  const handleRedo = useCallback(() => {
    if (mapService.redo()) refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  return useMemo(
    () => ({
      mapData,
      syncing,
      lastSyncError,
      refresh,
      undo: handleUndo,
      redo: handleRedo,
      addIsland,
      updateIsland,
      saveIslandPosition,
      deleteIsland,
      addCity,
      updateCity,
      saveCityPosition,
      deleteCity,
      addBridge,
      updateBridge,
      deleteBridge,
      addRoad,
      updateRoad,
      deleteRoad,
      addPaper,
      updatePaper,
      deletePaper,
      addPaperToBridge,
      addPaperToRoad,
      removePaperFromBridge,
      removePaperFromRoad,
      addGap,
      deleteGap,
      addGapToBridge,
      addGapToRoad,
      importMap,
      saveToGitHub,
      loadFromGitHub,
    }),
    [
      mapData, syncing, lastSyncError, refresh, handleUndo, handleRedo,
      addIsland, updateIsland, saveIslandPosition, deleteIsland,
      addCity, updateCity, saveCityPosition, deleteCity,
      addBridge, updateBridge, deleteBridge,
      addRoad, updateRoad, deleteRoad,
      addPaper, updatePaper, deletePaper, addPaperToBridge, addPaperToRoad,
      removePaperFromBridge, removePaperFromRoad,
      addGap, deleteGap, addGapToBridge, addGapToRoad,
      importMap, saveToGitHub, loadFromGitHub,
    ],
  );
}

export type MapDataActions = ReturnType<typeof useMapData>;
