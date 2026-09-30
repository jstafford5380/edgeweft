export type GraphNodeKind = 'resource' | 'component' | 'bff' | 'app';

export interface GraphLayer {
  readonly id: string;
  readonly key?: string;
  readonly label: string;
  readonly description?: string;
  readonly color?: string;
  /** Default shape for nodes on this layer. */
  readonly kind?: GraphNodeKind;
}

export interface GraphNode {
  readonly id: string;
  readonly label: string;
  readonly layerId: string;
  /** Optional horizontal position. Supply both x and z to pin a node. */
  readonly x?: number;
  /** Optional depth position. Supply both x and z to pin a node. */
  readonly z?: number;
  readonly subtitle?: string;
  /** Overrides the layer shape for this node. Defaults to component. */
  readonly kind?: GraphNodeKind;
}

export interface GraphEdge {
  /** Optional stable identity for relationships that may be reordered or updated. */
  readonly id?: string;
  /** The node where this directed relationship begins. */
  readonly source: string;
  /** The node it points to; animated flow travels toward this node. */
  readonly target: string;
  readonly type?: string;
}

export interface GraphOwner {
  readonly id: string;
  readonly label: string;
  readonly lead?: string;
}

export interface GraphOwnership {
  readonly nodeId: string;
  readonly ownerId: string;
}

export interface GraphData {
  readonly layers: readonly GraphLayer[];
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly owners?: readonly GraphOwner[];
  readonly ownership?: readonly GraphOwnership[];
}
