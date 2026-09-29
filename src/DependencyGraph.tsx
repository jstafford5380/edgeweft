import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Line, OrbitControls } from '@react-three/drei';
import { DoubleSide, Vector2, Vector3 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getConnectedNodes, validateGraph } from './graph';
import type { GraphData, GraphNode } from './types';
import './style.css';

export type GraphView = '3d' | 'top' | 'side' | 'front';

export interface DependencyGraphProps {
  data: GraphData;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string | null) => void;
  visibleLayerIds?: string[];
  visibleEdgeTypes?: string[];
  showOwners?: boolean;
  layerSpacing?: number;
  view?: GraphView;
  focusedLayerId?: string | null;
  bloom?: boolean;
  className?: string;
}

const W = 1080;
const D = 580;
const BG = '#10111e';
const grid = (() => {
  const values: number[] = [];
  for (let x = -W / 2 + 40; x < W / 2; x += 40) values.push(x, 0, -D / 2, x, 0, D / 2);
  for (let z = -D / 2 + 40; z < D / 2; z += 40) values.push(-W / 2, 0, z, W / 2, 0, z);
  return new Float32Array(values);
})();
const ground = (() => {
  const values: number[] = [];
  for (let x = -2000; x <= 2000; x += 50) values.push(x, 0, -2000, x, 0, 2000);
  for (let z = -2000; z <= 2000; z += 50) values.push(-2000, 0, z, 2000, 0, z);
  return new Float32Array(values);
})();

function CameraRig({ view, focus, spacing }: { view: GraphView; focus: number; spacing: number }) {
  const { camera, size } = useThree();
  const mid = spacing * 1.35;
  const target = view === 'top' && focus >= 0 ? focus * spacing : mid;
  useEffect(() => {
    const scale = Math.max(1.3, 1200 / Math.max(size.width, 1));
    if (view === 'top') camera.position.set(0, target + 1200 * scale, 1);
    else if (view === 'side') camera.position.set(1350 * scale, mid + 150, 0);
    else if (view === 'front') camera.position.set(0, mid + 150, 1500 * scale);
    else camera.position.set(-670 * scale, mid + 865 * scale, 1235 * scale);
    camera.lookAt(0, target, 0);
    camera.updateProjectionMatrix();
  }, [camera, view, focus, spacing, size.width, mid, target]);
  return <OrbitControls key={`${view}-${focus}`} target={[0, target, 0]} minDistance={300} maxDistance={4800} enableDamping />;
}

function Bloom({ enabled }: { enabled: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const engine = new EffectComposer(gl);
    engine.addPass(new RenderPass(scene, camera));
    const glow = new UnrealBloomPass(new Vector2(size.width, size.height), 0.36, 0.45, 0.55);
    engine.addPass(glow);
    engine.addPass(new OutputPass());
    return { engine, glow };
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.engine.setSize(size.width, size.height);
    composer.glow.strength = enabled ? 0.36 : 0;
  }, [composer, size.width, size.height, enabled]);
  useEffect(() => () => composer.engine.dispose(), [composer]);
  useFrame(() => composer.engine.render(), 1);
  return null;
}

