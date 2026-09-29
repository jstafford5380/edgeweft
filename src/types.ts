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
  source: string;
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
