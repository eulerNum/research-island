import { useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useMapDataContext } from '../contexts/MapDataContext';
import { useToolbar } from '../hooks/useToolbar';
import Toolbar from '../components/Toolbar';
import CityMap from '../components/CityMap';
import DetailPanel from '../components/DetailPanel';
import PromptDialog from '../components/PromptDialog';
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
              title: '도로 이름 (Road label)',
              defaultValue: `${sourceName} → ${targetName}: `,
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

  const handleNavigateToBridge = useCallback((bridgeId: string) => {
    navigate(`/?bridge=${bridgeId}`);
  }, [navigate]);

  const handleNavigateToRoad = useCallback((roadId: string, islandId: string) => {
    if (islandId === id) {
      setSelectedRoadId(roadId);
      setHighlightedPaperId(null);
    } else {
      navigate(`/island/${islandId}?road=${roadId}`);
    }
  }, [id, navigate]);

  if (!island) return <Navigate to="/" replace />;

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
            onClick={() => navigate('/')}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 10,
              padding: '6px 14px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#fff',
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
              color: '#023047',
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
            highlightedPaperId={highlightedPaperId}
            onAddPaper={(paper) => {
              const actualId = ctx.addPaper(paper);
              ctx.addPaperToRoad(actualId, selectedRoad.id);
            }}
            onUpdatePaper={ctx.updatePaper}
            onAddGap={(gap) => {
              ctx.addGap(gap);
              ctx.addGapToRoad(gap.id, selectedRoad.id);
            }}
            onDeleteGap={ctx.deleteGap}
            onHighlightPaper={setHighlightedPaperId}
            onNavigateToBridge={handleNavigateToBridge}
            onNavigateToRoad={handleNavigateToRoad}
            onClose={() => { setSelectedRoadId(null); setHighlightedPaperId(null); }}
          />
        )}
      </div>
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
