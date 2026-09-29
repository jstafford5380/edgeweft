export interface GraphLayer {
  id: string;
  key?: string;
  label: string;
  description?: string;
  color?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  layerId: string;
  x: number;
  z: number;
  subtitle?: string;
}

export interface GraphEdge {
  /** The node where this directed relationship begins. */
  source: string;
  /** The node it points to; animated flow travels toward this node. */
  target: string;
  type?: string;
}

export interface GraphOwner {
  id: string;
  label: string;
  lead?: string;
}

export interface GraphOwnership {
  nodeId: string;
  ownerId: string;
}

export interface GraphData {
  layers: GraphLayer[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  owners?: GraphOwner[];
  ownership?: GraphOwnership[];
}
