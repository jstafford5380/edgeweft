import { graphEdgeTypes, graphNodeShapes, type GraphData, type GraphEdge, type GraphEdgeType, type GraphNode } from './types';

/**
 * Get a node and its directly connected neighbors, ignoring edge direction.
 *
 * @param nodeId - Node whose immediate neighborhood to find.
 * @param edges - Directed graph edges to inspect.
 * @param visibleEdgeTypes - Optional filter; untyped edges use `dependency`.
 * @returns A set containing `nodeId` and the IDs of its direct neighbors.
 */
export function getConnectedNodes(nodeId: string, edges: readonly GraphEdge[], visibleEdgeTypes?: ReadonlySet<GraphEdgeType>): Set<string> {
  const connected = new Set([nodeId]);
  for (const edge of edges) {
    if (visibleEdgeTypes && !visibleEdgeTypes.has(edge.type ?? 'dependency')) continue;
    if (edge.source === nodeId) connected.add(edge.target);
    if (edge.target === nodeId) connected.add(edge.source);
  }
  return connected;
}

/**
 * Get a node and every node reachable by following outgoing relationships.
 * Incoming dependents are excluded. Cycles are visited once.
 *
 * @param nodeId - Starting node whose recursive dependencies to find.
 * @param edges - Directed graph edges to traverse from source to target.
 * @param visibleEdgeTypes - Optional relationship filter; untyped edges use `dependency`.
 * @returns A set containing `nodeId` and all reachable targets.
 */
export function getDownstreamNodes(nodeId: string, edges: readonly GraphEdge[], visibleEdgeTypes?: ReadonlySet<GraphEdgeType>): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (visibleEdgeTypes && !visibleEdgeTypes.has(edge.type ?? 'dependency')) continue;
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const reachable = new Set([nodeId]);
  const pending = [nodeId];
  for (let index = 0; index < pending.length; index++) {
    for (const target of outgoing.get(pending[index]) ?? []) {
      if (reachable.has(target)) continue;
      reachable.add(target);
      pending.push(target);
    }
  }
  return reachable;
}

/** Find a node by ID in a graph snapshot, or return `undefined` if it is absent. */
export function getNodeById(data: GraphData, id: string): GraphNode | undefined {
  return data.nodes.find((node) => node.id === id);
}

/**
 * Check graph IDs, references, pinned coordinates, layer colors, node shapes, and relationship types.
 *
 * @returns Human-readable validation errors; an empty array means the graph is valid.
 */
export function validateGraph(data: GraphData): string[] {
  const errors: string[] = [];
  const layerIds = new Set<string>();
  const layerTypes = new Map<string, string>();
  const nodeIds = new Set<string>();
  for (const layer of data.layers) {
    if (layerIds.has(layer.id)) errors.push(`Duplicate layer id: ${layer.id}`);
    if (layer.type !== undefined && !['default', 'left2d', 'right2d'].includes(layer.type)) errors.push(`Unsupported layer type for ${layer.id}: ${layer.type}`);
    if (layer.color !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(layer.color.trim())) errors.push(`Invalid color for layer ${layer.id}: ${layer.color}`);
    layerIds.add(layer.id);
    layerTypes.set(layer.id, layer.type ?? 'default');
  }
  for (const node of data.nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    if (!layerIds.has(node.layerId)) errors.push(`Unknown layer for ${node.id}: ${node.layerId}`);
    if (layerTypes.get(node.layerId) === 'default') {
      if ((node.x === undefined) !== (node.z === undefined)) errors.push(`Incomplete position for ${node.id}: supply both x and z`);
      if (node.x !== undefined && !Number.isFinite(node.x)) errors.push(`Invalid x position for ${node.id}`);
      if (node.z !== undefined && !Number.isFinite(node.z)) errors.push(`Invalid z position for ${node.id}`);
    }
    if (node.shape !== undefined && !graphNodeShapes.includes(node.shape)) errors.push(`Unsupported shape for ${node.id}: ${node.shape}`);
    nodeIds.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of data.edges) {
    if (edge.id) {
      if (edgeIds.has(edge.id)) errors.push(`Duplicate edge id: ${edge.id}`);
      edgeIds.add(edge.id);
    }
    if (!nodeIds.has(edge.source)) errors.push(`Unknown edge source: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Unknown edge target: ${edge.target}`);
    if (edge.type !== undefined && !graphEdgeTypes.includes(edge.type)) errors.push(`Unsupported edge type: ${edge.type}`);
  }
  return errors;
}
