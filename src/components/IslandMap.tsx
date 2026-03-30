import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import type { ResearchMap, Island } from '../services/types';
import type { ToolbarMode } from '../hooks/useToolbar';

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

  useEffect(() => {
    modeRef.current = mode;
    onIslandClickRef.current = onIslandClick;
    onBridgeClickRef.current = onBridgeClick;
    onCanvasClickRef.current = onCanvasClick;
    onIslandDragEndRef.current = onIslandDragEnd;
    connectionStartRef.current = connectionStart;
    onContextMenuRef.current = onContextMenu;
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
      .attr('stroke', (d) => (d.direction === 'forward' ? '#2a9d8f' : '#e76f51'))
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '12,12')
      .attr('pointer-events', 'none');

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
        connectionStartRef.current === d.island.id ? '#e76f51' : '#023047',
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
      .attr('fill', '#023047')
      .attr('pointer-events', 'none')
      .text((d) => d.island.name);

    // Compute bridge SVG path with curve offset for parallel bridges.
    // Perpendicular direction is always computed from the sorted pair
    // so A→B and B→A curves bend to *different* sides.
    function bridgePath(d: (typeof data.bridges)[0]): string {
      const s = nodeMap.get(d.sourceIslandId);
      const t = nodeMap.get(d.targetIslandId);
      if (!s || !t) return '';
      const x1 = s.x!, y1 = s.y!, x2 = t.x!, y2 = t.y!;
      const key = pairKey(d.sourceIslandId, d.targetIslandId);
      const total = pairCountMap.get(key) ?? 1;
      const idx = bridgeOffsets.get(d.id) ?? 0;
      if (total <= 1) {
        return `M${x1},${y1} L${x2},${y2}`;
      }
      const SPREAD = 50;
      const offset = (idx - (total - 1) / 2) * SPREAD;
      // Always compute perpendicular from sorted-pair direction
      // so the offset is consistent regardless of source→target order.
      const [sortedA, sortedB] = [d.sourceIslandId, d.targetIslandId].sort();
      const sA = nodeMap.get(sortedA)!;
      const sB = nodeMap.get(sortedB)!;
      const pdx = sB.x! - sA.x!;
      const pdy = sB.y! - sA.y!;
      const len = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
      const nx = -pdy / len;
      const ny = pdx / len;
      const mx = (x1 + x2) / 2 + nx * offset;
      const my = (y1 + y2) / 2 + ny * offset;
      return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
    }

    // Update positions function
    function updatePositions() {
      islandGroups.attr('transform', (d) => `translate(${d.x},${d.y})`);
      bridgeHitAreas.attr('d', bridgePath);
      bridgeLines.attr('d', bridgePath);
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
        background: 'linear-gradient(180deg, #e8f4f8 0%, #f0f4f8 100%)',
      }}
    />
  );
});

export default IslandMap;
