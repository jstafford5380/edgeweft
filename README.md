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
  nodes: [{ id: 'api', label: 'API', layerId: 'services' }],
  edges: [],
};

<div style={{ height: 600 }}>
  <DependencyGraph data={data} />
</div>;
```

The component includes gridded 3D shelves, layer-specific node shapes, relationship lines, animated edge flow, bloom, camera presets, and an optional 2D owners panel. The test rail uses the full v3 prototype fixture. Each edge is directed from `source` to `target`; the flow particle travels in that direction. Set `flow={false}` to turn off the particles.

Node `x` and `z` coordinates are optional. Missing positions are laid out deterministically on collision-safe slots within each layer; the layout improves edge length and projected crossings, and shelves grow to fit dense layers. Supplying both coordinates pins a node in place. The exported `layoutGraph(data)` helper returns resolved node positions and shelf dimensions. The test rail's **Auto layout** switch applies this to the prototype graph.

Camera view changes ease over 900 ms; selecting a layer eases into its top view over 1100 ms. In a focused top view, higher layers fade out and lower layers remain faint. Rotating away from overhead restores the full stack; pass `onViewChange` to keep a controlled view selector in sync. Pass a new `cameraRequestKey` value to recenter the camera when the selected view and layer have not changed.

`layerSpacing` controls vertical separation (Y axis). `layerZSpacing` spreads the shelves evenly along the Z axis around the stack's center; its default is `0`, and negative values reverse the spread direction. The test rail exposes both spacing controls, with a depth range of −600 to +600.
