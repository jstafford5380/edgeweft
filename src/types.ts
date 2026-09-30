/** Node shapes supported by the built-in renderer. */
export const graphNodeShapes = ['cylinder', 'box', 'hexagon', 'panel'] as const;

/** A shape that can be assigned to an individual graph node. */
export type GraphNodeShape = typeof graphNodeShapes[number];

/** Relationship categories supported by the built-in renderer and filters. */
export const graphEdgeTypes = ['dependency', 'call', 'resource', 'association'] as const;

/** A supported relationship category. Only `call` edges show animated flow. */
export type GraphEdgeType = typeof graphEdgeTypes[number];

/** Where a layer is displayed. `default` places nodes on a 3D shelf. */
export type GraphLayerType = 'default' | 'left2d' | 'right2d';

/** A group of nodes. Default layers are ordered bottom to top in `GraphData.layers`. */
export interface GraphLayer {
  /** Unique, stable layer identifier referenced by `GraphNode.layerId`. */
  readonly id: string;
  /** Display location. Omit for a 3D shelf (`default`). */
  readonly type?: GraphLayerType;
  /** Short display key shown beside the layer label; defaults to `id`. */
  readonly key?: string;
  /** Human-readable layer name. */
  readonly label: string;
  /** Supporting text shown beside a shelf or under a 2D section heading. */
  readonly description?: string;
  /** Optional color metadata; the built-in renderer does not currently use it. */
  readonly color?: string;
}

/** An entity placed on one layer, in the 3D scene or a 2D side rail. */
export interface GraphNode {
  /** Unique, stable node identifier referenced by edges. */
  readonly id: string;
  /** Name displayed above the node. */
  readonly label: string;
  /** ID of the layer containing this node. */
  readonly layerId: string;
  /** Horizontal position on a 3D shelf, in scene units. Ignored for 2D layers. Supply with `z` to pin. */
  readonly x?: number;
  /** Depth position on a 3D shelf, in scene units. Ignored for 2D layers. Supply with `x` to pin. */
  readonly z?: number;
  /** Secondary text shown in 2D rows and selected-node details. */
  readonly subtitle?: string;
  /** Shape used on a 3D shelf; ignored in 2D rows. Defaults to `box`. */
  readonly shape?: GraphNodeShape;
}

/** A directed relationship between two nodes. Calls can animate from source to target. */
export interface GraphEdge {
  /** Stable edge identity, recommended when relationships may be reordered or updated. */
  readonly id?: string;
  /** ID of the node where this relationship begins. */
  readonly source: string;
  /** ID of the destination node; call flow travels toward it. */
  readonly target: string;
  /** Supported relationship category used by `visibleEdgeTypes`; defaults to `dependency`. Only `call` animates flow. */
  readonly type?: GraphEdgeType;
}

/** Complete graph snapshot consumed by `DependencyGraph` and its layout helpers. */
export interface GraphData {
  /** Layers in display order; 3D layers are bottom-to-top, side layers are top-to-bottom. */
  readonly layers: readonly GraphLayer[];
  /** Nodes to place on those shelves. */
  readonly nodes: readonly GraphNode[];
  /** Directed relationships between nodes. */
  readonly edges: readonly GraphEdge[];
}