function Shelf({ index, spacing }: { index: number; spacing: number }) {
  const y = index * spacing;
  const outline: [number, number, number][] = [
    [-W / 2, y + 5, -D / 2], [W / 2, y + 5, -D / 2], [W / 2, y + 5, D / 2],
    [-W / 2, y + 5, D / 2], [-W / 2, y + 5, -D / 2],
  ];
  return <group>
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[W, 8, D]} />
      <meshStandardMaterial color="#262a60" emissive="#423a6a" emissiveIntensity={0.5} metalness={0.2} roughness={0.5} transparent opacity={0.32} side={DoubleSide} depthWrite={false} />
    </mesh>
    <lineSegments position={[0, y + 5, 0]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[grid, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#9d90e7" transparent opacity={0.27} depthWrite={false} />
    </lineSegments>
    <Line points={outline} color="#9180e8" lineWidth={9} transparent opacity={0.13} />
    <Line points={outline} color="#d2cefd" lineWidth={1.8} transparent opacity={0.95} />
    <mesh position={[0, y + 5, D / 2]}>
      <boxGeometry args={[W, 1.8, 2]} />
      <meshBasicMaterial color="#b5abfc" transparent opacity={0.8} />
    </mesh>
  </group>;
}

function Node({ node, index, spacing, selected, dimmed, onSelect }: {
  node: GraphNode; index: number; spacing: number; selected: boolean; dimmed: boolean; onSelect: (id: string) => void;
}) {
  const kind = index === 0 ? 'resource' : index === 1 ? 'component' : index === 2 ? 'bff' : 'app';
  const rise = kind === 'resource' ? 16 : kind === 'app' ? 8 : 13;
  const opacity = dimmed ? 0.13 : 0.96;
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(node.id); };
  return <group position={[node.x, index * spacing + rise, node.z]}>
    <mesh onClick={click}>
      {kind === 'resource' ? <cylinderGeometry args={[17, 17, 24, 40]} />
        : kind === 'bff' ? <cylinderGeometry args={[22, 22, 18, 6]} />
          : kind === 'app' ? <boxGeometry args={[84, 7, 54]} />
            : <boxGeometry args={[92, 18, 30]} />}
      <meshStandardMaterial color={selected ? '#eee0ae' : kind === 'resource' ? '#595d6c' : '#796cbf'}
        emissive={selected ? '#d7ba5b' : '#968ae0'} emissiveIntensity={selected ? 0.8 : 0.55}
        metalness={0.3} roughness={0.34} transparent opacity={opacity} />
      <Edges threshold={20} color={selected ? '#fff1ba' : '#d2cefd'} />
    </mesh>
    {kind === 'app' && <mesh position={[0, 4, 0]}>
      <boxGeometry args={[72, 1, 40]} /><meshBasicMaterial color="#423a6a" transparent opacity={opacity} />
    </mesh>}
  </group>;
}

function SceneLabels({ data, indices, spacing, visible, selected, stage, nodeLabels, layerLabels }: {
  data: GraphData; indices: Map<string, number>; spacing: number; visible: Set<string>; selected: string | null;
  stage: React.RefObject<HTMLDivElement | null>;
  nodeLabels: React.RefObject<Map<string, HTMLDivElement>>;
  layerLabels: React.RefObject<Map<string, HTMLDivElement>>;
}) {
  const point = useMemo(() => new Vector3(), []);
  const related = useMemo(() => {
    if (!selected) return null;
    const set = getConnectedNodes(selected, data.edges);
    for (const link of data.ownership ?? []) {
      if (link.ownerId === selected) set.add(link.nodeId);
      if (link.nodeId === selected) set.add(link.ownerId);
    }
    return set;
  }, [selected, data.edges, data.ownership]);
  const tick = useRef(0);
  useFrame(({ camera }) => {
    if (++tick.current % 2 || !stage.current) return;
    const width = stage.current.clientWidth;
    const height = stage.current.clientHeight;
    for (const layer of data.layers) {
      const label = layerLabels.current.get(layer.id);
      if (!label) continue;
      if (!visible.has(layer.id)) { label.style.visibility = 'hidden'; continue; }
      const index = indices.get(layer.id) ?? 0;
      point.set(-W / 2, index * spacing + 5, D * 0.15).project(camera);
      label.style.visibility = point.z < -1 || point.z > 1 ? 'hidden' : 'visible';
      const x = (point.x + 1) / 2 * width;
      const y = (1 - point.y) / 2 * height;
      label.style.transform = `translate3d(${Math.max(8, x - label.offsetWidth - 18).toFixed(1)}px,${(y - label.offsetHeight / 2).toFixed(1)}px,0)`;
    }
    for (const node of data.nodes) {
      const label = nodeLabels.current.get(node.id);
      if (!label) continue;
      if (!visible.has(node.layerId)) { label.style.visibility = 'hidden'; continue; }
      const index = indices.get(node.layerId) ?? 0;
      const rise = index === 0 ? 49 : index === 2 ? 46 : index === 3 ? 31 : 36;
      point.set(node.x, index * spacing + rise, node.z).project(camera);
      label.style.visibility = point.z < -1 || point.z > 1 ? 'hidden' : 'visible';
      label.style.opacity = related && !related.has(node.id) ? '0.14' : '1';
      const x = (point.x + 1) / 2 * width;
      const y = (1 - point.y) / 2 * height;
      label.style.transform = `translate3d(${(x - label.offsetWidth / 2).toFixed(1)}px,${(y - label.offsetHeight / 2).toFixed(1)}px,0)`;
    }
  });
  return null;
}

