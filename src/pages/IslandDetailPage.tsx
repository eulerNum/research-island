import { useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useMapDataContext } from '../contexts/MapDataContext';
import { useToolbar } from '../hooks/useToolbar';
import Toolbar from '../components/Toolbar';
import CityMap from '../components/CityMap';
import DetailPanel from '../components/DetailPanel';
import PromptDialog from '../components/PromptDialog';
import ContextMenu from '../components/ContextMenu';
import type { ContextMenuItem, ContextMenuPaletteItem } from '../components/ContextMenu';
import type { CityMapContextMenuEvent } from '../components/CityMap';
import type { ToolbarMode } from '../hooks/useToolbar';

const DETAIL_MODES: ToolbarMode[] = ['select', 'add-city', 'road-connect'];

export default function IslandDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const ctx = useMapDataContext();
  const toolbar = useToolbar();
  const mapSvgRef = useRef<SVGSVGElement>(null);

  // Read road param once from URL, then clear
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(() => {
    const param = searchParams.get('road');
    if (param) {
      queueMicrotask(() => setSearchParams({}, { replace: true }));
    }
    return param;
  });
  const [highlightedPaperId, setHighlightedPaperId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [promptDialog, setPromptDialog] = useState<{
    title: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
  } | null>(null);

  const island = ctx.mapData.islands.find((i) => i.id === id);

  const islandRoads = useMemo(() => {
    if (!island) return [];
    const cityIds = new Set(island.cities.map((c) => c.id));
    return ctx.mapData.roads.filter(
      (r) => cityIds.has(r.sourceCityId) || cityIds.has(r.targetCityId),
    );
  }, [island, ctx.mapData.roads]);

  const handleCityClick = useCallback(
    (cityId: string) => {
      if (toolbar.mode === 'road-connect') {
        if (!toolbar.connectionStart) {
          toolbar.setConnectionStart(cityId);
        } else {
          const sourceId = toolbar.connectionStart;
          if (sourceId !== cityId) {
            const sourceName = island?.cities.find((c) => c.id === sourceId)?.name ?? '';
            const targetName = island?.cities.find((c) => c.id === cityId)?.name ?? '';
            setPromptDialog({
              title: `도로 이름: ${sourceName} → ${targetName}`,
              defaultValue: '',
              onConfirm: (label: string) => {
                ctx.addRoad(sourceId, cityId, 'forward', label);
                setPromptDialog(null);
              },
            });
          }
          toolbar.resetConnection();
        }
      }
    },
    [toolbar, ctx, island?.cities],
  );

  const handleRoadClick = useCallback((roadId: string) => {
    setSelectedRoadId(roadId);
  }, []);

  const handleCanvasClick = useCallback(
    (position: { x: number; y: number }) => {
      if (toolbar.mode === 'add-city' && id) {
        setPromptDialog({
          title: '새 도시 이름',
          onConfirm: (name: string) => {
            ctx.addCity(id, name, position);
            setPromptDialog(null);
            toolbar.setMode('select');
          },
        });
      }
    },
    [toolbar, ctx, id],
  );

  const handleCityDragEnd = useCallback(
    (cityId: string, position: { x: number; y: number }) => {
      if (!id) return;
      ctx.saveCityPosition(id, cityId, position);
    },
    [id, ctx],
  );

  // cityId → islandId lookup
  const cityIslandMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const isl of ctx.mapData.islands) {
      for (const city of isl.cities) {
        map.set(city.id, isl.id);
      }
    }
    return map;
  }, [ctx.mapData.islands]);

  const islandNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of ctx.mapData.islands) m.set(i.id, i.name);
    return m;
  }, [ctx.mapData.islands]);

  const cityNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of ctx.mapData.islands) {
      for (const c of i.cities) m.set(c.id, c.name);
    }
    return m;
  }, [ctx.mapData.islands]);

  const handleNavigateToBridge = useCallback((bridgeId: string) => {
    navigate(`../?bridge=${bridgeId}`);
  }, [navigate]);

  const handleNavigateToRoad = useCallback((roadId: string, islandId: string) => {
    if (islandId === id) {
      setSelectedRoadId(roadId);
      setHighlightedPaperId(null);
    } else {
      navigate(`../island/${islandId}?road=${roadId}`);
    }
  }, [id, navigate]);

  const handleContextMenu = useCallback((event: CityMapContextMenuEvent) => {
    const items: ContextMenuItem[] = [];
    if (event.type === 'city') {
      const city = island?.cities.find((c) => c.id === event.id);
      if (!city || !id) return;
      items.push({
        label: `이름 변경: ${city.name}`,
        onClick: () => {
          setPromptDialog({
            title: '도시 이름 변경',
            defaultValue: city.name,
            onConfirm: (name: string) => {
              ctx.updateCity(id, { ...city, name });
              setPromptDialog(null);
            },
          });
        },
      });
      items.push({
        label: '삭제',
        color: '#dc3545',
        onClick: () => {
          if (confirm(`"${city.name}" 도시와 관련 도로가 모두 삭제됩니다. 계속할까요?`)) {
            ctx.deleteCity(id, city.id);
            setSelectedRoadId(null);
          }
        },
      });
    } else if (event.type === 'road') {
      const road = ctx.mapData.roads.find((r) => r.id === event.id);
      if (!road) return;
      items.push({
        label: `라벨 변경: ${road.label ?? '(없음)'}`,
        onClick: () => {
          setPromptDialog({
            title: '도로 라벨 변경',
            defaultValue: road.label ?? '',
            onConfirm: (label: string) => {
              ctx.updateRoad({ ...road, label });
              setPromptDialog(null);
            },
          });
        },
      });
      items.push({
        type: 'palette',
        label: '도로 색상',
        colors: ['#2a9d8f', '#e76f51', '#457b9d', '#e9c46a', '#f4a261', '#264653', '#a855f7', '#ef4444', '#06b6d4', '#84cc16'],
        currentColor: road.color,
        onSelect: (color: string) => {
          ctx.updateRoad({ ...road, color });
        },
      } satisfies ContextMenuPaletteItem);
      items.push({
        label: `방향 전환 → ${road.direction === 'forward' ? 'backward' : 'forward'}`,
        color: road.direction === 'forward' ? '#e76f51' : '#2a9d8f',
        onClick: () => {
          ctx.updateRoad({
            ...road,
            direction: road.direction === 'forward' ? 'backward' : 'forward',
          });
        },
      });
      items.push({
        label: '삭제',
        color: '#dc3545',
        onClick: () => {
          if (confirm(`이 도로를 삭제할까요?`)) {
            ctx.deleteRoad(road.id);
            if (selectedRoadId === road.id) setSelectedRoadId(null);
          }
        },
      });
    }
    setContextMenu({ x: event.screenX, y: event.screenY, items });
  }, [ctx, island?.cities, id, selectedRoadId]);

  if (!island) return <Navigate to=".." replace />;

  const selectedRoad = selectedRoadId
    ? ctx.mapData.roads.find((r) => r.id === selectedRoadId)
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        mode={toolbar.mode}
        onModeChange={toolbar.setMode}
        availableModes={DETAIL_MODES}
        connectionStart={toolbar.connectionStart}
        svgRef={mapSvgRef}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            onClick={() => navigate('..')}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 10,
              padding: '6px 14px',
              border: '1px solid var(--btn-secondary-border)',
              borderRadius: 6,
              background: 'var(--bg-primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            &larr; 조망도로 돌아가기
          </button>
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              padding: '6px 16px',
              background: island.color ?? '#8ecae6',
              borderRadius: 8,
              fontWeight: 'bold',
              fontSize: '1rem',
              color: 'var(--text-heading)',
            }}
          >
            {island.name}
          </div>
          <CityMap
            ref={mapSvgRef}
            island={island}
            roads={islandRoads}
            mode={toolbar.mode}
            connectionStart={toolbar.connectionStart}
            highlightedPaperId={highlightedPaperId}
            onCityClick={handleCityClick}
            onRoadClick={handleRoadClick}
            onCanvasClick={handleCanvasClick}
            onCityDragEnd={handleCityDragEnd}
            onContextMenu={handleContextMenu}
            onPaperDropOnRoad={(paperId, roadId) => ctx.addPaperToRoad(paperId, roadId)}
          />
        </div>
        {selectedRoad && (
          <DetailPanel
            road={selectedRoad}
            papers={ctx.mapData.papers}
            gaps={ctx.mapData.gaps}
            allBridges={ctx.mapData.bridges}
            allRoads={ctx.mapData.roads}
            allIslandCityMap={cityIslandMap}
            islandNameMap={islandNameMap}
            cityNameMap={cityNameMap}
            highlightedPaperId={highlightedPaperId}
            sourceLabel={island.cities.find((c) => c.id === selectedRoad.sourceCityId)?.name}
            targetLabel={island.cities.find((c) => c.id === selectedRoad.targetCityId)?.name}
            onAddPaper={(paper) => {
              const actualId = ctx.addPaper(paper);
              ctx.addPaperToRoad(actualId, selectedRoad.id);
            }}
            onAddPaperWithId={(paper) => ctx.addPaper(paper)}
            onUpdatePaper={ctx.updatePaper}
            onRemovePaper={(paperId) => ctx.removePaperFromRoad(paperId, selectedRoad.id)}
            onDeletePaper={ctx.deletePaper}
            onAddGap={(gap) => {
              ctx.addGap(gap);
              ctx.addGapToRoad(gap.id, selectedRoad.id);
            }}
            onDeleteGap={ctx.deleteGap}
            onHighlightPaper={setHighlightedPaperId}
            onNavigateToBridge={handleNavigateToBridge}
            onNavigateToRoad={handleNavigateToRoad}
            onAddPaperToBridge={(paperId, bridgeId) => ctx.addPaperToBridge(paperId, bridgeId)}
            onAddPaperToRoad={(paperId, roadId) => ctx.addPaperToRoad(paperId, roadId)}
            onClose={() => { setSelectedRoadId(null); setHighlightedPaperId(null); }}
          />
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
      {promptDialog && (
        <PromptDialog
          title={promptDialog.title}
          defaultValue={promptDialog.defaultValue}
          onConfirm={promptDialog.onConfirm}
          onCancel={() => setPromptDialog(null)}
        />
      )}
    </div>
  );
}
