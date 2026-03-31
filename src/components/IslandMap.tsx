import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import type { ResearchMap, Island, Bridge } from '../services/types';
import type { ToolbarMode } from '../hooks/useToolbar';
import * as mapService from '../services/mapService';

export interface MapContextMenuEvent {
  type: 'island' | 'bridge';
  id: string;
  screenX: number;
  screenY: number;
}

interface IslandMapProps {
  data: ResearchMap;
  mode: ToolbarMode;
  connectionStart: string | null;
  highlightedPaperId?: string | null;
  onIslandClick: (islandId: string) => void;
  onBridgeClick: (bridgeId: string) => void;
  onCanvasClick: (position: { x: number; y: number }) => void;
  onIslandDragEnd: (islandId: string, position: { x: number; y: number }) => void;
  onContextMenu?: (event: MapContextMenuEvent) => void;
  onPaperDropOnBridge?: (paperId: string, bridgeId: string) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  island: Island;
}

const IslandMap = forwardRef<SVGSVGElement, IslandMapProps>(function IslandMap({
  data,
  mode,
  connectionStart,
  highlightedPaperId,
  onIslandClick,
  onBridgeClick,
  onCanvasClick,
  onIslandDragEnd,
  onContextMenu,
  onPaperDropOnBridge,
}, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  useImperativeHandle(ref, () => svgRef.current!, []);
  const simulationRef = useRef<d3.Simulation<SimNode, never> | null>(null);

  // Stable callback refs (updated in useEffect per React 19 rules)
  const modeRef = useRef(mode);
  const onIslandClickRef = useRef(onIslandClick);
  const onBridgeClickRef = useRef(onBridgeClick);
  const onCanvasClickRef = useRef(onCanvasClick);
  const onIslandDragEndRef = useRef(onIslandDragEnd);
  const connectionStartRef = useRef(connectionStart);
  const onContextMenuRef = useRef(onContextMenu);
  const onPaperDropOnBridgeRef = useRef(onPaperDropOnBridge);

  useEffect(() => {
    modeRef.current = mode;
    onIslandClickRef.current = onIslandClick;
    onBridgeClickRef.current = onBridgeClick;
    onCanvasClickRef.current = onCanvasClick;
    onIslandDragEndRef.current = onIslandDragEnd;
    connectionStartRef.current = connectionStart;
    onContextMenuRef.current = onContextMenu;
    onPaperDropOnBridgeRef.current = onPaperDropOnBridge;
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    svg.attr('width', width).attr('height', height);

    // Animated dash flow style
    const defs = svg.append('defs');
    const style = svg.append('style');
    style.text(`
      @keyframes dash-flow-forward {
        to { stroke-dashoffset: -24; }
      }
      @keyframes dash-flow-backward {
        to { stroke-dashoffset: 24; }
      }
      .bridge-forward {
        animation: dash-flow-forward 0.8s linear infinite;
      }
      .bridge-backward {
        animation: dash-flow-backward 0.8s linear infinite;
      }
    `);

    // Glow filter for paper highlight
    const glowFilter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glowFilter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '4').attr('result', 'blur');
    glowFilter.append('feFlood').attr('flood-color', '#ffd700').attr('flood-opacity', '0.7').attr('result', 'color');
    glowFilter.append('feComposite').attr('in', 'color').attr('in2', 'blur').attr('operator', 'in').attr('result', 'glow');
    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'glow');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrow markers
    ['forward', 'backward'].forEach((dir) => {
      defs
        .append('marker')
        .attr('id', `arrow-${dir}`)
        .attr('viewBox', '0 0 10 6')
        .attr('refX', 10)
        .attr('refY', 3)
        .attr('markerWidth', 10)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,0 L10,3 L0,6 Z')
        .attr('fill', dir === 'forward' ? '#2a9d8f' : '#e76f51');
    });

    const g = svg.append('g');

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);

    // Canvas click (for add-island mode)
    svg.on('click', (event: MouseEvent) => {
      if (modeRef.current !== 'add-island') return;
      if ((event.target as Element).tagName !== 'svg') return;
      const transform = d3.zoomTransform(svg.node()!);
      const [x, y] = transform.invert([event.offsetX, event.offsetY]);
      onCanvasClickRef.current({ x, y });
    });

    // Prepare nodes
    const nodes: SimNode[] = data.islands.map((island) => ({
      island,
      x: island.position.x || width / 2 + (Math.random() - 0.5) * 200,
      y: island.position.y || height / 2 + (Math.random() - 0.5) * 200,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.island.id, n]));

    const hasPositions = data.islands.every(
      (i) => i.position.x !== 0 || i.position.y !== 0,
    );

    // Compute per-bridge curve offset so parallel bridges between the same
    // island pair are visually separated.
    const pairKey = (a: string, b: string) => [a, b].sort().join('|');
    const pairCountMap = new Map<string, number>();
    const bridgeOffsets = new Map<string, number>();
    for (const b of data.bridges) {
      const key = pairKey(b.sourceIslandId, b.targetIslandId);
      const idx = pairCountMap.get(key) ?? 0;
      pairCountMap.set(key, idx + 1);
      bridgeOffsets.set(b.id, idx);
    }

    // Bridge groups: invisible wide hit area + visible styled path
    const bridgeGroups = g
      .selectAll<SVGGElement, (typeof data.bridges)[0]>('.bridge-group')
      .data(data.bridges)
      .enter()
      .append('g')
      .attr('class', 'bridge-group')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        _event.stopPropagation();
        onBridgeClickRef.current(d.id);
      })
      .on('contextmenu', (_event: MouseEvent, d) => {
        _event.preventDefault();
        _event.stopPropagation();
        onContextMenuRef.current?.({ type: 'bridge', id: d.id, screenX: _event.clientX, screenY: _event.clientY });
      });

    // Native DOM drag-over/drop for paper drag from sidebar
    bridgeGroups.each(function (d) {
      const el = this as SVGGElement;
      el.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes('application/paper-id')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          d3.select(el).select('.bridge').attr('stroke-width', 6).attr('filter', 'url(#glow)');
        }
      });
      el.addEventListener('dragleave', () => {
        d3.select(el).select('.bridge').attr('stroke-width', 3).attr('filter', null);
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const paperId = e.dataTransfer?.getData('application/paper-id');
        if (paperId) {
          onPaperDropOnBridgeRef.current?.(paperId, d.id);
        }
        d3.select(el).select('.bridge').attr('stroke-width', 3).attr('filter', null);
      });
    });

    // Invisible wide hit area for easy clicking
    const bridgeHitAreas = bridgeGroups
      .append('path')
      .attr('class', 'bridge-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16);

    // Visible bridge path with flowing dash animation
    const bridgeLines = bridgeGroups
      .append('path')
      .attr('class', (d) => `bridge bridge-${d.direction}`)
      .attr('fill', 'none')
      .attr('stroke', (d) => d.color ?? (d.direction === 'forward' ? '#2a9d8f' : '#e76f51'))
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '12,12')
      .attr('pointer-events', 'none');

    // Bridge labels
    const bridgeLabels = bridgeGroups
      .filter((d) => !!d.label)
      .append('text')
      .attr('class', 'bridge-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('fill', 'var(--text-secondary)')
      .attr('pointer-events', 'none')
      .text((d) => {
        const label = d.label ?? '';
        return label.length > 30 ? label.slice(0, 28) + '...' : label;
      });

    // Bridge paper count badge — validate against actual papers
    const paperIdSet = new Set(data.papers.map((p) => p.id));

    // Debug: log bridge paperIds to console for troubleshooting
    for (const b of data.bridges) {
      const valid = b.paperIds.filter((pid) => paperIdSet.has(pid));
      const orphaned = b.paperIds.filter((pid) => !paperIdSet.has(pid));
      if (orphaned.length > 0) {
        console.warn(`[IslandMap] Bridge "${b.label}" has ${orphaned.length} orphaned paperIds:`, orphaned);
      }
      if (valid.length !== b.paperIds.length) {
        console.warn(`[IslandMap] Bridge "${b.label}" paperIds: ${b.paperIds.length} total, ${valid.length} valid`);
      }
    }

    const bridgeBadges = bridgeGroups
      .filter((d) => d.paperIds.filter((pid) => paperIdSet.has(pid)).length > 0)
      .append('g')
      .attr('class', 'bridge-badge')
      .attr('pointer-events', 'none');
    bridgeBadges
      .append('circle')
      .attr('r', 9)
      .attr('fill', 'var(--bg-badge)')
      .attr('opacity', 0.8);
    bridgeBadges
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '9px')
      .attr('fill', 'var(--btn-active-text)')
      .attr('font-weight', 'bold')
      .text((d) => d.paperIds.filter((pid) => paperIdSet.has(pid)).length);

    // Island ellipses
    const islandGroups = g
      .selectAll<SVGGElement, SimNode>('.island-group')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'island-group')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        _event.stopPropagation();
        onIslandClickRef.current(d.island.id);
      })
      .on('contextmenu', (_event: MouseEvent, d) => {
        _event.preventDefault();
        _event.stopPropagation();
        onContextMenuRef.current?.({ type: 'island', id: d.island.id, screenX: _event.clientX, screenY: _event.clientY });
      });

    islandGroups
      .append('ellipse')
      .attr('rx', 80)
      .attr('ry', 50)
      .attr('fill', (d) => d.island.color ?? '#8ecae6')
      .attr('stroke', (d) =>
        connectionStartRef.current === d.island.id ? '#e76f51' : 'var(--island-stroke)',
      )
      .attr('stroke-width', (d) =>
        connectionStartRef.current === d.island.id ? 4 : 2,
      )
      .attr('opacity', 0.85);

    islandGroups
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', 'var(--text-heading)')
      .attr('pointer-events', 'none')
      .attr('y', -8)
      .text((d) => d.island.name);

    // Sub-info: city count + unique papers (deduplicated across cities and bridges)
    islandGroups
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', 'var(--text-secondary)')
      .attr('pointer-events', 'none')
      .attr('y', 10)
      .text((d) => {
        const cityCount = d.island.cities.length;
        const paperIdSet = new Set<string>();
        for (const c of d.island.cities) {
          for (const pid of c.paperIds) paperIdSet.add(pid);
        }
        for (const b of data.bridges) {
          if (b.sourceIslandId === d.island.id || b.targetIslandId === d.island.id) {
            for (const pid of b.paperIds) paperIdSet.add(pid);
          }
        }
        return `${cityCount} cities · ${paperIdSet.size} papers`;
      });

    // Compute the Quadratic Bezier control point for a bridge.
    // If a custom controlPoint is saved, use it. Otherwise auto-compute from parallel offset.
    function bridgeControlPoint(d: Bridge): { x: number; y: number } {
      const s = nodeMap.get(d.sourceIslandId);
      const t = nodeMap.get(d.targetIslandId);
      if (!s || !t) return { x: 0, y: 0 };
      const x1 = s.x!, y1 = s.y!, x2 = t.x!, y2 = t.y!;

      if (d.controlPoint) return d.controlPoint;

      const key = pairKey(d.sourceIslandId, d.targetIslandId);
      const total = pairCountMap.get(key) ?? 1;
      const idx = bridgeOffsets.get(d.id) ?? 0;
      if (total <= 1) {
        // Straight line: control point = midpoint
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
      }
      const SPREAD = 50;
      const offset = (idx - (total - 1) / 2) * SPREAD;
      const [sortedA, sortedB] = [d.sourceIslandId, d.targetIslandId].sort();
      const sA = nodeMap.get(sortedA)!;
      const sB = nodeMap.get(sortedB)!;
      const pdx = sB.x! - sA.x!;
      const pdy = sB.y! - sA.y!;
      const len = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
      const nx = -pdy / len;
      const ny = pdx / len;
      return { x: (x1 + x2) / 2 + nx * offset, y: (y1 + y2) / 2 + ny * offset };
    }

    function bridgePath(d: Bridge): string {
      const s = nodeMap.get(d.sourceIslandId);
      const t = nodeMap.get(d.targetIslandId);
      if (!s || !t) return '';
      const x1 = s.x!, y1 = s.y!, x2 = t.x!, y2 = t.y!;
      const cp = bridgeControlPoint(d);
      // If control point is exactly midpoint (straight line), render as L for cleaner look
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (!d.controlPoint && Math.abs(cp.x - mx) < 1 && Math.abs(cp.y - my) < 1) {
        return `M${x1},${y1} L${x2},${y2}`;
      }
      return `M${x1},${y1} Q${cp.x},${cp.y} ${x2},${y2}`;
    }

    // Visual midpoint of Quadratic Bezier at t=0.5: 0.25*P0 + 0.5*CP + 0.25*P2
    function bridgeMidpoint(d: Bridge): { x: number; y: number } {
      const s = nodeMap.get(d.sourceIslandId);
      const t = nodeMap.get(d.targetIslandId);
      if (!s || !t) return { x: 0, y: 0 };
      const cp = bridgeControlPoint(d);
      return {
        x: 0.25 * s.x! + 0.5 * cp.x + 0.25 * t.x!,
        y: 0.25 * s.y! + 0.5 * cp.y + 0.25 * t.y!,
      };
    }

    // Curve drag handles — small circle at bridge midpoint, draggable in select mode
    const curveHandles = g
      .selectAll<SVGCircleElement, Bridge>('.curve-handle')
      .data(data.bridges)
      .enter()
      .append('circle')
      .attr('class', 'curve-handle')
      .attr('r', 6)
      .attr('fill', 'var(--accent-forward)')
      .attr('fill-opacity', 0)
      .attr('stroke', 'var(--accent-forward)')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 1.5)
      .attr('cursor', 'grab');

    // Show handles on hover
    curveHandles
      .on('mouseenter', function () {
        if (modeRef.current !== 'select') return;
        d3.select(this).attr('fill-opacity', 0.3).attr('stroke-opacity', 0.8);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('fill-opacity', 0).attr('stroke-opacity', 0);
      });

    // Drag to adjust curve
    const curveDrag = d3
      .drag<SVGCircleElement, Bridge>()
      .filter(() => modeRef.current === 'select')
      .on('start', function () {
        d3.select(this).attr('fill-opacity', 0.5).attr('stroke-opacity', 1).attr('cursor', 'grabbing');
      })
      .on('drag', function (event, d) {
        // The user drags the visual midpoint. Convert to control point:
        // midpoint = 0.25*P0 + 0.5*CP + 0.25*P2  =>  CP = 2*midpoint - 0.5*(P0+P2)
        const s = nodeMap.get(d.sourceIslandId);
        const t = nodeMap.get(d.targetIslandId);
        if (!s || !t) return;
        const cpx = 2 * event.x - 0.5 * (s.x! + t.x!);
        const cpy = 2 * event.y - 0.5 * (s.y! + t.y!);
        d.controlPoint = { x: cpx, y: cpy };
        updatePositions();
      })
      .on('end', function (_event, d) {
        d3.select(this).attr('fill-opacity', 0).attr('stroke-opacity', 0).attr('cursor', 'grab');
        if (d.controlPoint) {
          mapService.updateBridgeControlPoint(d.id, d.controlPoint);
        }
      });
    curveHandles.call(curveDrag);

    // Update positions function
    function updatePositions() {
      islandGroups.attr('transform', (d) => `translate(${d.x},${d.y})`);
      bridgeHitAreas.attr('d', bridgePath);
      bridgeLines.attr('d', bridgePath);
      bridgeLabels.each(function (d) {
        const mid = bridgeMidpoint(d);
        d3.select(this).attr('x', mid.x).attr('y', mid.y - 10);
      });
      bridgeBadges.each(function (d) {
        const mid = bridgeMidpoint(d);
        d3.select(this).attr('transform', `translate(${mid.x},${mid.y + 8})`);
      });
      curveHandles.each(function (d) {
        const mid = bridgeMidpoint(d);
        d3.select(this).attr('cx', mid.x).attr('cy', mid.y);
      });
    }

    // Drag behavior (disabled in bridge-connect mode so clicks work)
    const drag = d3
      .drag<SVGGElement, SimNode>()
      .clickDistance(4)
      .filter(() => modeRef.current !== 'bridge-connect')
      .on('start', (_event, d) => {
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
        if (!simulationRef.current) {
          d.x = event.x;
          d.y = event.y;
          updatePositions();
        }
      })
      .on('end', (_event, d) => {
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
        onIslandDragEndRef.current(d.island.id, { x: d.x!, y: d.y! });
      });

    islandGroups.call(drag);

    if (!hasPositions && data.islands.length > 1) {
      // Run force simulation for initial layout
      const simulation = d3
        .forceSimulation(nodes)
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(100))
        .on('tick', updatePositions)
        .on('end', () => {
          nodes.forEach((n) => {
            onIslandDragEndRef.current(n.island.id, { x: n.x!, y: n.y! });
          });
        });

      simulationRef.current = simulation;
    } else {
      updatePositions();
      simulationRef.current = null;
    }

    return () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
    };
  }, [data, connectionStart]);

  // Update cursor when mode changes
  useEffect(() => {
    if (svgRef.current) {
      svgRef.current.style.cursor =
        mode === 'add-island' ? 'crosshair' : mode === 'bridge-connect' ? 'pointer' : 'default';
    }
  }, [mode]);

  // Highlight bridges that contain the highlighted paper (no full D3 re-render)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const groups = svg.selectAll<SVGGElement, (typeof data.bridges)[0]>('.bridge-group');
    if (!highlightedPaperId) {
      // Reset all
      groups.select('.bridge').attr('filter', null).attr('stroke-width', 3).attr('opacity', null);
      groups.select('.bridge-hit').attr('stroke-width', 16);
      return;
    }
    groups.each(function (d) {
      const g = d3.select(this);
      const match = d.paperIds.includes(highlightedPaperId);
      g.select('.bridge').attr('filter', match ? 'url(#glow)' : null).attr('stroke-width', match ? 5 : 3).attr('opacity', match ? 1 : 0.2);
      g.select('.bridge-hit').attr('stroke-width', match ? 20 : 16);
    });
  }, [highlightedPaperId, data]);

  return (
    <svg
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-map)',
      }}
    />
  );
});

export default IslandMap;
