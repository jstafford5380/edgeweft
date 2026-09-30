import type { GraphData, GraphNode } from './types';

/** A 3D graph node with resolved coordinates on its shelf. */
export interface PositionedGraphNode extends GraphNode {
  /** Resolved horizontal position in scene units. */
  x: number;
  /** Resolved depth position in scene units. */
  z: number;
}

/** Result of laying out one graph snapshot. */
export interface GraphLayout {
  /** 3D nodes with pinned or automatically assigned coordinates; excludes 2D nodes. */
  nodes: PositionedGraphNode[];
  /** Width of every shelf in scene units, expanded to contain the nodes. */
  width: number;
  /** Depth of every shelf in scene units, expanded to contain the nodes. */
  depth: number;
  /** IDs placed automatically; pass this layout back to preserve their positions across snapshots. */
  automaticIds: string[];
}

export type PositionedGraphData = Omit<GraphData, 'nodes'> & { nodes: PositionedGraphNode[] };

const BASE_WIDTH = 1080;
const BASE_DEPTH = 580;
const CELL_X = 240;
const CELL_Z = 170;
const NODE_CLEARANCE_X = 180;
const NODE_CLEARANCE_Z = 115;

type Point = { x: number; z: number };

function hasPosition(node: GraphNode): node is PositionedGraphNode {
  return Number.isFinite(node.x) && Number.isFinite(node.z);
}

function candidateSlots(count: number, fixed: PositionedGraphNode[]): Point[] {
  let capacity = Math.max(1, count + fixed.length);
  while (true) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(capacity)));
    const rows = Math.ceil(capacity / columns);
    const slots: Point[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const point = { x: (column - (columns - 1) / 2) * CELL_X, z: (row - (rows - 1) / 2) * CELL_Z };
        if (fixed.some((node) => Math.abs(point.x - node.x) < NODE_CLEARANCE_X && Math.abs(point.z - node.z) < NODE_CLEARANCE_Z)) continue;
        slots.push(point);
      }
    }
    if (slots.length >= count) {
      slots.sort((a, b) => a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z || a.z - b.z || a.x - b.x);
      return slots;
    }
    capacity += Math.max(2, columns);
  }
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const abC = side(a, b, c);
  const abD = side(a, b, d);
  const cdA = side(c, d, a);
  const cdB = side(c, d, b);
  return abC * abD < 0 && cdA * cdB < 0;
}

/**
 * Resolve 3D node coordinates and size the shelves for the resulting graph.
 * Explicit `x` and `z` coordinates take precedence. Automatic placement spreads nodes
 * apart and uses relationship lengths and crossings as layout heuristics.
 *
 * @param data - Graph snapshot to lay out.
 * @param previous - Prior result, used to keep surviving automatic nodes in place when possible.
 * @returns Positioned nodes, shelf dimensions, and IDs of automatically placed nodes.
 */
