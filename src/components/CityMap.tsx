import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import type { Island, Road } from '../services/types';
import type { ToolbarMode } from '../hooks/useToolbar';
import * as mapService from '../services/mapService';

export interface CityMapContextMenuEvent {
  type: 'city' | 'road';
  id: string;
  screenX: number;
  screenY: number;
}

interface CityMapProps {
  island: Island;
  roads: Road[];
  mode: ToolbarMode;
  connectionStart: string | null;
  highlightedPaperId?: string | null;
  onCityClick: (cityId: string) => void;
  onRoadClick: (roadId: string) => void;
  onCanvasClick: (position: { x: number; y: number }) => void;
  onCityDragEnd: (cityId: string, position: { x: number; y: number }) => void;
  onContextMenu?: (event: CityMapContextMenuEvent) => void;
  onPaperDropOnRoad?: (paperId: string, roadId: string) => void;
}

const CityMap = forwardRef<SVGSVGElement, CityMapProps>(function CityMap({
  island,
  roads,
  mode,
  connectionStart,
  highlightedPaperId,
  onCityClick,
  onRoadClick,
  onCanvasClick,
  onCityDragEnd,
  onContextMenu,
  onPaperDropOnRoad,
}, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  useImperativeHandle(ref, () => svgRef.current!, []);

  const modeRef = useRef(mode);
  const onCityClickRef = useRef(onCityClick);
  const onRoadClickRef = useRef(onRoadClick);
  const onCanvasClickRef = useRef(onCanvasClick);
  const onCityDragEndRef = useRef(onCityDragEnd);
  const onContextMenuRef = useRef(onContextMenu);
  const onPaperDropOnRoadRef = useRef(onPaperDropOnRoad);

  useEffect(() => {
    modeRef.current = mode;
    onCityClickRef.current = onCityClick;
    onRoadClickRef.current = onRoadClick;
    onCanvasClickRef.current = onCanvasClick;
    onCityDragEndRef.current = onCityDragEnd;
    onContextMenuRef.current = onContextMenu;
    onPaperDropOnRoadRef.current = onPaperDropOnRoad;
  });

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;
    svg.attr('width', width).attr('height', height);

    // Animated dash flow style for roads
    const defs = svg.append('defs');
    const style = svg.append('style');
    style.text(`
      @keyframes road-flow-forward {
        to { stroke-dashoffset: -18; }
      }
      @keyframes road-flow-backward {
        to { stroke-dashoffset: 18; }
      }
      .road-forward {
        animation: road-flow-forward 0.8s linear infinite;
      }
      .road-backward {
        animation: road-flow-backward 0.8s linear infinite;
      }
    `);

    // Glow filter for paper highlight
    const glowFilter = defs.append('filter').attr('id', 'road-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glowFilter.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '3').attr('result', 'blur');
    glowFilter.append('feFlood').attr('flood-color', '#ffd700').attr('flood-opacity', '0.7').attr('result', 'color');
    glowFilter.append('feComposite').attr('in', 'color').attr('in2', 'blur').attr('operator', 'in').attr('result', 'glow');
    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'glow');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrow markers
    ['forward', 'backward'].forEach((dir) => {
      defs
        .append('marker')
        .attr('id', `road-arrow-${dir}`)
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

    // Canvas click
    svg.on('click', (event: MouseEvent) => {
      if (modeRef.current !== 'add-city') return;
      if ((event.target as Element).tagName !== 'svg') return;
      const transform = d3.zoomTransform(svg.node()!);
      const [x, y] = transform.invert([event.offsetX, event.offsetY]);
      onCanvasClickRef.current({ x, y });
    });

    // Auto-grid layout for cities without position
    const cities = island.cities.map((c, i) => {
      const hasPos = c.position.x !== 0 || c.position.y !== 0;
      const col = i % 4;
      const row = Math.floor(i / 4);
      return {
        city: c,
        x: hasPos ? c.position.x : 150 + col * 160,
        y: hasPos ? c.position.y : 150 + row * 140,
      };
    });

    const cityMap = new Map(cities.map((c) => [c.city.id, c]));

    // Compute per-road curve offset for parallel roads between the same cities
    const pairKey = (a: string, b: string) => [a, b].sort().join('|');
    const pairCountMap = new Map<string, number>();
    const roadOffsets = new Map<string, number>();
    for (const r of roads) {
      const key = pairKey(r.sourceCityId, r.targetCityId);
      const idx = pairCountMap.get(key) ?? 0;
      pairCountMap.set(key, idx + 1);
      roadOffsets.set(r.id, idx);
    }

    function roadControlPoint(d: Road): { x: number; y: number } {
      const s = cityMap.get(d.sourceCityId);
      const t = cityMap.get(d.targetCityId);
      if (!s || !t) return { x: 0, y: 0 };
      const x1 = s.x, y1 = s.y, x2 = t.x, y2 = t.y;

      if (d.controlPoint) return d.controlPoint;

      const key = pairKey(d.sourceCityId, d.targetCityId);
      const total = pairCountMap.get(key) ?? 1;
      const idx = roadOffsets.get(d.id) ?? 0;
      if (total <= 1) {
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
      }
      const SPREAD = 35;
      const offset = (idx - (total - 1) / 2) * SPREAD;
      const [sortedA, sortedB] = [d.sourceCityId, d.targetCityId].sort();
      const sA = cityMap.get(sortedA)!;
      const sB = cityMap.get(sortedB)!;
      const pdx = sB.x - sA.x;
      const pdy = sB.y - sA.y;
      const len = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
      const nx = -pdy / len;
      const ny = pdx / len;
      return { x: (x1 + x2) / 2 + nx * offset, y: (y1 + y2) / 2 + ny * offset };
    }

    function roadPath(d: Road): string {
      const s = cityMap.get(d.sourceCityId);
      const t = cityMap.get(d.targetCityId);
      if (!s || !t) return '';
      const x1 = s.x, y1 = s.y, x2 = t.x, y2 = t.y;
      const cp = roadControlPoint(d);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (!d.controlPoint && Math.abs(cp.x - mx) < 1 && Math.abs(cp.y - my) < 1) {
        return `M${x1},${y1} L${x2},${y2}`;
      }
      return `M${x1},${y1} Q${cp.x},${cp.y} ${x2},${y2}`;
    }

    // Road groups: invisible hit area + visible path
    const roadGroups = g
      .selectAll<SVGGElement, Road>('.road-group')
      .data(roads)
      .enter()
      .append('g')
      .attr('class', 'road-group')
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        _event.stopPropagation();
        onRoadClickRef.current(d.id);
      })
      .on('contextmenu', (_event: MouseEvent, d) => {
        _event.preventDefault();
        _event.stopPropagation();
        onContextMenuRef.current?.({ type: 'road', id: d.id, screenX: _event.clientX, screenY: _event.clientY });
      });

    // Native DOM drag-over/drop for paper drag from sidebar
    roadGroups.each(function (d) {
      const el = this as SVGGElement;
      el.addEventListener('dragover', (e) => {
        if (e.dataTransfer?.types.includes('application/paper-id')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          d3.select(el).select('.road').attr('stroke-width', 5).attr('filter', 'url(#road-glow)');
        }
      });
      el.addEventListener('dragleave', () => {
        d3.select(el).select('.road').attr('stroke-width', 2.5).attr('filter', null);
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const paperId = e.dataTransfer?.getData('application/paper-id');
        if (paperId) {
          onPaperDropOnRoadRef.current?.(paperId, d.id);
        }
        d3.select(el).select('.road').attr('stroke-width', 2.5).attr('filter', null);
      });
    });

    roadGroups
      .append('path')
      .attr('class', 'road-hit')
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 28)
      .attr('d', roadPath);

    roadGroups
      .append('path')
      .attr('class', (d) => `road road-${d.direction}`)
      .attr('fill', 'none')
      .attr('stroke', (d) => d.color ?? (d.direction === 'forward' ? '#2a9d8f' : '#e76f51'))
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '9,9')
      .attr('pointer-events', 'none')
      .attr('d', roadPath);

    // Visual midpoint of road curve
    function roadMidpoint(d: Road): { x: number; y: number } {
      const s = cityMap.get(d.sourceCityId);
      const t = cityMap.get(d.targetCityId);
      if (!s || !t) return { x: 0, y: 0 };
      const cp = roadControlPoint(d);
      return {
        x: 0.25 * s.x + 0.5 * cp.x + 0.25 * t.x,
        y: 0.25 * s.y + 0.5 * cp.y + 0.25 * t.y,
      };
    }

    roadGroups
      .filter((d) => !!d.label)
      .append('text')
      .attr('class', 'road-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#555')
      .attr('pointer-events', 'none')
      .each(function (d) {
        const mid = roadMidpoint(d);
        d3.select(this).attr('x', mid.x).attr('y', mid.y);
      })
      .text((d) => {
        const label = d.label ?? '';
        return label.length > 25 ? label.slice(0, 23) + '...' : label;
      });

    // Road paper count badge
    const roadBadges = roadGroups
      .filter((d) => d.paperIds.length > 0)
      .append('g')
      .attr('class', 'road-badge')
      .attr('pointer-events', 'none')
      .each(function (d) {
        const mid = roadMidpoint(d);
        d3.select(this).attr('transform', `translate(${mid.x},${mid.y + 12})`);
      });
    roadBadges
      .append('circle')
      .attr('r', 8)
      .attr('fill', '#023047')
      .attr('opacity', 0.75);
    roadBadges
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '8px')
      .attr('fill', '#fff')
      .attr('font-weight', 'bold')
      .text((d) => d.paperIds.length);

    // Curve drag handles for roads
    const roadCurveHandles = g
      .selectAll<SVGCircleElement, Road>('.road-curve-handle')
      .data(roads)
      .enter()
      .append('circle')
      .attr('class', 'road-curve-handle')
      .attr('r', 5)
      .attr('fill', 'var(--accent-forward)')
      .attr('fill-opacity', 0)
      .attr('stroke', 'var(--accent-forward)')
      .attr('stroke-opacity', 0)
      .attr('stroke-width', 1.5)
      .attr('cursor', 'grab')
      .each(function (d) {
        const mid = roadMidpoint(d);
        d3.select(this).attr('cx', mid.x).attr('cy', mid.y);
      });

    roadCurveHandles
      .on('mouseenter', function () {
        if (modeRef.current !== 'select') return;
        d3.select(this).attr('fill-opacity', 0.3).attr('stroke-opacity', 0.8);
      })
      .on('mouseleave', function () {
        d3.select(this).attr('fill-opacity', 0).attr('stroke-opacity', 0);
      });

    const roadCurveDrag = d3
      .drag<SVGCircleElement, Road>()
      .filter(() => modeRef.current === 'select')
      .on('start', function () {
        d3.select(this).attr('fill-opacity', 0.5).attr('stroke-opacity', 1).attr('cursor', 'grabbing');
      })
      .on('drag', function (event, d) {
        const s = cityMap.get(d.sourceCityId);
        const t = cityMap.get(d.targetCityId);
        if (!s || !t) return;
        const cpx = 2 * event.x - 0.5 * (s.x + t.x);
        const cpy = 2 * event.y - 0.5 * (s.y + t.y);
        d.controlPoint = { x: cpx, y: cpy };
        // Update road paths and labels
        g.selectAll<SVGPathElement, Road>('.road-hit').attr('d', roadPath);
        g.selectAll<SVGPathElement, Road>('.road').attr('d', roadPath);
        g.selectAll<SVGTextElement, Road>('.road-label').each(function (rd) {
          const mid = roadMidpoint(rd);
          d3.select(this).attr('x', mid.x).attr('y', mid.y);
        });
        g.selectAll<SVGGElement, Road>('.road-badge').each(function (rd) {
          const mid = roadMidpoint(rd);
          d3.select(this).attr('transform', `translate(${mid.x},${mid.y + 12})`);
        });
        roadCurveHandles.each(function (rd) {
          const mid = roadMidpoint(rd);
          d3.select(this).attr('cx', mid.x).attr('cy', mid.y);
        });
      })
      .on('end', function (_event, d) {
        d3.select(this).attr('fill-opacity', 0).attr('stroke-opacity', 0).attr('cursor', 'grab');
        if (d.controlPoint) {
          mapService.updateRoadControlPoint(d.id, d.controlPoint);
        }
      });
    roadCurveHandles.call(roadCurveDrag);

    // City nodes
    const cityGroups = g
      .selectAll<SVGGElement, (typeof cities)[0]>('.city-group')
      .data(cities)
      .enter()
      .append('g')
      .attr('class', 'city-group')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        _event.stopPropagation();
        onCityClickRef.current(d.city.id);
      })
      .on('contextmenu', (_event: MouseEvent, d) => {
        _event.preventDefault();
        _event.stopPropagation();
        onContextMenuRef.current?.({ type: 'city', id: d.city.id, screenX: _event.clientX, screenY: _event.clientY });
      });

    const baseColor = island.color ?? '#8ecae6';

    cityGroups
      .append('rect')
      .attr('x', -40)
      .attr('y', -25)
      .attr('width', 80)
      .attr('height', 50)
      .attr('rx', 12)
      .attr('fill', baseColor)
      .attr('stroke', (d) =>
        connectionStart === d.city.id ? '#e76f51' : '#023047',
      )
      .attr('stroke-width', (d) => (connectionStart === d.city.id ? 3 : 1.5))
      .attr('opacity', 0.85);

    cityGroups
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#023047')
      .attr('pointer-events', 'none')
      .text((d) => d.city.name);

    // Drag (disabled in road-connect mode so clicks work)
    const drag = d3
      .drag<SVGGElement, (typeof cities)[0]>()
      .clickDistance(4)
      .filter(() => modeRef.current !== 'road-connect')
      .on('drag', (event, d) => {
        d.x = event.x;
        d.y = event.y;
        d3.select(event.sourceEvent.target.parentNode as SVGGElement).attr(
          'transform',
          `translate(${d.x},${d.y})`,
        );
        // Update connected roads, labels, and badges
        g.selectAll<SVGPathElement, Road>('.road-hit').attr('d', roadPath);
        g.selectAll<SVGPathElement, Road>('.road').attr('d', roadPath);
        g.selectAll<SVGTextElement, Road>('.road-label').each(function (rd) {
          const mid = roadMidpoint(rd);
          d3.select(this).attr('x', mid.x).attr('y', mid.y);
        });
        g.selectAll<SVGGElement, Road>('.road-badge').each(function (rd) {
          const mid = roadMidpoint(rd);
          d3.select(this).attr('transform', `translate(${mid.x},${mid.y + 12})`);
        });
      })
      .on('end', (_event, d) => {
        onCityDragEndRef.current(d.city.id, { x: d.x, y: d.y });
      });

    cityGroups.call(drag);
  }, [island, roads, connectionStart]);

  useEffect(() => {
    if (svgRef.current) {
      svgRef.current.style.cursor =
        mode === 'add-city' ? 'crosshair' : mode === 'road-connect' ? 'pointer' : 'default';
    }
  }, [mode]);

  // Highlight roads that contain the highlighted paper
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const groups = svg.selectAll<SVGGElement, Road>('.road-group');
    if (!highlightedPaperId) {
      groups.select('.road').attr('filter', null).attr('stroke-width', 2.5).attr('opacity', null);
      groups.select('.road-hit').attr('stroke-width', 28);
      return;
    }
    groups.each(function (d) {
      const g = d3.select(this);
      const match = d.paperIds.includes(highlightedPaperId);
      g.select('.road').attr('filter', match ? 'url(#road-glow)' : null).attr('stroke-width', match ? 4 : 2.5).attr('opacity', match ? 1 : 0.2);
      g.select('.road-hit').attr('stroke-width', match ? 34 : 28);
    });
  }, [highlightedPaperId, roads]);

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

export default CityMap;
