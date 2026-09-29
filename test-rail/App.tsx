import { useState } from 'react';
import { DependencyGraph, type GraphView } from '../src';
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
  const [layerSpacing, setLayerSpacing] = useState(240);
  const [view, setView] = useState<GraphView>('3d');
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>('components');

  function toggleLayer(id: string) {
    setVisibleLayerIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function toggleType(id: string) {
    setVisibleEdgeTypes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <div className="rail">
    <header className="rail-nav"><div className="rail-brand"><span>▱</span> System graph</div>
      <nav className="rail-views" aria-label="Camera view">{(['3d', 'top', 'side', 'front'] as GraphView[]).map((option) =>
        <button key={option} className={view === option ? 'active' : ''} onClick={() => setView(option)}>{option === '3d' ? '◈' : option === 'top' ? '▣' : option === 'side' ? '☷' : '▥'} {option === '3d' ? '3D' : option[0].toUpperCase() + option.slice(1)}</button>)}</nav>
    </header>
    <main className="rail-main">
      <aside className="rail-sidebar">
        <section><h2>Layers</h2>{[...sampleGraph.layers].reverse().map((layer) => {
          const count = sampleGraph.nodes.filter((node) => node.layerId === layer.id).length;
          const active = visibleLayerIds.includes(layer.id);
          return <div className={`rail-row${active ? '' : ' is-muted'}`} key={layer.id}>
            <button className="rail-row-main" onClick={() => { setFocusedLayerId(layer.id); setView('top'); if (!active) toggleLayer(layer.id); }} title={`Top view of ${layer.label}`}>
              <span className="rail-key">{layer.key}</span><span className="rail-symbol">{layer.id === 'resources' ? '◉' : layer.id === 'components' ? '⬡' : layer.id === 'bffs' ? '⬢' : '▣'}</span><span className="rail-name">{layer.label}</span><span className="rail-count">{count}</span>
            </button><button className="rail-eye" onClick={() => toggleLayer(layer.id)} aria-label={`${active ? 'Hide' : 'Show'} ${layer.label}`}>{active ? '◉' : '○'}</button>
          </div>;
        })}</section>
        <section><h2>2D group</h2><button className={`rail-row rail-flat${showOwners ? '' : ' is-muted'}`} onClick={() => setShowOwners(!showOwners)}>
          <span className="rail-key">2D</span><span className="rail-symbol">◎</span><span className="rail-name">Owners</span><span className="rail-count">{sampleGraph.owners?.length}</span><span className="rail-eye">{showOwners ? '◉' : '○'}</span>
        </button></section>
        <section><h2>Relationships</h2>{relationships.map((type) => <button key={type.id} className={`rail-relation${visibleEdgeTypes.includes(type.id) ? '' : ' is-muted'}`} onClick={() => toggleType(type.id)}>
          <span className={`rail-line ${type.line}`} /><span>{type.label}</span><small>{type.span}</small><span className="rail-check">{visibleEdgeTypes.includes(type.id) ? '☑' : '□'}</span>
        </button>)}</section>
        <section className="rail-controls"><h2>Layer spacing <span>{layerSpacing}</span></h2><input aria-label="Layer spacing" type="range" min="140" max="400" step="10" value={layerSpacing} onChange={(event) => setLayerSpacing(Number(event.target.value))} /></section>
        <div className="rail-help">Drag to orbit · Shift-drag to pan<br />Scroll to zoom<br />Choose a layer for its top view</div>
      </aside>
      <div className="rail-content"><DependencyGraph data={sampleGraph} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId}
        visibleLayerIds={visibleLayerIds} visibleEdgeTypes={visibleEdgeTypes} showOwners={showOwners} layerSpacing={layerSpacing}
        view={view} focusedLayerId={focusedLayerId} /></div>
    </main>
  </div>;
}
