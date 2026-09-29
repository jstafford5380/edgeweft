import type { GraphData, GraphEdge, GraphNode } from './types';

export function getConnectedNodes(nodeId: string, edges: GraphEdge[], visibleEdgeTypes?: ReadonlySet<string>): Set<string> {
  const connected = new Set([nodeId]);
  for (const edge of edges) {
    if (visibleEdgeTypes && !visibleEdgeTypes.has(edge.type ?? 'dependency')) continue;
    if (edge.source === nodeId) connected.add(edge.target);
    if (edge.target === nodeId) connected.add(edge.source);
  }
  return connected;
}

export function getNodeById(data: GraphData, id: string): GraphNode | undefined {
  return data.nodes.find((node) => node.id === id);
}

export function validateGraph(data: GraphData): string[] {
  const errors: string[] = [];
  const layerIds = new Set<string>();
  const nodeIds = new Set<string>();
  for (const layer of data.layers) {
    if (layerIds.has(layer.id)) errors.push(`Duplicate layer id: ${layer.id}`);
    layerIds.add(layer.id);
  }
  for (const node of data.nodes) {
    if (nodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    if (!layerIds.has(node.layerId)) errors.push(`Unknown layer for ${node.id}: ${node.layerId}`);
    nodeIds.add(node.id);
  }
  for (const edge of data.edges) {
    if (!nodeIds.has(edge.source)) errors.push(`Unknown edge source: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Unknown edge target: ${edge.target}`);
  }
  const ownerIds = new Set<string>();
  for (const owner of data.owners ?? []) {
    if (ownerIds.has(owner.id)) errors.push(`Duplicate owner id: ${owner.id}`);
    ownerIds.add(owner.id);
  }
  for (const link of data.ownership ?? []) {
    if (!nodeIds.has(link.nodeId)) errors.push(`Unknown owned node: ${link.nodeId}`);
    if (!ownerIds.has(link.ownerId)) errors.push(`Unknown owner: ${link.ownerId}`);
  }
  return errors;
}
