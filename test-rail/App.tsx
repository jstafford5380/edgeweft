import { useEffect, useMemo, useState } from 'react';
import { DependencyGraph, type GraphData, type GraphView } from '../src';
import { sampleGraph } from './sampleGraph';
import './style.css';

const relationships = [
  { id: 'dependency', label: 'Dependencies', span: 'in layer', line: 'solid' },
  { id: 'call', label: 'Calls', span: 'cross-layer', line: 'dashed' },
  { id: 'resource', label: 'Resource usage', span: '→ L0', line: 'dotted' },
];

export function App() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [visibleLayerIds, setVisibleLayerIds] = useState(sampleGraph.layers.map((layer) => layer.id));
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState(relationships.map((type) => type.id));
  const [showOwners, setShowOwners] = useState(true);
  const [flow, setFlow] = useState(true);
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
      ? sampleGraph.nodes.map(({ id, label, layerId, subtitle }) => ({ id, label, layerId, subtitle }))
      : sampleGraph.nodes;
    return {
      ...sampleGraph,
      nodes: [...nodes, ...Array.from({ length: liveCount }, (_, index) => ({
        id: `live-${index + 1}`, label: `live-service-${index + 1}`, layerId: 'components', subtitle: 'Live snapshot',
      }))],
      edges: [...sampleGraph.edges, ...Array.from({ length: liveCount }, (_, index) => ({
        source: `live-${index + 1}`, target: 'orders', type: 'dependency',
      }))],
    };
  }, [autoLayout, liveCount]);
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
  function toggleType(id: string) {
    setVisibleEdgeTypes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <div className="rail">
    <header className="rail-nav"><div className="rail-brand"><span>▱</span> System graph</div>
      <nav className="rail-views" aria-label="Camera view">{(['3d', 'top', 'side', 'front'] as GraphView[]).map((option) =>
        <button key={option} className={view === option ? 'active' : ''} onClick={() => selectView(option)}>{option === '3d' ? '◈' : option === 'top' ? '▣' : option === 'side' ? '☷' : '▥'} {option === '3d' ? '3D' : option[0].toUpperCase() + option.slice(1)}</button>)}</nav>
    </header>
    <main className="rail-main">
      <aside className="rail-sidebar">
        <section><h2>Layers</h2>{[...sampleGraph.layers].reverse().map((layer) => {
          const count = graphData.nodes.filter((node) => node.layerId === layer.id).length;
          const active = visibleLayerIds.includes(layer.id);
          return <div className={`rail-row${active ? '' : ' is-muted'}`} key={layer.id}>
            <button className="rail-row-main" onClick={() => { setFocusedLayerId(layer.id); selectView('top'); if (!active) toggleLayer(layer.id); }} title={`Top view of ${layer.label}`}>
              <span className="rail-key">{layer.key}</span><span className="rail-symbol">{layer.id === 'resources' ? '◉' : layer.id === 'components' ? '⬡' : layer.id === 'bffs' ? '⬢' : '▣'}</span><span className="rail-name">{layer.label}</span><span className="rail-count">{count}</span>
            </button><button className="rail-eye" onClick={() => toggleLayer(layer.id)} aria-label={`${active ? 'Hide' : 'Show'} ${layer.label}`}>{active ? '◉' : '○'}</button>
          </div>;
        })}</section>
        <section><h2>2D group</h2><button className={`rail-row rail-flat${showOwners ? '' : ' is-muted'}`} onClick={() => setShowOwners(!showOwners)}>
          <span className="rail-key">2D</span><span className="rail-symbol">◎</span><span className="rail-name">Owners</span><span className="rail-count">{sampleGraph.owners?.length}</span><span className="rail-eye">{showOwners ? '◉' : '○'}</span>
        </button></section>
        <section><h2>Relationships</h2>{relationships.map((type) => <button key={type.id} className={`rail-relation${visibleEdgeTypes.includes(type.id) ? '' : ' is-muted'}`} onClick={() => toggleType(type.id)}>
          <span className={`rail-line ${type.line}`} /><span>{type.label}</span><small>{type.span}</small><span className="rail-check">{visibleEdgeTypes.includes(type.id) ? '☑' : '□'}</span>
        </button>)}<button className={`rail-relation${flow ? '' : ' is-muted'}`} onClick={() => setFlow(!flow)} aria-label="Animated flow" aria-pressed={flow}>
          <span className="rail-line solid" /><span>Flow</span><small>source → target</small><span className="rail-check">{flow ? '☑' : '□'}</span>
        </button></section>
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
        visibleLayerIds={visibleLayerIds} visibleEdgeTypes={visibleEdgeTypes} showOwners={showOwners}
        layerSpacing={layerSpacing} layerZSpacing={layerZSpacing}
        view={view} focusedLayerId={focusedLayerId} cameraRequestKey={cameraRequestKey} onViewChange={setView} flow={flow} /></div>
    </main>
  </div>;
}
