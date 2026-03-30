import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMapDataContext } from '../contexts/MapDataContext';
import { useToolbar } from '../hooks/useToolbar';
import Toolbar from '../components/Toolbar';
import Sidebar from '../components/Sidebar';
import IslandMap from '../components/IslandMap';
import DetailPanel from '../components/DetailPanel';
import PromptDialog from '../components/PromptDialog';
import type { ToolbarMode } from '../hooks/useToolbar';

const ISLAND_COLORS = ['#8ecae6', '#a8dadc', '#b5e48c', '#ffd166', '#e8c1a0', '#d4a5a5'];

const OVERVIEW_MODES: ToolbarMode[] = [
  'select',
  'add-island',
  'bridge-connect',
];

export default function OverviewPage() {
  const ctx = useMapDataContext();
  const toolbar = useToolbar();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mapSvgRef = useRef<SVGSVGElement>(null);

  // Read bridge param once from URL, then clear
  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(() => {
    const param = searchParams.get('bridge');
    if (param) {
      // defer clearing to avoid calling setSearchParams during render
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

  const handleIslandClick = useCallback(
    (islandId: string) => {
      if (toolbar.mode === 'bridge-connect') {
        if (!toolbar.connectionStart) {
          toolbar.setConnectionStart(islandId);
        } else {
          const sourceId = toolbar.connectionStart;
          if (sourceId !== islandId) {
            const sourceName = ctx.mapData.islands.find((i) => i.id === sourceId)?.name ?? '';
            const targetName = ctx.mapData.islands.find((i) => i.id === islandId)?.name ?? '';
            setPromptDialog({
              title: '다리 이름 (Bridge label)',
              defaultValue: `${sourceName} → ${targetName}: `,
              onConfirm: (label: string) => {
                ctx.addBridge(sourceId, islandId, 'forward', label);
                setPromptDialog(null);
              },
            });
          }
          toolbar.resetConnection();
        }
      } else {
        navigate(`/island/${islandId}`);
      }
    },
    [toolbar, ctx, navigate],
  );

  const handleBridgeClick = useCallback((bridgeId: string) => {
    setSelectedBridgeId(bridgeId);
  }, []);

  const handleCanvasClick = useCallback(
    (position: { x: number; y: number }) => {
      if (toolbar.mode === 'add-island') {
        setPromptDialog({
          title: '새 섬 이름',
          onConfirm: (name: string) => {
            const colorIdx = ctx.mapData.islands.length % ISLAND_COLORS.length;
            ctx.addIsland(name, position, ISLAND_COLORS[colorIdx]);
            setPromptDialog(null);
            toolbar.setMode('select');
          },
        });
      }
    },
    [toolbar, ctx],
  );

  const handleIslandDragEnd = useCallback(
    (islandId: string, position: { x: number; y: number }) => {
      ctx.saveIslandPosition(islandId, position);
    },
    [ctx],
  );

  // cityId → islandId lookup for cross-ref navigation
  const cityIslandMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const island of ctx.mapData.islands) {
      for (const city of island.cities) {
        map.set(city.id, island.id);
      }
    }
    return map;
  }, [ctx.mapData.islands]);

  const handleNavigateToBridge = useCallback((bridgeId: string) => {
    setSelectedBridgeId(bridgeId);
    setHighlightedPaperId(null);
  }, []);

  const handleNavigateToRoad = useCallback((roadId: string, islandId: string) => {
    navigate(`/island/${islandId}?road=${roadId}`);
  }, [navigate]);

  const selectedBridge = selectedBridgeId
    ? ctx.mapData.bridges.find((b) => b.id === selectedBridgeId)
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        mode={toolbar.mode}
        onModeChange={toolbar.setMode}
        availableModes={OVERVIEW_MODES}
        connectionStart={toolbar.connectionStart}
        svgRef={mapSvgRef}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar data={ctx.mapData} />
        <main style={{ flex: 1, position: 'relative' }}>
          <IslandMap
            ref={mapSvgRef}
            data={ctx.mapData}
            mode={toolbar.mode}
            connectionStart={toolbar.connectionStart}
            highlightedPaperId={highlightedPaperId}
            onIslandClick={handleIslandClick}
            onBridgeClick={handleBridgeClick}
            onCanvasClick={handleCanvasClick}
            onIslandDragEnd={handleIslandDragEnd}
          />
        </main>
        {selectedBridge && (
          <DetailPanel
            bridge={selectedBridge}
            papers={ctx.mapData.papers}
            gaps={ctx.mapData.gaps}
            allBridges={ctx.mapData.bridges}
            allRoads={ctx.mapData.roads}
            allIslandCityMap={cityIslandMap}
            highlightedPaperId={highlightedPaperId}
            onAddPaper={(paper) => {
              const actualId = ctx.addPaper(paper);
              ctx.addPaperToBridge(actualId, selectedBridge.id);
            }}
            onUpdatePaper={ctx.updatePaper}
            onAddGap={(gap) => {
              ctx.addGap(gap);
              ctx.addGapToBridge(gap.id, selectedBridge.id);
            }}
            onDeleteGap={ctx.deleteGap}
            onHighlightPaper={setHighlightedPaperId}
            onNavigateToBridge={handleNavigateToBridge}
            onNavigateToRoad={handleNavigateToRoad}
            onClose={() => { setSelectedBridgeId(null); setHighlightedPaperId(null); }}
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
