import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMapDataContext } from '../contexts/MapDataContext';
import { useToolbar } from '../hooks/useToolbar';
import Toolbar from '../components/Toolbar';
import Sidebar from '../components/Sidebar';
import IslandMap from '../components/IslandMap';
import DetailPanel from '../components/DetailPanel';
import AIChatPanel from '../components/AIChatPanel';
import PromptDialog from '../components/PromptDialog';
import ContextMenu from '../components/ContextMenu';
import type { ContextMenuItem, ContextMenuPaletteItem } from '../components/ContextMenu';
import type { MapContextMenuEvent } from '../components/IslandMap';
import type { ToolbarMode } from '../hooks/useToolbar';
import GapPostitAnimation from '../components/GapPostitAnimation';
import PaperStudyPanel from '../components/PaperStudyPanel';

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
  const [studyPaperId, setStudyPaperId] = useState<string | null>(null);
  const [expandedIslandId, setExpandedIslandId] = useState<string | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [gapPostit, setGapPostit] = useState<{
    gapId: string;
    description: string;
    startRect: DOMRect;
    endRect: { x: number; y: number } | null;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
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
              title: `다리 이름: ${sourceName} → ${targetName}`,
              defaultValue: '',
              onConfirm: (label: string) => {
                ctx.addBridge(sourceId, islandId, 'forward', label);
                setPromptDialog(null);
              },
            });
          }
          toolbar.resetConnection();
        }
      } else {
        // Toggle island expand (show cities in overview)
        setExpandedIslandId((prev) => prev === islandId ? null : islandId);
      }
    },
    [toolbar, ctx],
  );

  const handleIslandDoubleClick = useCallback((islandId: string) => {
    navigate(`island/${islandId}`);
  }, [navigate]);

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

  // Name lookup maps for cross-ref display
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

  const handleSelectPaper = useCallback((paperId: string) => {
    // Open Paper Study Panel (keeps DetailPanel open for 3-panel view)
    setStudyPaperId(paperId);
    setHighlightedPaperId(paperId);
  }, []);

  const handleGapAnimate = useCallback((gapId: string, description: string, sourceRect: DOMRect) => {
    // Find the bridge that contains this gap
    const bridge = ctx.mapData.bridges.find((b) => b.gapIds.includes(gapId));
    let endRect: { x: number; y: number } | null = null;

    if (bridge && mapSvgRef.current) {
      // Get bridge midpoint from SVG
      const svgRect = mapSvgRef.current.getBoundingClientRect();
      // Try to find the specific bridge path
      const allGroups = mapSvgRef.current.querySelectorAll('.bridge-group');
      const bridgeData = ctx.mapData.bridges;
      const bridgeIdx = bridgeData.findIndex((b) => b.id === bridge.id);
      if (bridgeIdx >= 0 && allGroups[bridgeIdx]) {
        const path = allGroups[bridgeIdx].querySelector('.bridge') as SVGPathElement | null;
        if (path) {
          const totalLen = path.getTotalLength();
          const midPoint = path.getPointAtLength(totalLen / 2);
          // Convert SVG coordinates to screen coordinates
          const ctm = path.getScreenCTM();
          if (ctm) {
            endRect = {
              x: midPoint.x * ctm.a + ctm.e,
              y: midPoint.y * ctm.d + ctm.f,
            };
          }
        }
      }

      if (!endRect) {
        // Fallback: center of SVG
        endRect = { x: svgRect.left + svgRect.width / 2, y: svgRect.top + svgRect.height / 2 };
      }
    }

    setGapPostit({ gapId, description, startRect: sourceRect, endRect });
  }, [ctx.mapData.bridges]);

  const handleNavigateToBridge = useCallback((bridgeId: string) => {
    setSelectedBridgeId(bridgeId);
    setHighlightedPaperId(null);
  }, []);

  const handleNavigateToRoad = useCallback((roadId: string, islandId: string) => {
    navigate(`island/${islandId}?road=${roadId}`);
  }, [navigate]);

  const handleContextMenu = useCallback((event: MapContextMenuEvent) => {
    const items: ContextMenuItem[] = [];
    if (event.type === 'island') {
      const island = ctx.mapData.islands.find((i) => i.id === event.id);
      if (!island) return;
      items.push({
        label: `이름 변경: ${island.name}`,
        onClick: () => {
          setPromptDialog({
            title: '섬 이름 변경',
            defaultValue: island.name,
            onConfirm: (name: string) => {
              ctx.updateIsland({ ...island, name });
              setPromptDialog(null);
            },
          });
        },
      });
      items.push({
        type: 'palette',
        label: '섬 색상',
        colors: ['#8ecae6', '#a8dadc', '#b5e48c', '#ffd166', '#e8c1a0', '#d4a5a5', '#c9b1ff', '#ffb3b3', '#90e0ef', '#dda15e'],
        currentColor: island.color,
        onSelect: (color: string) => {
          ctx.updateIsland({ ...island, color });
        },
      } satisfies ContextMenuPaletteItem);
      items.push({
        label: '삭제',
        color: '#dc3545',
        onClick: () => {
          const cityCount = island.cities.length;
          const msg = cityCount > 0
            ? `"${island.name}" 섬과 도시 ${cityCount}개, 관련 다리/도로가 모두 삭제됩니다. 계속할까요?`
            : `"${island.name}" 섬을 삭제할까요?`;
          if (confirm(msg)) {
            ctx.deleteIsland(island.id);
            setSelectedBridgeId(null);
          }
        },
      });
    } else if (event.type === 'bridge') {
      const bridge = ctx.mapData.bridges.find((b) => b.id === event.id);
      if (!bridge) return;
      items.push({
        label: `라벨 변경: ${bridge.label ?? '(없음)'}`,
        onClick: () => {
          setPromptDialog({
            title: '다리 라벨 변경',
            defaultValue: bridge.label ?? '',
            onConfirm: (label: string) => {
              ctx.updateBridge({ ...bridge, label });
              setPromptDialog(null);
            },
          });
        },
      });
      items.push({
        type: 'palette',
        label: '다리 색상',
        colors: ['#2a9d8f', '#e76f51', '#457b9d', '#e9c46a', '#f4a261', '#264653', '#a855f7', '#ef4444', '#06b6d4', '#84cc16'],
        currentColor: bridge.color,
        onSelect: (color: string) => {
          ctx.updateBridge({ ...bridge, color });
        },
      } satisfies ContextMenuPaletteItem);
      items.push({
        label: `방향 전환 → ${bridge.direction === 'forward' ? 'backward' : 'forward'}`,
        color: bridge.direction === 'forward' ? '#e76f51' : '#2a9d8f',
        onClick: () => {
          ctx.updateBridge({
            ...bridge,
            direction: bridge.direction === 'forward' ? 'backward' : 'forward',
          });
        },
      });
      items.push({
        label: '삭제',
        color: '#dc3545',
        onClick: () => {
          if (confirm(`이 다리를 삭제할까요?`)) {
            ctx.deleteBridge(bridge.id);
            if (selectedBridgeId === bridge.id) setSelectedBridgeId(null);
          }
        },
      });
    }
    setContextMenu({ x: event.screenX, y: event.screenY, items });
  }, [ctx, selectedBridgeId]);

  const selectedBridge = selectedBridgeId
    ? ctx.mapData.bridges.find((b) => b.id === selectedBridgeId)
    : undefined;

  // AI Chat helper data
  const selectedBridgeDisplayName = useMemo(() => {
    if (!selectedBridge) return '';
    const src = islandNameMap.get(selectedBridge.sourceIslandId) ?? '?';
    const tgt = islandNameMap.get(selectedBridge.targetIslandId) ?? '?';
    return selectedBridge.label ? `${src}\u2192${tgt}: ${selectedBridge.label}` : `${src}\u2192${tgt}`;
  }, [selectedBridge, islandNameMap]);

  const chatBridgeList = useMemo(() =>
    ctx.mapData.bridges.map((b) => ({
      id: b.id,
      sourceLabel: islandNameMap.get(b.sourceIslandId) ?? '?',
      targetLabel: islandNameMap.get(b.targetIslandId) ?? '?',
      label: b.label ?? '',
    })),
  [ctx.mapData.bridges, islandNameMap]);

  const chatRoadList = useMemo(() =>
    ctx.mapData.roads.map((r) => ({
      id: r.id,
      sourceLabel: cityNameMap.get(r.sourceCityId) ?? '?',
      targetLabel: cityNameMap.get(r.targetCityId) ?? '?',
      label: r.label ?? '',
    })),
  [ctx.mapData.roads, cityNameMap]);

  const selectedBridgePapers = useMemo(() =>
    selectedBridge ? ctx.mapData.papers.filter((p) => selectedBridge.paperIds.includes(p.id)) : [],
  [selectedBridge, ctx.mapData.papers]);

  const selectedBridgeGaps = useMemo(() =>
    selectedBridge ? ctx.mapData.gaps.filter((g) => selectedBridge.gapIds.includes(g.id)) : [],
  [selectedBridge, ctx.mapData.gaps]);

  const studyPaper = studyPaperId
    ? ctx.mapData.papers.find((p) => p.id === studyPaperId)
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
        <Sidebar data={ctx.mapData} highlightedPaperId={highlightedPaperId} onHighlightPaper={setHighlightedPaperId} onSelectPaper={handleSelectPaper} onGapAnimate={handleGapAnimate} />
        <main style={{ flex: 1, minWidth: 300, position: 'relative' }}>
          <IslandMap
            ref={mapSvgRef}
            data={ctx.mapData}
            mode={toolbar.mode}
            connectionStart={toolbar.connectionStart}
            highlightedPaperId={highlightedPaperId}
            expandedIslandId={expandedIslandId}
            onIslandClick={handleIslandClick}
            onIslandDoubleClick={handleIslandDoubleClick}
            onBridgeClick={handleBridgeClick}
            onCanvasClick={handleCanvasClick}
            onIslandDragEnd={handleIslandDragEnd}
            onContextMenu={handleContextMenu}
            onPaperDropOnBridge={(paperId, bridgeId) => ctx.addPaperToBridge(paperId, bridgeId)}
          />
        </main>
        {selectedBridge && aiChatOpen && (
          <AIChatPanel
            entity={selectedBridge}
            entityType="bridge"
            entityDisplayName={selectedBridgeDisplayName}
            sourceLabel={islandNameMap.get(selectedBridge.sourceIslandId) ?? 'Source'}
            targetLabel={islandNameMap.get(selectedBridge.targetIslandId) ?? 'Target'}
            existingPapers={selectedBridgePapers}
            gaps={selectedBridgeGaps}
            allBridges={chatBridgeList}
            allRoads={chatRoadList}
            onAddPaper={(paper) => ctx.addPaper(paper)}
            onAddPaperToBridge={(paperId, bridgeId) => ctx.addPaperToBridge(paperId, bridgeId)}
            onAddPaperToRoad={(paperId, roadId) => ctx.addPaperToRoad(paperId, roadId)}
            onUpdatePaper={ctx.updatePaper}
            onShowClaudeSettings={() => {}}
            onClose={() => setAiChatOpen(false)}
          />
        )}
        {selectedBridge && (
          <DetailPanel
            bridge={selectedBridge}
            papers={ctx.mapData.papers}
            gaps={ctx.mapData.gaps}
            allBridges={ctx.mapData.bridges}
            allRoads={ctx.mapData.roads}
            allIslandCityMap={cityIslandMap}
            islandNameMap={islandNameMap}
            cityNameMap={cityNameMap}
            highlightedPaperId={highlightedPaperId}
            sourceLabel={islandNameMap.get(selectedBridge.sourceIslandId)}
            targetLabel={islandNameMap.get(selectedBridge.targetIslandId)}
            onAddPaper={(paper) => {
              const actualId = ctx.addPaper(paper);
              ctx.addPaperToBridge(actualId, selectedBridge.id);
            }}
            onAddPaperWithId={(paper) => ctx.addPaper(paper)}
            onUpdatePaper={ctx.updatePaper}
            onRemovePaper={(paperId) => ctx.removePaperFromBridge(paperId, selectedBridge.id)}
            onDeletePaper={ctx.deletePaper}
            onAddGap={(gap) => {
              ctx.addGap(gap);
              ctx.addGapToBridge(gap.id, selectedBridge.id);
            }}
            onDeleteGap={ctx.deleteGap}
            onHighlightPaper={setHighlightedPaperId}
            onNavigateToBridge={handleNavigateToBridge}
            onNavigateToRoad={handleNavigateToRoad}
            onAddPaperToBridge={(paperId, bridgeId) => ctx.addPaperToBridge(paperId, bridgeId)}
            onAddPaperToRoad={(paperId, roadId) => ctx.addPaperToRoad(paperId, roadId)}
            onClose={() => { setSelectedBridgeId(null); setHighlightedPaperId(null); setAiChatOpen(false); }}
            aiChatOpen={aiChatOpen}
            onToggleAIChat={() => setAiChatOpen((v) => !v)}
            onStudyPaper={(paperId) => { setStudyPaperId(paperId); setHighlightedPaperId(paperId); }}
          />
        )}
        {studyPaper && (
          <PaperStudyPanel
            paper={studyPaper}
            allBridges={ctx.mapData.bridges}
            allRoads={ctx.mapData.roads}
            islandNameMap={islandNameMap}
            cityNameMap={cityNameMap}
            allIslandCityMap={cityIslandMap}
            onUpdatePaper={ctx.updatePaper}
            onNavigateToBridge={handleNavigateToBridge}
            onNavigateToRoad={handleNavigateToRoad}
            onClose={() => { setStudyPaperId(null); setHighlightedPaperId(null); }}
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
      {gapPostit && (
        <GapPostitAnimation
          gapId={gapPostit.gapId}
          description={gapPostit.description}
          startRect={gapPostit.startRect}
          endRect={gapPostit.endRect}
          onDismiss={() => setGapPostit(null)}
        />
      )}
    </div>
  );
}