type DomRefs = {
  board: React.RefObject<HTMLDivElement | null>;
  stage: React.RefObject<HTMLDivElement | null>;
  owners: React.RefObject<Map<string, HTMLSpanElement>>;
  paths: React.RefObject<Map<string, SVGPathElement>>;
};

function OwnerPaths({ data, indices, spacing, visible, selected, refs }: {
  data: GraphData; indices: Map<string, number>; spacing: number; visible: Set<string>;
  selected: string | null; refs: DomRefs;
}) {
  const vector = useMemo(() => new Vector3(), []);
  const nodes = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const tick = useRef(0);
  useFrame(({ camera }) => {
    if (++tick.current % 3 || !refs.board.current || !refs.stage.current) return;
    const board = refs.board.current.getBoundingClientRect();
    const stage = refs.stage.current.getBoundingClientRect();
    for (const link of data.ownership ?? []) {
      const path = refs.paths.current.get(`${link.nodeId}:${link.ownerId}`);
      const dot = refs.owners.current.get(link.ownerId);
      const node = nodes.get(link.nodeId);
      if (!path || !dot || !node) continue;
      if (!visible.has(node.layerId)) { path.setAttribute('d', ''); continue; }
      vector.set(node.x, (indices.get(node.layerId) ?? 0) * spacing + 18, node.z).project(camera);
      if (vector.z < -1 || vector.z > 1) { path.setAttribute('d', ''); continue; }
      const x1 = (vector.x + 1) / 2 * stage.width + stage.left - board.left;
      const y1 = (1 - vector.y) / 2 * stage.height + stage.top - board.top;
      const target = dot.getBoundingClientRect();
      const x2 = target.left - board.left + target.width / 2;
      const y2 = target.top - board.top + target.height / 2;
      const bend = Math.max(60, (x2 - x1) * 0.5);
      path.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)} C${(x1 + bend).toFixed(1)} ${y1.toFixed(1)} ${(x2 - bend).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      path.style.opacity = selected ? selected === link.nodeId || selected === link.ownerId ? '0.85' : '0.025' : '0.16';
    }
  });
  return null;
}

