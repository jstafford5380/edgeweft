# Edgeweft

An interactive, layered 3D dependency graph for React. Render directed relationships across WebGL shelves and optional 2D side rails, with camera presets, selection highlighting, and animated call flow.

![Edgeweft in 3D view with four shelves and a 2D side rail](https://raw.githubusercontent.com/jstafford5380/edgeweft/main/assets/dependency-graph-3d.jpg)

## Install

```bash
npm install @provausio/edgeweft@beta react react-dom three
```

React 19, React DOM 19, and Three.js are peer dependencies. Import the package stylesheet alongside the component. Once a stable release is available, omit `@beta` to install the `latest` version.

## Quick start

```tsx
import { DependencyGraph, type GraphData } from '@provausio/edgeweft';
import '@provausio/edgeweft/style.css';

const data: GraphData = {
  layers: [
    { id: 'services', key: 'L1', label: 'Services', color: '#33bb99' },
    { id: 'teams', label: 'Teams', type: 'right2d', color: '#e0a050' },
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

Give the graph a container with a height. Without selection props it shows the full, undimmed graph. The camera toolbar works on its own; callbacks are optional.

## Data model

`GraphData` contains `layers`, `nodes`, and `edges` arrays. Keep IDs stable between updates and pass a new `data` object for each changed snapshot.

| Layer field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Required unique ID referenced by nodes. |
| `label` | `string` | Required display name. |
| `type` | `'default' \| 'left2d' \| 'right2d'` | Omit for a 3D shelf. Side layers appear in the left or right rail. |
| `key` | `string` | Short key shown with a 3D shelf label; defaults to the layer ID. |
| `description` | `string` | Text beside a shelf label or below a side rail heading. |
| `color` | `string` | `#RGB` or `#RRGGBB` accent. Tints the shelf, nodes, labels, and outgoing links in 3D; accents the rail heading and outgoing links in 2D. Omit to use `baseColor`. |

| Node field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Required unique ID referenced by edges and selection. |
| `label` | `string` | Required display name. |
| `layerId` | `string` | Required ID of the containing layer. |
| `subtitle` | `string` | Secondary text in 2D rows and selected-node details. |
| `shape` | `'cylinder' \| 'box' \| 'hexagon' \| 'panel'` | 3D shape; defaults to `box` and is ignored in 2D. `graphNodeShapes` lists the values. |
| `x`, `z` | `number` | Supply both to pin a 3D node in scene units. Omit both for automatic placement; ignored in 2D. |

| Edge field | Type | Description |
| --- | --- | --- |
| `source`, `target` | `string` | Required node IDs. Edges are directed from source to target. |
| `type` | `'dependency' \| 'call' \| 'resource' \| 'association'` | Defaults to `dependency`. Only `call` edges animate flow toward the target. `graphEdgeTypes` lists the values. |
| `id` | `string` | Stable edge ID, recommended if edges can be reordered or updated. |

The order of 3D layers in `layers` is bottom to top. Side rail layers appear top to bottom, and several layers can share a rail. Rails disappear when they have no visible nodes and stack below the canvas in narrow containers. `validateGraph(data)` returns errors for invalid IDs, references, positions, shapes, types, and layer colors.

Missing 3D positions are laid out automatically. `layoutGraph(data, previousLayout?)` returns resolved 3D nodes, shelf dimensions, and automatically placed IDs; pass a previous result to preserve positions across snapshots. The component does this internally and animates nodes and connectors when positions change.

## Component options

All props except `data` are optional. `DependencyGraphProps` and the related types are exported from the package.

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `data` | `GraphData` | Required | Graph snapshot to render. |
| `selectedNodeId` | `string \| null` | `null` | Controls selection. With no selection, nothing is dimmed. |
| `onSelectNode` | `(id: string \| null) => void` | No-op | Reports node clicks, background clicks, clear-selection clicks, or removal of the selected ID. It does not set selection itself. |
| `visibleLayerIds` | `string[]` | All layers | Shows only these layer IDs; `[]` hides all layers. Applies to shelves and rails. |
| `visibleEdgeTypes` | `GraphEdgeType[]` | All types | Shows only these edge categories; `[]` hides all edges. Untyped edges count as `dependency`. |
| `layerSpacing` | `number` | `240` | Vertical distance between 3D shelves, in scene units. |
| `layerZSpacing` | `number` | `0` | Depth spread between shelves; negative values reverse the spread. |
| `view` | `GraphView` | Internal `3d` view | Controls the camera preset: `3d`, `top`, `side`, or `front`. Omit to use the toolbar's internal view state. |
| `focusedLayerId` | `string \| null` | `null` | Layer to focus in the top view. Without one, top view uses the second 3D layer, or the first if only one exists. |
| `cameraRequestKey` | `number` | `0` | Change the value to replay the camera move to the current view or layer. |
| `onViewChange` | `(view: GraphView) => void` | No-op | Reports toolbar choices and rotation away from a focused top view. Pass `view` too if the parent should control the active preset. |
| `mode` | `GraphMode` | `'dark'` | `'dark'` or `'light'`; independent of the host app's CSS theme. |
| `baseColor` | `string` | `'#968ae0'` | `#RGB` or `#RRGGBB` color used to derive the default scene and UI palette. |
| `shelfOpacity` | `number` | `0.32` | Shelf fill and relative border opacity, clamped to `0`–`1`. |
| `showGrid` | `boolean` | `true` | Shows shelf and ground grids. |
| `showLabels` | `boolean` | `true` | Shows 3D node and shelf labels. |
| `showLegend` | `boolean` | `true` | Shows the shape and edge legend. |
| `flow` | `boolean` | `true` | Animates particles on directed `call` edges. |
| `bloom` | `boolean` | `true` | Enables the glow pass. |
| `glowIntensity` | `number` | `0.65` | Glow strength, clamped to `0`–`2`; `0` disables glow. |
| `title` | `string \| null` | Automatic | Heading title; `null` hides it. |
| `description` | `string \| null` | Automatic | Heading description; `null` hides it. |
| `introAnimation` | `boolean` | `true` in 3D | Plays the opening top-shelf-to-3D camera move once per mount. |
| `className` | `string` | None | Additional class on the root element for host styling. |

For `title` and `description`, `undefined` uses text based on the current view; `null` hides it. `baseColor` colors the overall scene and UI, while a layer's `color` overrides the accent of that layer. `shelfOpacity` also scales shelf outlines and the front edge. Light mode reduces bloom strength for readability.

For example, this shows two layer and edge categories with a light palette and no glow:

```tsx
<DependencyGraph
  data={data}
  visibleLayerIds={['services', 'teams']}
  visibleEdgeTypes={['dependency', 'association']}
  mode="light"
  baseColor="#33bb99"
  bloom={false}
  showGrid={false}
  title="Service ownership"
  description={null}
/>
```

## Callbacks and controlled state

`onSelectNode` is safe to omit. Without `selectedNodeId`, a click can still notify your app, but the graph remains in its overview state until you pass an ID back. Use the callback alone for analytics or navigation:

```tsx
<DependencyGraph
  data={data}
  onSelectNode={(id) => {
    if (id) console.log('Clicked node:', id);
  }}
/>
```

To show selection highlighting and the built-in details card, keep the selected ID in React state. `null` clears it:

```tsx
import { useState } from 'react';
import { DependencyGraph, type GraphData } from '@provausio/edgeweft';
import '@provausio/edgeweft/style.css';

function SelectableGraph({ data }: { data: GraphData }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  return <div style={{ height: 600 }}>
    <DependencyGraph
      data={data}
      selectedNodeId={selectedNodeId}
      onSelectNode={setSelectedNodeId}
    />
  </div>;
}
```

Selection highlights the node and every node reachable through outgoing edges, including links to side rails. Incoming dependents are dimmed unless reachable from the selected node. `visibleEdgeTypes` limits this traversal. The exported `getDownstreamNodes(nodeId, edges, visibleEdgeTypes?)` helper performs the same directed search; `getConnectedNodes` returns immediate neighbors regardless of direction.

The camera toolbar manages its own view when `view` is omitted. To control it from a parent, update `view` in `onViewChange`. The callback also reports `3d` when the user rotates away from a focused top view:

```tsx
import { useState } from 'react';
import { DependencyGraph, type GraphData, type GraphView } from '@provausio/edgeweft';
import '@provausio/edgeweft/style.css';

function CameraGraph({ data }: { data: GraphData }) {
  const [view, setView] = useState<GraphView>('3d');
  const [cameraRequestKey, setCameraRequestKey] = useState(0);

  return <div>
    <button onClick={() => setCameraRequestKey((key) => key + 1)}>Recenter</button>
    <div style={{ height: 600 }}>
      <DependencyGraph
        data={data}
        view={view}
        onViewChange={setView}
        focusedLayerId="services"
        cameraRequestKey={cameraRequestKey}
      />
    </div>
  </div>;
}
```

With no callback, toolbar changes still work in the uncontrolled view. When controlled, the parent must update `view` for a toolbar choice to take effect. The opening camera move plays only when mounted in the initial 3D view; set `introAnimation={false}` to skip it.

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

The [publish workflow](.github/workflows/publish-npm.yml) runs after a push to `main`, whether it is a direct push or a merged pull request. It publishes `@provausio/edgeweft` under the `beta` npm dist-tag with a unique version based on the base version in `package.json`, the workflow run number, and the run attempt. For example, a `0.1.0-beta.0` manifest can produce `0.1.0-beta.42.1`. Bump the manifest's base version when starting a new release line.

Push a tag such as `1.5.0-release` on a commit in `main` to publish stable version `1.5.0` under npm's `latest` dist-tag. The `-release` suffix is part of the Git tag only. Both paths run typecheck, tests, build, and package-content checks before publishing.

You can also run **Publish npm package** from GitHub Actions on `main`. Choose `prerelease` for a new beta version, or choose `release` and enter a stable version such as `1.5.0`. The workflow rejects manual runs from other refs and rejects a release without a valid version. Do not publish the same stable version again with a release tag; npm versions cannot be reused.

The workflow publishes through the npm trusted publisher configured for `@provausio/edgeweft`. In the package's npm settings, the GitHub Actions publisher must specify GitHub owner `jstafford5380`, repository `edgeweft`, and workflow filename `publish-npm.yml`, with **Allow npm publish** enabled. The workflow uses GitHub's OIDC identity and includes [npm provenance](https://docs.npmjs.com/trusted-publishers/); it does not require an `NPM_TOKEN` secret.

For a local dry run, use `npm run release -- --dry-run`. The local release script can also publish manually with an exported `NPM_KEY` and, for prereleases, `--tag beta`.

## License

Edgeweft is licensed under [MPL-2.0](LICENSE).
