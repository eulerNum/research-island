import { useState, useCallback, useMemo } from 'react';
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
import { generateId } from '../utils/idGenerator';

export function useMapData() {
  const [mapData, setMapData] = useState<ResearchMap>(mapService.getFullMap);

  const refresh = useCallback(() => {
    setMapData(mapService.getFullMap());
  }, []);

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
    await githubService.saveToGitHub(config, mapData);
  }, [mapData]);

  const loadFromGitHub = useCallback(async () => {
    const config = githubService.getGitHubConfig();
    if (!config) throw new Error('GitHub 설정이 없습니다.');
    const map = await githubService.loadFromGitHub(config);
    mapService.importMap(map);
    refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      mapData,
      refresh,
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
      addGap,
      deleteGap,
      addGapToBridge,
      addGapToRoad,
      importMap,
      saveToGitHub,
      loadFromGitHub,
    }),
    [
      mapData, refresh, addIsland, updateIsland, saveIslandPosition, deleteIsland,
      addCity, updateCity, saveCityPosition, deleteCity,
      addBridge, updateBridge, deleteBridge,
      addRoad, updateRoad, deleteRoad,
      addPaper, updatePaper, deletePaper, addPaperToBridge, addPaperToRoad,
      addGap, deleteGap, addGapToBridge, addGapToRoad,
      importMap, saveToGitHub, loadFromGitHub,
    ],
  );
}

export type MapDataActions = ReturnType<typeof useMapData>;