export function DependencyGraph({ data, selectedNodeId = null, onSelectNode, visibleLayerIds, visibleEdgeTypes,
  showOwners = true, layerSpacing = 240, view = '3d', focusedLayerId = null, bloom = true, className }: DependencyGraphProps) {
  const board = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const owners = useRef(new Map<string, HTMLSpanElement>());
  const paths = useRef(new Map<string, SVGPathElement>());
  const nodeLabels = useRef(new Map<string, HTMLDivElement>());
  const layerLabels = useRef(new Map<string, HTMLDivElement>());
  const errors = useMemo(() => validateGraph(data), [data]);
  const visible = useMemo(() => new Set(visibleLayerIds ?? data.layers.map((layer) => layer.id)), [visibleLayerIds, data.layers]);
  const edgeTypes = useMemo(() => new Set(visibleEdgeTypes ?? data.edges.map((edge) => edge.type ?? 'dependency')), [visibleEdgeTypes, data.edges]);
  const indices = useMemo(() => new Map(data.layers.map((layer, index) => [layer.id, index])), [data.layers]);
  const nodes = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const related = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = getConnectedNodes(selectedNodeId, data.edges);
    for (const link of data.ownership ?? []) {
      if (link.ownerId === selectedNodeId) set.add(link.nodeId);
      if (link.nodeId === selectedNodeId) set.add(link.ownerId);
    }
    return set;
  }, [selectedNodeId, data.edges, data.ownership]);
  const focus = focusedLayerId ? indices.get(focusedLayerId) ?? -1 : view === 'top' ? Math.min(1, data.layers.length - 1) : -1;
  const sceneVisible = view === 'top' && focus >= 0 ? new Set([data.layers[focus].id]) : visible;
  if (errors.length) return <div className="dgt-error" role="alert">Invalid graph: {errors.join('; ')}</div>;
  const selectedNode = selectedNodeId ? nodes.get(selectedNodeId) : undefined;
  const selectedOwner = data.owners?.find((owner) => owner.id === selectedNodeId);
  const showPanel = showOwners && !!data.owners?.length;
  const refs = { board, stage, owners, paths };
  return <div ref={board} className={`dgt-board${showPanel ? '' : ' no-owners'}${className ? ` ${className}` : ''}`}>
    <div ref={stage} className="dgt-stage">
      <Canvas camera={{ position: [-670, 1225, 1235], fov: 34, near: 5, far: 9000 }}
        gl={{ antialias: true, toneMappingExposure: 1.05 }} onPointerMissed={() => onSelectNode?.(null)}>
        <color attach="background" args={[BG]} /><fog attach="fog" args={[BG, 1900, 4200]} />
        <ambientLight intensity={1.1} /><directionalLight position={[-400, 900, 600]} intensity={1.7} />
        <pointLight position={[0, 300, 300]} intensity={18000} color="#968ae0" />
        <CameraRig view={view} focus={focus} spacing={layerSpacing} />
        <lineSegments position={[0, -100, 0]}>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[ground, 3]} /></bufferGeometry>
          <lineBasicMaterial color="#3e376d" transparent opacity={0.2} depthWrite={false} />
        </lineSegments>
        {data.layers.map((layer, index) => sceneVisible.has(layer.id) && <Shelf key={layer.id} index={index} spacing={layerSpacing} />)}
        {data.edges.map((edge, index) => {
          const a = nodes.get(edge.source)!; const b = nodes.get(edge.target)!;
          if (!sceneVisible.has(a.layerId) || !sceneVisible.has(b.layerId) || !edgeTypes.has(edge.type ?? 'dependency')) return null;
          const ai = indices.get(a.layerId)!; const bi = indices.get(b.layerId)!;
          const same = ai === bi;
          const active = !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;
          const points: [number, number, number][] = [[a.x, ai * layerSpacing + (same ? 7 : 20), a.z], [b.x, bi * layerSpacing + (same ? 7 : 20), b.z]];
          return <group key={`${edge.source}-${edge.target}-${index}`}>
            {same && <Line points={points} color="#a99cf4" lineWidth={7} transparent opacity={active ? 0.14 : 0.02} />}
            <Line points={points} color={same ? '#d2cefd' : '#b5abfc'} lineWidth={same ? 1.8 : 1.1}
              transparent opacity={active ? same ? 0.85 : 0.45 : 0.04} dashed={!same} dashSize={8} gapSize={6} />
          </group>;
        })}
        {data.nodes.map((node) => sceneVisible.has(node.layerId) && <Node key={node.id} node={node} index={indices.get(node.layerId) ?? 0}
          spacing={layerSpacing} selected={node.id === selectedNodeId} dimmed={!!related && !related.has(node.id)}
          onSelect={(id) => onSelectNode?.(id)} />)}
        <SceneLabels data={data} indices={indices} spacing={layerSpacing} visible={sceneVisible} selected={selectedNodeId}
          stage={stage} nodeLabels={nodeLabels} layerLabels={layerLabels} />
        {showPanel && <OwnerPaths data={data} indices={indices} spacing={layerSpacing} visible={sceneVisible} selected={selectedNodeId} refs={refs} />}
        <Bloom enabled={bloom} />
      </Canvas>
      <div className="dgt-world-labels" aria-hidden="true">
        {data.layers.map((layer) => <div key={layer.id} className="dgt-shelf-label"
          ref={(element) => { if (element) layerLabels.current.set(layer.id, element); else layerLabels.current.delete(layer.id); }}>
          <strong>{layer.key ?? layer.id.toUpperCase()} {layer.label}</strong><span>{layer.description}</span>
        </div>)}
        {data.nodes.map((node) => <div key={node.id} className={`dgt-node-label${node.id === selectedNodeId ? ' is-selected' : ''}`}
          ref={(element) => { if (element) nodeLabels.current.set(node.id, element); else nodeLabels.current.delete(node.id); }}>
          <span>{(indices.get(node.layerId) ?? 0) === 0 ? '◉' : (indices.get(node.layerId) ?? 0) === 1 ? '⬡' : (indices.get(node.layerId) ?? 0) === 2 ? '⬢' : '▣'}</span> {node.label}
        </div>)}
      </div>
      <div className="dgt-heading"><h2>{view === 'top' && focus >= 0 ? `${data.layers[focus].key ?? data.layers[focus].id} · ${data.layers[focus].label}` : 'System architecture'}</h2>
        <p>{view === 'top' && focus >= 0 ? `Top-down view of the ${data.layers[focus].label.toLowerCase()} shelf.` : 'One shelf per kind of entity. Owners stay flat in their own 2D group.'}</p></div>
      {(selectedNode || selectedOwner) && <div className="dgt-selection"><button aria-label="Clear selection" onClick={() => onSelectNode?.(null)}>×</button>
        <strong>{selectedNode?.label ?? selectedOwner?.label}</strong><span>{selectedNode?.subtitle ?? selectedOwner?.lead}</span>
        <small>{selectedNode ? selectedNode.layerId : `${data.ownership?.filter((link) => link.ownerId === selectedNodeId).length ?? 0} owned entities`}</small>
      </div>}
      <div className="dgt-legend"><span>◉ Resource</span><span>⬡ Component</span><span>⬢ BFF</span><span>▣ App</span><span>━ In-layer dependency</span><span>┄ Cross-layer</span></div>
    </div>
    {showPanel && <aside className="dgt-owners"><div className="dgt-owners-heading"><h3>Owners</h3><span>2D</span></div>
      <p>Stays flat while the stack rotates</p>
      {data.owners!.map((owner) => {
        const count = data.ownership?.filter((link) => link.ownerId === owner.id).length ?? 0;
        const initials = owner.label.split(' ').map((part) => part[0]).join('').slice(0, 2);
        const dimmed = !!related && !related.has(owner.id);
        return <button key={owner.id} className={`dgt-owner${owner.id === selectedNodeId ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
          onClick={() => onSelectNode?.(owner.id === selectedNodeId ? null : owner.id)}>
          <span className="dgt-owner-dot" ref={(element) => { if (element) owners.current.set(owner.id, element); else owners.current.delete(owner.id); }}>{initials}</span>
          <span className="dgt-owner-copy"><strong>{owner.label}</strong><small>{owner.lead}</small></span><span className="dgt-owner-count">{count}</span>
        </button>;
      })}</aside>}
    {showPanel && <svg className="dgt-ownership-lines" aria-hidden="true">{(data.ownership ?? []).map((link) => <path
      key={`${link.nodeId}:${link.ownerId}`} fill="none" stroke="#b5abfc" strokeWidth="1"
      ref={(element) => { const key = `${link.nodeId}:${link.ownerId}`; if (element) paths.current.set(key, element); else paths.current.delete(key); }} />)}</svg>}
  </div>;
}
