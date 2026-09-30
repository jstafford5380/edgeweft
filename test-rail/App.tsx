import { useEffect, useMemo, useState } from 'react';
import { DependencyGraph, type GraphData, type GraphEdge, type GraphEdgeType, type GraphMode, type GraphView } from '../src';
import { leftExampleEdges, leftExampleNodes, sampleGraph } from './sampleGraph';
import './style.css';

const relationships: { id: GraphEdgeType; label: string; span: string; line: string }[] = [
  { id: 'dependency', label: 'Dependencies', span: 'in layer', line: 'solid' },
  { id: 'call', label: 'Calls', span: 'cross-layer', line: 'dashed' },
  { id: 'resource', label: 'Resource usage', span: '→ L0', line: 'dotted' },
  { id: 'association', label: 'Associations', span: '↔ 2D', line: 'dashed' },
];
type TextMode = 'automatic' | 'custom' | 'hidden';

export function App() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visibleLayerIds, setVisibleLayerIds] = useState(sampleGraph.layers.map((layer) => layer.id));
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<GraphEdgeType[]>(relationships.map((type) => type.id));
  const [showLeftExample, setShowLeftExample] = useState(false);
  const [flow, setFlow] = useState(true);
  const [glowIntensity, setGlowIntensity] = useState(0.65);
  const [baseColor, setBaseColor] = useState('#968ae0');
  const [mode, setMode] = useState<GraphMode>('dark');
  const [shelfOpacity, setShelfOpacity] = useState(0.32);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [titleMode, setTitleMode] = useState<TextMode>('automatic');
  const [descriptionMode, setDescriptionMode] = useState<TextMode>('automatic');
  const [customTitle, setCustomTitle] = useState('System architecture');
  const [customDescription, setCustomDescription] = useState('Explore the relationships in this system.');
  const [autoLayout, setAutoLayout] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [liveUpdates, setLiveUpdates] = useState(false);
  const [layerSpacing, setLayerSpacing] = useState(240);
  const [layerZSpacing, setLayerZSpacing] = useState(0);
  const [view, setView] = useState<GraphView>('3d');
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>('components');
  const [cameraRequestKey, setCameraRequestKey] = useState(0);
  const graphData = useMemo<GraphData>(() => {
    const nodes = autoLayout
      ? sampleGraph.nodes.map(({ id, label, layerId, shape, subtitle }) => ({ id, label, layerId, shape, subtitle }))
      : sampleGraph.nodes;
    return {
      ...sampleGraph,
      nodes: [...nodes, ...(showLeftExample ? leftExampleNodes : []), ...Array.from({ length: liveCount }, (_, index) => ({
        id: `live-${index + 1}`, label: `live-service-${index + 1}`, layerId: 'components',
        shape: (['cylinder', 'box', 'hexagon', 'panel'] as const)[index], subtitle: 'Live snapshot',
      }))],
      edges: [...sampleGraph.edges, ...(showLeftExample ? leftExampleEdges : []), ...Array.from({ length: liveCount }, (_, index): GraphEdge => ({
        source: `live-${index + 1}`, target: 'orders', type: 'dependency',
      }))],
    };
  }, [autoLayout, liveCount, showLeftExample]);
  useEffect(() => {
    if (!liveUpdates) return;
    const timer = window.setInterval(() => setLiveCount((count) => (count + 1) % 5), 1800);
    return () => window.clearInterval(timer);
  }, [liveUpdates]);

  function selectView(nextView: GraphView) {
    setView(nextView);
    setCameraRequestKey((key) => key + 1);
  }

  function toggleLayer(id: string) {
    setVisibleLayerIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleType(id: GraphEdgeType) {
    setVisibleEdgeTypes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <div className="rail">
    <header className="rail-nav"><div className="rail-brand"><span>▱</span> System graph</div></header>
    <main className="rail-main">
      <aside className="rail-sidebar">
        <section><h2>Layers</h2>{[...sampleGraph.layers].filter((layer) => !layer.type || layer.type === 'default').reverse().map((layer) => {
          const count = graphData.nodes.filter((node) => node.layerId === layer.id).length;
          const active = visibleLayerIds.includes(layer.id);
          return <div className={`rail-row${active ? '' : ' is-muted'}`} key={layer.id}>
            <button className="rail-row-main" onClick={() => { setFocusedLayerId(layer.id); selectView('top'); if (!active) toggleLayer(layer.id); }} title={`Top view of ${layer.label}`}>
              <span className="rail-key">{layer.key}</span><span className="rail-symbol">▱</span><span className="rail-name">{layer.label}</span><span className="rail-count">{count}</span>
            </button><button className="rail-eye" onClick={() => toggleLayer(layer.id)} aria-label={`${active ? 'Hide' : 'Show'} ${layer.label}`}>{active ? '◉' : '○'}</button>
          </div>;
        })}</section>
        <section><h2>2D groups</h2>{sampleGraph.layers.filter((layer) => layer.type === 'right2d' || layer.id === 'external').map((layer) => {
          const active = visibleLayerIds.includes(layer.id) && (layer.id !== 'external' || showLeftExample);
          const count = graphData.nodes.filter((node) => node.layerId === layer.id).length;
          return <button key={layer.id} className={`rail-row rail-flat${active ? '' : ' is-muted'}`} onClick={() => {
            if (layer.id === 'external') {
              setShowLeftExample(!showLeftExample);
              if (!visibleLayerIds.includes(layer.id)) setVisibleLayerIds((current) => [...current, layer.id]);
            } else toggleLayer(layer.id);
          }} aria-pressed={active}>
            <span className="rail-key">{layer.type === 'left2d' ? 'L' : 'R'}</span><span className="rail-symbol">▱</span>
            <span className="rail-name">{layer.label}</span><span className="rail-count">{count}</span><span className="rail-eye">{active ? '◉' : '○'}</span>
          </button>;
        })}</section>
        <section><h2>Relationships</h2>{relationships.map((type) => <button key={type.id} className={`rail-relation${visibleEdgeTypes.includes(type.id) ? '' : ' is-muted'}`} onClick={() => toggleType(type.id)}>
          <span className={`rail-line ${type.line}`} /><span>{type.label}</span><small>{type.span}</small><span className="rail-check">{visibleEdgeTypes.includes(type.id) ? '☑' : '□'}</span>
        </button>)}<button className={`rail-relation${flow ? '' : ' is-muted'}`} onClick={() => setFlow(!flow)} aria-label="Animated call flow" aria-pressed={flow}>
          <span className="rail-line solid" /><span>Call flow</span><small>source → target</small><span className="rail-check">{flow ? '☑' : '□'}</span>
        </button></section>
        <section className="rail-config"><h2>Appearance</h2>
          <label className="rail-config-field">Mode
            <select aria-label="Graph mode" value={mode} onChange={(event) => setMode(event.target.value as GraphMode)}>
              <option value="dark">Dark</option><option value="light">Light</option>
            </select>
          </label>
          <label className="rail-config-field">Base color
            <input aria-label="Base color" type="color" value={baseColor}
              onInput={(event) => setBaseColor(event.currentTarget.value)} onChange={(event) => setBaseColor(event.target.value)} />
          </label>
          <label className="rail-config-field">Glow intensity
            <input aria-label="Glow intensity" type="number" min="0" max="2" step="0.05" value={glowIntensity}
              onChange={(event) => setGlowIntensity(Math.max(0, Math.min(2, Number(event.target.value))))} />
          </label>
          <label className="rail-config-field">Shelf opacity
            <input aria-label="Shelf opacity" type="number" min="0" max="1" step="0.01" value={shelfOpacity}
              onChange={(event) => setShelfOpacity(Math.max(0, Math.min(1, Number(event.target.value))))} />
          </label>
          {([
            ['Grid', showGrid, setShowGrid],
            ['Node labels', showLabels, setShowLabels],
            ['Legend', showLegend, setShowLegend],
          ] as const).map(([label, enabled, setEnabled]) =>
            <button key={label} className={`rail-relation${enabled ? '' : ' is-muted'}`}
              onClick={() => setEnabled(!enabled)} aria-pressed={enabled}>
              <span>{label}</span><span className="rail-check">{enabled ? '☑' : '□'}</span>
            </button>)}
          <label className="rail-config-field">Title
            <select aria-label="Title mode" value={titleMode} onChange={(event) => setTitleMode(event.target.value as TextMode)}>
              <option value="automatic">Automatic</option><option value="custom">Custom</option><option value="hidden">Hidden</option>
            </select>
          </label>
          {titleMode === 'custom' && <input className="rail-config-text" aria-label="Custom title" value={customTitle}
            onChange={(event) => setCustomTitle(event.target.value)} />}
          <label className="rail-config-field">Description
            <select aria-label="Description mode" value={descriptionMode} onChange={(event) => setDescriptionMode(event.target.value as TextMode)}>
              <option value="automatic">Automatic</option><option value="custom">Custom</option><option value="hidden">Hidden</option>
            </select>
          </label>
          {descriptionMode === 'custom' && <input className="rail-config-text" aria-label="Custom description" value={customDescription}
            onChange={(event) => setCustomDescription(event.target.value)} />}
        </section>
        <section className="rail-controls"><h2>Layer spacing <span>{layerSpacing}</span></h2><input aria-label="Layer spacing" type="range" min="140" max="400" step="10" value={layerSpacing} onChange={(event) => setLayerSpacing(Number(event.target.value))} /></section>
        <section className="rail-controls"><h2>Depth spacing <span>{layerZSpacing}</span></h2><input aria-label="Depth spacing" type="range" min="-600" max="600" step="10" value={layerZSpacing} onChange={(event) => setLayerZSpacing(Number(event.target.value))} /></section>
        <section><h2>Placement</h2><button className={`rail-relation${autoLayout ? '' : ' is-muted'}`} onClick={() => setAutoLayout(!autoLayout)} aria-pressed={autoLayout}>
          <span className="rail-line solid" /><span>Auto layout</span><span className="rail-check">{autoLayout ? '☑' : '□'}</span>
        </button></section>
        <section><h2>Live data <span>{liveCount} added</span></h2>
          <button className="rail-relation" onClick={() => setLiveCount((count) => Math.min(4, count + 1))}>Add service</button>
          <button className="rail-relation" onClick={() => setLiveCount((count) => Math.max(0, count - 1))}>Remove service</button>
          <button className={`rail-relation${liveUpdates ? '' : ' is-muted'}`} onClick={() => setLiveUpdates(!liveUpdates)} aria-pressed={liveUpdates}>Auto updates {liveUpdates ? '☑' : '□'}</button>
          {liveCount > 0 && <button className="rail-relation" onClick={() => setSelectedNodeId(`live-${liveCount}`)}>Select latest</button>}
        </section>
        <div className="rail-help">Drag to orbit · Shift-drag to pan<br />Scroll to zoom<br />Choose a layer for its top view</div>
      </aside>
      <div className="rail-content"><DependencyGraph data={graphData} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId}
        visibleLayerIds={visibleLayerIds} visibleEdgeTypes={visibleEdgeTypes}
        layerSpacing={layerSpacing} layerZSpacing={layerZSpacing}
        view={view} focusedLayerId={focusedLayerId} cameraRequestKey={cameraRequestKey} onViewChange={setView} flow={flow}
        baseColor={baseColor} mode={mode}
        glowIntensity={glowIntensity} shelfOpacity={shelfOpacity} showGrid={showGrid} showLabels={showLabels} showLegend={showLegend}
        title={titleMode === 'automatic' ? undefined : titleMode === 'hidden' ? null : customTitle}
        description={descriptionMode === 'automatic' ? undefined : descriptionMode === 'hidden' ? null : customDescription} /></div>
    </main>
  </div>;
}
