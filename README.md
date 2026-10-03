# Edgeweft

An interactive, layered 3D dependency graph for React. Render directed relationships across WebGL shelves and optional 2D side rails, with camera presets, selection highlighting, and animated call flow.

![Edgeweft in 3D view with four shelves and a 2D side rail](https://raw.githubusercontent.com/jstafford5380/edgeweft/main/assets/dependency-graph-3d.jpg)

## Install

```bash
npm install edgeweft react react-dom three
```

React 19, React DOM 19, and Three.js are peer dependencies. Import the package stylesheet alongside the component.

## Quick start

```tsx
import { DependencyGraph, type GraphData } from 'edgeweft';
import 'edgeweft/style.css';

const data: GraphData = {
  layers: [
    { id: 'services', key: 'L1', label: 'Services' },
    { id: 'teams', label: 'Teams', type: 'right2d' },
  ],
  nodes: [
    { id: 'api', label: 'API', layerId: 'services', shape: 'box' },
    { id: 'platform', label: 'Platform', layerId: 'teams', subtitle: 'Maintainer team' },
  ],
  edges: [{ source: 'api', target: 'platform', type: 'association' }],
};

<div style={{ height: 600 }}>
  <DependencyGraph data={data} />
</div>;
```

The component includes gridded 3D shelves, optional left and right 2D rails, relationship lines, animated call flow, bloom, and camera presets. The test rail adapts the v3 prototype fixture. Each edge is directed from `source` to `target`; only `call` edges show a flow particle traveling in that direction, including calls to 2D nodes. Set `flow={false}` to turn off the particles.

Set `GraphLayer.type` to `left2d` or `right2d` to place its nodes in a side rail; omit it or use `default` for a 3D shelf. Several layers can share a rail, each with its own heading. Rails disappear when they contain no visible nodes and stack below the canvas when the component is narrow. `visibleLayerIds` applies to both 3D and 2D layers. Side nodes use the same `GraphNode` and `GraphEdge` types as 3D nodes; their `x`, `z`, and `shape` fields are ignored. The old owner-specific types and `showOwners` prop have been removed.

Appearance and relationship visibility are controlled through component props:

```tsx
<DependencyGraph
  data={data}
  mode={appMode}
  baseColor="#968ae0"
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

`mode="dark" | "light"` lets the host app control the graph's appearance at runtime; it defaults to `dark` and does not depend on the host's CSS theme. `GraphMode` is exported for typed state. `baseColor` accepts a CSS hex color (`#RGB` or `#RRGGBB`) and defaults to `#968ae0`. Both modes derive their shelf, node, link, background, label, and control shades from it. `glowIntensity` defaults to `0.65` and accepts values from `0` (off) to `2`; `bloom={false}` also disables it. Light mode uses a gentler bloom strength so lines remain readable. `shelfOpacity` controls the shelf fill from `0` (fully transparent) to `1` (opaque) and defaults to the original `0.32`. Shelf outlines and the front edge scale with it relative to that default. `showGrid` separately controls both shelf and ground grid lines. Edge types are limited to `dependency`, `call`, `resource`, and `association`; `GraphEdgeType` and `graphEdgeTypes` expose that set to consumers. An omitted edge type means `dependency`. `visibleEdgeTypes` filters those categories. `flow`, `showLabels`, and `showLegend` default to `true`. For `title` and `description`, `undefined` uses the automatic text for the current view, a string sets custom text, and `null` hides it.

On 3D layers, node `x` and `z` coordinates are optional. Missing positions are laid out deterministically on collision-safe slots within each layer; the layout improves edge length and projected crossings, and shelves grow to fit dense layers. Supplying both coordinates pins a node in place. The exported `layoutGraph(data)` helper returns only 3D nodes with resolved positions and shelf dimensions. The test rail's **Auto layout** switch applies this to the prototype graph.

Pass a new, immutable `GraphData` snapshot to update the graph. Keep layer and node IDs stable across snapshots; give edges an `id` when their endpoints or type may change. Existing automatic node positions are retained where possible. When a node's position changes, the node and its connectors ease to the new position; new nodes appear at their assigned positions. Removing a selected ID clears the selection through `onSelectNode(null)`. The test rail's **Live data** controls exercise add, remove, and recurring updates.

Selecting a node emphasizes that node and every node reachable by following outgoing edges, including links between 3D shelves and 2D rails. Incoming dependents remain dim unless they are also reachable downstream. Call-flow particles run only on emphasized edges while a node is selected. The active `visibleEdgeTypes` filter limits traversal. `getDownstreamNodes(nodeId, edges, visibleEdgeTypes?)` exposes the same traversal for app logic; `getConnectedNodes` retains its direct, direction-agnostic behavior.

The test rail's Owner associations point from each Owner node to its entities, so selecting an Owner highlights those entities and their recursive downstream relationships.

Layers are groupings with an ID, label, and optional display metadata; their `type` controls placement. On 3D layers, set `shape` on each node to `cylinder`, `box`, `hexagon`, or `panel`. Nodes without a shape use `box`. The exported `graphNodeShapes` array lists supported values. Nodes with different shapes can share a layer.

The canvas includes a floating 3D, Top, Side, and Front toolbar. Without a `view` prop it manages the current view itself. To control the view from your app, pass `view` and update it in `onViewChange`; the callback also fires when orbiting away from a focused top view. Camera view changes ease over 900 ms; selecting a layer eases into its top view over 1100 ms. In a focused top view, higher layers fade out and lower layers remain faint. Rotating away from overhead restores the full stack. Pass a new `cameraRequestKey` value to recenter the camera when the selected view and layer have not changed; clicking the active toolbar view also recenters it.

When mounted in the default 3D view, the graph opens on the top shelf, pauses briefly, then eases into the full 3D stack. This plays once per mount and does not replay for data updates. Set `introAnimation={false}` to start directly in the requested view.

`layerSpacing` controls vertical separation (Y axis). `layerZSpacing` spreads the shelves evenly along the Z axis around the stack's center; its default is `0`, and negative values reverse the spread direction. The test rail exposes both spacing controls, with a depth range of −600 to +600.

## Run the test rail

```bash
npm install
npm run dev
```

Open [http://localhost:5174/](http://localhost:5174/). The rail imports the package source from `src/` and uses sample graph data.

## Build and check the package

```bash
npm run typecheck
npm test
npm run build
npm run pack:check
```

The build writes ESM, TypeScript declarations, and CSS to `dist/`. The package exports `DependencyGraph`, graph data types, and graph helpers. React Three Fiber renders the scene through WebGL.

## Publish to npm

The [publish workflow](.github/workflows/publish-npm.yml) runs after a pull request is merged into `main`. It publishes `edgeweft` under the `beta` npm dist-tag with a unique version based on the base version in `package.json`, the workflow run number, and the run attempt. For example, a `0.1.0-beta.0` manifest can produce `0.1.0-beta.42.1`. Bump the manifest's base version when starting a new release line.

Push a tag such as `1.5.0-release` on a commit in `main` to publish stable version `1.5.0` under npm's `latest` dist-tag. The `-release` suffix is part of the Git tag only. Both paths run typecheck, tests, build, and package-content checks before publishing.

The workflow uses the GitHub Actions repository secret `NPM_TOKEN`, which must belong to an npm account allowed to publish `edgeweft`. Its first publish claims the currently unclaimed package name. Publishing includes [npm provenance](https://docs.npmjs.com/generating-provenance-statements/).

For a local dry run, use `npm run release -- --dry-run`. The local release script can also publish manually with an exported `NPM_KEY` and, for prereleases, `--tag beta`.

## License

Edgeweft is licensed under [MPL-2.0](LICENSE).
