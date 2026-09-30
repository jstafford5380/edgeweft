/** Node shapes supported by the built-in renderer. */
export const graphNodeShapes = ['cylinder', 'box', 'hexagon', 'panel'] as const;

/** A shape that can be assigned to an individual graph node. */
export type GraphNodeShape = typeof graphNodeShapes[number];

/** A shelf in the graph. Layers are ordered from bottom to top in `GraphData.layers`. */
export interface GraphLayer {
  /** Unique, stable layer identifier referenced by `GraphNode.layerId`. */
  readonly id: string;
  /** Short display key shown beside the layer label; defaults to `id`. */
  readonly key?: string;
  /** Human-readable layer name. */
  readonly label: string;
  /** Supporting text shown beside the shelf. */
  readonly description?: string;
  /** Optional color metadata; the built-in renderer does not currently use it. */
  readonly color?: string;
}

/** An entity placed on one layer. Positions and shapes belong to nodes, not layers. */
export interface GraphNode {
  /** Unique, stable node identifier referenced by edges and ownership links. */
  readonly id: string;
  /** Name displayed above the node. */
  readonly label: string;
  /** ID of the layer containing this node. */
  readonly layerId: string;
  /** Horizontal position in scene units. Supply both `x` and `z` to pin a node. */
  readonly x?: number;
  /** Depth position in scene units. Supply both `x` and `z` to pin a node. */
  readonly z?: number;
  /** Secondary text shown in the selected-node details. */
  readonly subtitle?: string;
  /** Shape used to draw this node, independent of its layer. Defaults to `box`. */
  readonly shape?: GraphNodeShape;
}

/** A directed relationship between two nodes. Flow travels from source to target. */
export interface GraphEdge {
  /** Stable edge identity, recommended when relationships may be reordered or updated. */
  readonly id?: string;
  /** ID of the node where this relationship begins. */
  readonly source: string;
  /** ID of the destination node; animated flow travels toward it. */
  readonly target: string;
  /** Relationship category used by `visibleEdgeTypes`; defaults to `dependency`. */
  readonly type?: string;
}

/** An owner displayed in the flat owners panel beside the 3D graph. */
export interface GraphOwner {
  /** Unique, stable owner identifier referenced by ownership links. */
  readonly id: string;
  /** Human-readable owner or team name. */
  readonly label: string;
  /** Secondary name shown in the owners panel. */
  readonly lead?: string;
}

/** Associates a graph node with an owner. */
export interface GraphOwnership {
  /** ID of the owned node. */
  readonly nodeId: string;
  /** ID of its owner. */
  readonly ownerId: string;
}

/** Complete graph snapshot consumed by `DependencyGraph` and its layout helpers. */
export interface GraphData {
  /** Shelves in bottom-to-top order. */
  readonly layers: readonly GraphLayer[];
  /** Nodes to place on those shelves. */
  readonly nodes: readonly GraphNode[];
  /** Directed relationships between nodes. */
  readonly edges: readonly GraphEdge[];
  /** Optional owners displayed outside the 3D stack. */
  readonly owners?: readonly GraphOwner[];
  /** Optional links from nodes to owners; requires matching `owners` entries. */
  readonly ownership?: readonly GraphOwnership[];
}