export function layoutGraph(data: GraphData, previous?: GraphLayout): GraphLayout {
  const layers = data.layers.filter((layer) => !layer.type || layer.type === 'default');
  const spatialLayerIds = new Set(layers.map((layer) => layer.id));
  const inputNodes = data.nodes.filter((node) => spatialLayerIds.has(node.layerId));
  const coordinates = new Map<string, Point>();
  const fixedIds = new Set(inputNodes.filter(hasPosition).map((node) => node.id));
  const previousNodes = new Map(previous?.nodes.map((node) => [node.id, node]) ?? []);
  const previousAutomaticIds = new Set(previous?.automaticIds ?? []);
  const movableByLayer = new Map<string, string[]>();
  const slotsByLayer = new Map<string, Point[]>();
  const layerByNode = new Map(inputNodes.map((node) => [node.id, node.layerId]));

  for (const node of inputNodes) {
    if (hasPosition(node)) coordinates.set(node.id, { x: node.x, z: node.z });
  }

  // Explicit positions win. Keep an automatic position only while its layer and clearance remain valid.
  for (const node of [...inputNodes].sort((a, b) => a.id.localeCompare(b.id))) {
    if (hasPosition(node)) continue;
    const prior = previousNodes.get(node.id);
    const blocked = inputNodes.some((other) => other.layerId === node.layerId && coordinates.has(other.id) &&
      Math.abs((coordinates.get(other.id)?.x ?? 0) - (prior?.x ?? 0)) < NODE_CLEARANCE_X &&
      Math.abs((coordinates.get(other.id)?.z ?? 0) - (prior?.z ?? 0)) < NODE_CLEARANCE_Z);
    if (prior?.layerId === node.layerId && previousAutomaticIds.has(node.id) && !blocked)
      coordinates.set(node.id, { x: prior.x, z: prior.z });
    else {
      const layer = movableByLayer.get(node.layerId) ?? [];
      layer.push(node.id);
      movableByLayer.set(node.layerId, layer);
    }
  }

  for (const layer of layers) {
    const ids = movableByLayer.get(layer.id);
    if (!ids?.length) continue;
    ids.sort();
    const fixed = inputNodes.filter((node) => node.layerId === layer.id && coordinates.has(node.id))
      .map((node) => ({ ...node, ...coordinates.get(node.id)! })) as PositionedGraphNode[];
    const slots = candidateSlots(ids.length, fixed);
    slotsByLayer.set(layer.id, slots);
    ids.forEach((id, index) => coordinates.set(id, slots[index]));
  }

  const edges = data.edges.filter((edge) => coordinates.has(edge.source) && coordinates.has(edge.target) && edge.source !== edge.target)
    .map((edge) => ({ ...edge, layerPair: [layerByNode.get(edge.source), layerByNode.get(edge.target)].sort().join(':') }));
  const score = (countCrossings: boolean): number => {
    let cost = 0;
    for (const edge of edges) {
      const a = coordinates.get(edge.source)!;
      const b = coordinates.get(edge.target)!;
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      cost += dx * dx + dz * dz;
    }
    if (countCrossings) {
      for (let i = 0; i < edges.length; i++) {
        const a = edges[i];
        for (let j = i + 1; j < edges.length; j++) {
          const b = edges[j];
          if (a.source === b.source || a.source === b.target || a.target === b.source || a.target === b.target) continue;
          // Crossings on the same shelf and between the same pair of shelves are most visible.
          if (a.layerPair !== b.layerPair) continue;
          if (crosses(coordinates.get(a.source)!, coordinates.get(a.target)!, coordinates.get(b.source)!, coordinates.get(b.target)!)) cost += 120000;
        }
      }
    }
    return cost;
  };

  const countCrossings = edges.length <= 80;
  let best = score(countCrossings);
  for (const layer of layers) {
    const ids = movableByLayer.get(layer.id);
    const slots = slotsByLayer.get(layer.id);
    if (!ids?.length || !slots) continue;
    const owners: (string | null)[] = slots.map((_, index) => ids[index] ?? null);
    const attempts = slots.length <= 30 ? 3 * slots.length * slots.length : Math.min(1600, 15 * slots.length);
    let seed = 2166136261;
    for (const id of ids) for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
    for (let attempt = 0; attempt < attempts; attempt++) {
      let i: number;
      let j: number;
      if (slots.length <= 30) {
        const pair = attempt % (slots.length * slots.length);
        i = Math.floor(pair / slots.length);
        j = pair % slots.length;
      } else {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        i = seed % slots.length;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        j = seed % slots.length;
      }
      if (i === j || (!owners[i] && !owners[j])) continue;
      const first = owners[i];
      const second = owners[j];
      owners[i] = second;
      owners[j] = first;
      if (first) coordinates.set(first, slots[j]);
      if (second) coordinates.set(second, slots[i]);
      const next = score(countCrossings);
      if (next < best - 0.001) best = next;
      else {
        owners[i] = first;
        owners[j] = second;
        if (first) coordinates.set(first, slots[i]);
        if (second) coordinates.set(second, slots[j]);
      }
    }
  }

  const nodes = inputNodes.map((node) => ({ ...node, ...(coordinates.get(node.id) ?? { x: 0, z: 0 }) })) as PositionedGraphNode[];
  let width = BASE_WIDTH;
  let depth = BASE_DEPTH;
  for (const node of nodes) {
    const automatic = !fixedIds.has(node.id);
    width = Math.max(width, 2 * (Math.abs(node.x) + (automatic ? 110 : 40)));
    depth = Math.max(depth, 2 * (Math.abs(node.z) + (automatic ? 80 : 30)));
  }
  return { nodes, width, depth, automaticIds: nodes.filter((node) => !fixedIds.has(node.id)).map((node) => node.id) };
}
