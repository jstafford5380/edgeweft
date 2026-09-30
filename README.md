# Dependency Graph Thing

React and Three.js package scaffold for the layered dependency graph in [`docs/prototypes/from-claude`](docs/prototypes/from-claude).

## Run the test rail

```bash
npm install
npm run dev
```

Open [http://localhost:5174/](http://localhost:5174/). The rail imports the package source from `src/` and uses sample data adapted from the prototype.

## Build and check the package

```bash
npm run typecheck
npm test
npm run build
npm run pack:check
```

The build writes ESM, TypeScript declarations, and CSS to `dist/`. The package exports `DependencyGraph`, graph data types, and graph helpers. React 19, React DOM 19, and Three.js are peer dependencies. React Three Fiber renders the scene through WebGL.

```tsx
import { DependencyGraph, type GraphData } from 'dependency-graph-thing';
import 'dependency-graph-thing/style.css';

const data: GraphData = {
  layers: [{ id: 'services', key: 'L1', label: 'Services' }],
  nodes: [{ id: 'api', label: 'API', layerId: 'services', shape: 'box' }],
  edges: [],
};

<div style={{ height: 600 }}>
  <DependencyGraph data={data} />
</div>;
```

The component includes gridded 3D shelves, node shapes, relationship lines, animated edge flow, bloom, camera presets, and an optional 2D owners panel. The test rail uses the full v3 prototype fixture. Each edge is directed from `source` to `target`; the flow particle travels in that direction. Set `flow={false}` to turn off the particles.

Appearance and relationship visibility are controlled through component props:

```tsx
<DependencyGraph
  data={data}
  glowIntensity={0.45}
  shelfOpacity={0.5}
  showGrid={false}
  visibleEdgeTypes={['dependency', 'call']}
  flow={false}
  showLabels
  showLegend={false}
  title="My system"
  description={null}
/>
```

`glowIntensity` defaults to `0.65` and accepts values from `0` (off) to `2`; `bloom={false}` also disables it. `shelfOpacity` controls the shelf fill from `0` (fully transparent) to `1` (opaque) and defaults to the original `0.32`. Shelf outlines and the front edge scale with it relative to that default. `showGrid` separately controls both shelf and ground grid lines. `visibleEdgeTypes` accepts any edge type IDs, so the test rail's Dependencies, Calls, and Resource usage switches work without special cases in the package. `flow`, `showLabels`, and `showLegend` default to `true`. For `title` and `description`, `undefined` uses the automatic text for the current view, a string sets custom text, and `null` hides it. `showOwners` controls the optional 2D owners panel.

Node `x` and `z` coordinates are optional. Missing positions are laid out deterministically on collision-safe slots within each layer; the layout improves edge length and projected crossings, and shelves grow to fit dense layers. Supplying both coordinates pins a node in place. The exported `layoutGraph(data)` helper returns resolved node positions and shelf dimensions. The test rail's **Auto layout** switch applies this to the prototype graph.

Pass a new, immutable `GraphData` snapshot to update the graph. Keep layer, node, and owner IDs stable across snapshots; give edges an `id` when their endpoints or type may change. Existing automatic node positions are retained where possible. When a node's position changes, the node and its connectors ease to the new position; new nodes appear at their assigned positions. Removing a selected ID clears the selection through `onSelectNode(null)`. The test rail's **Live data** controls exercise add, remove, and recurring updates.

Layers are groupings with an ID, label, and optional display metadata; they do not determine node geometry. Set `shape` on each node to `cylinder`, `box`, `hexagon`, or `panel`. Nodes without a shape use `box`. The exported `graphNodeShapes` array lists supported values. Nodes with different shapes can share a layer.

The canvas includes a floating 3D, Top, Side, and Front toolbar. Without a `view` prop it manages the current view itself. To control the view from your app, pass `view` and update it in `onViewChange`; the callback also fires when orbiting away from a focused top view. Camera view changes ease over 900 ms; selecting a layer eases into its top view over 1100 ms. In a focused top view, higher layers fade out and lower layers remain faint. Rotating away from overhead restores the full stack. Pass a new `cameraRequestKey` value to recenter the camera when the selected view and layer have not changed; clicking the active toolbar view also recenters it.

When mounted in the default 3D view, the graph opens on the top shelf, pauses briefly, then eases into the full 3D stack. This plays once per mount and does not replay for data updates. Set `introAnimation={false}` to start directly in the requested view.

`layerSpacing` controls vertical separation (Y axis). `layerZSpacing` spreads the shelves evenly along the Z axis around the stack's center; its default is `0`, and negative values reverse the spread direction. The test rail exposes both spacing controls, with a depth range of −600 to +600.
