import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Line, OrbitControls } from '@react-three/drei';
import { ACESFilmicToneMapping, DoubleSide, Group, Material, Mesh, Object3D, Quaternion, Vector2, Vector3 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { cameraPoseForView, easeCubicInOut, interpolateCameraPose, layerZOffset, type CameraPose, type GraphView } from './camera';
import { getDownstreamNodes, validateGraph } from './graph';
import { layoutGraph, type GraphLayout, type PositionedGraphData, type PositionedGraphNode } from './layout';
import { createGraphTheme, DEFAULT_BASE_COLOR, type GraphMode, type GraphTheme } from './theme';
import type { GraphData, GraphEdge, GraphEdgeType, GraphLayer, GraphLayerType, GraphNode, GraphNodeShape } from './types';
import './style.css';

export type { GraphView } from './camera';

/** Configuration for the layered 3D graph. Pass a new `data` object for each live snapshot. */
export interface DependencyGraphProps {
  /** Graph snapshot to display. Keep entity IDs stable between updates to preserve placement. */
  data: GraphData;
  /** Selected node ID; `null` clears the selection. */
  selectedNodeId?: string | null;
  /** Called when a node is selected, the background is clicked, or a selection disappears. */
  onSelectNode?: (nodeId: string | null) => void;
  /** Layer IDs to display. Omit to show all layers; pass an empty array to hide all. */
  visibleLayerIds?: string[];
  /** Edge categories to display. Omit to show all; edges without a type use `dependency`. */
  visibleEdgeTypes?: GraphEdgeType[];
  /** Vertical distance between shelves, in scene units. Defaults to `240`. */
  layerSpacing?: number;
  /** Depth spread between shelves, centered on the stack. Defaults to `0`; negative values reverse the spread. */
  layerZSpacing?: number;
  /** Controlled camera preset. Omit to let the built-in view toolbar manage it; starts at `3d`. */
  view?: GraphView;
  /** Shelf to focus in the top view. `null` uses the default shelf for that view. */
  focusedLayerId?: string | null;
  /** Change this value to replay the camera move to the current view or focused layer. */
  cameraRequestKey?: number;
  /** Called when the toolbar selects a view or the user rotates away from a focused top view. */
  onViewChange?: (view: GraphView) => void;
  /** Animate particles along directed `call` edges. Defaults to `true`. */
  flow?: boolean;
  /** Enable the glow pass. Defaults to `true`; `glowIntensity` sets its strength. */
  bloom?: boolean;
  /** Glow strength, clamped to `0`–`2`. Defaults to `0.65`; `0` disables glow. */
  glowIntensity?: number;
  /** Base hex color used to derive the graph's scene and UI shades. Defaults to `#968ae0`. */
  baseColor?: string;
  /** Appearance controlled by the parent app. Defaults to `dark`. */
  mode?: GraphMode;
  /** Shelf fill and relative border opacity from `0` (transparent) to `1` (opaque). Defaults to `0.32`. */
  shelfOpacity?: number;
  /** Show the grid on shelves and the ground. Defaults to `true`. */
  showGrid?: boolean;
  /** Show node and shelf labels. Defaults to `true`. */
  showLabels?: boolean;
  /** Show the shape and edge legend. Defaults to `true`. */
  showLegend?: boolean;
  /** Heading title. `undefined` uses the view's automatic title; `null` hides it. */
  title?: string | null;
  /** Heading description. `undefined` uses automatic text; `null` hides it. */
  description?: string | null;
  /** Play the opening top-shelf-to-3D camera move on mount. Defaults to `true` in the 3D view. */
  introAnimation?: boolean;
  /** Additional CSS class applied to the graph's root element. */
  className?: string;
}

const DEFAULT_SHELF_OPACITY = 0.32;
type MotionPositions = React.RefObject<Map<string, Vector3>>;

const shapeIcons: Record<GraphNodeShape, string> = { cylinder: '◉', box: '▭', hexagon: '⬡', panel: '▣' };

function nodeRise(shape: GraphNodeShape): number {
  return shape === 'cylinder' ? 16 : shape === 'panel' ? 8 : 13;
}

function labelRise(shape: GraphNodeShape): number {
  return shape === 'cylinder' ? 49 : shape === 'hexagon' ? 46 : shape === 'panel' ? 31 : 36;
}

function GraphMotion({ targets, positions }: { targets: Map<string, Vector3>; positions: MotionPositions }) {
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-9 * delta);
    for (const [id, target] of targets) {
      const current = positions.current.get(id);
      if (current) current.lerp(target, blend);
      else positions.current.set(id, target.clone());
    }
    for (const id of positions.current.keys()) if (!targets.has(id)) positions.current.delete(id);
  }, -2);
  return null;
}
function shelfGrid(width: number, depth: number): Float32Array {
  const values: number[] = [];
  for (let x = -width / 2 + 40; x < width / 2; x += 40) values.push(x, 0, -depth / 2, x, 0, depth / 2);
  for (let z = -depth / 2 + 40; z < depth / 2; z += 40) values.push(-width / 2, 0, z, width / 2, 0, z);
  return new Float32Array(values);
}
function groundGrid(width: number, depth: number): Float32Array {
  const extent = Math.max(2000, Math.ceil(Math.max(width, depth) / 100) * 100);
  const values: number[] = [];
  for (let x = -extent; x <= extent; x += 50) values.push(x, 0, -extent, x, 0, extent);
  for (let z = -extent; z <= extent; z += 50) values.push(-extent, 0, z, extent, 0, z);
  return new Float32Array(values);
}

type IntroPhase = 'hold' | 'reveal' | 'done';

function CameraRig({ view, focus, spacing, zSpacing, layerCount, requestKey, overheadFocused, onExitOverhead,
  introPhase, introProgress, setIntroPhase, planeWidth, planeDepth }: {
  view: GraphView; focus: number; spacing: number; zSpacing: number; layerCount: number;
  requestKey: string; overheadFocused: boolean; onExitOverhead: () => boolean;
  introPhase: IntroPhase; introProgress: React.RefObject<number>;
  setIntroPhase: React.Dispatch<React.SetStateAction<IntroPhase>>;
  planeWidth: number; planeDepth: number;
}) {
  const { camera, size } = useThree();
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const transitionRef = useRef<{ from: CameraPose; to: CameraPose; started: number; duration: number } | null>(null);
  const previousRef = useRef<string | null>(null);
  const interactingRef = useRef(false);
  const skipTransitionRef = useRef(false);

  function readPose(): CameraPose {
    const target = controlsRef.current?.target ?? new Vector3();
    const offset = camera.position.clone().sub(target);
    const r = offset.length();
    return {
      az: Math.atan2(offset.x, offset.z),
      pol: Math.acos(Math.max(-1, Math.min(1, offset.y / r))),
      r, tx: target.x, ty: target.y, tz: target.z,
    };
  }

  function applyPose(pose: CameraPose) {
    const controls = controlsRef.current;
    controls?.target.set(pose.tx, pose.ty, pose.tz);
    const sin = Math.sin(pose.pol);
    camera.position.set(
      pose.tx + pose.r * sin * Math.sin(pose.az),
      pose.ty + pose.r * Math.cos(pose.pol),
      pose.tz + pose.r * sin * Math.cos(pose.az),
    );
    camera.lookAt(pose.tx, pose.ty, pose.tz);
    controls?.update();
  }

  useEffect(() => {
    const cameraView = introPhase === 'hold' ? 'top' : view;
    const cameraFocus = introPhase === 'hold' ? layerCount - 1 : focus;
    const to = cameraPoseForView(cameraView, cameraFocus, spacing, size.width, planeWidth, planeDepth, zSpacing, layerCount);
    camera.far = 9000 * Math.max(1, planeWidth / 1080, (planeDepth + (layerCount - 1) * Math.abs(zSpacing)) / 580);
    camera.updateProjectionMatrix();
    const request = `${cameraView}:${cameraFocus}:${spacing}:${zSpacing}:${layerCount}:${requestKey}:${planeWidth}:${planeDepth}`;
    const previous = previousRef.current;
    previousRef.current = request;
    if (skipTransitionRef.current) {
      skipTransitionRef.current = false;
      return;
    }
    if (!previous || previous === request) {
      transitionRef.current = null;
      applyPose(to);
      return;
    }
    const controls = controlsRef.current;
    if (controls) controls.enableDamping = false;
    transitionRef.current = { from: readPose(), to, started: performance.now(),
      duration: introPhase === 'reveal' ? 1900 : cameraView === 'top' ? 1100 : 900 };
  }, [view, focus, spacing, zSpacing, layerCount, requestKey, size.width, planeWidth, planeDepth, introPhase]);

  useEffect(() => {
    if (introPhase !== 'hold') return;
    const timer = window.setTimeout(() => setIntroPhase('reveal'), 1000);
    return () => window.clearTimeout(timer);
  }, [introPhase, setIntroPhase]);

  useFrame(() => {
    const transition = transitionRef.current;
    if (!transition) return;
    const progress = Math.min(1, (performance.now() - transition.started) / transition.duration);
    if (introPhase === 'reveal') introProgress.current = easeCubicInOut(progress);
    applyPose(interpolateCameraPose(transition.from, transition.to, progress));
    if (progress >= 1) {
      transitionRef.current = null;
      if (controlsRef.current) controlsRef.current.enableDamping = true;
      if (introPhase === 'reveal') setIntroPhase('done');
    }
  });

  return <OrbitControls ref={controlsRef} minDistance={300} maxDistance={Math.max(4800, 9000 * Math.max(planeWidth / 1080, (planeDepth + (layerCount - 1) * Math.abs(zSpacing)) / 580))} minPolarAngle={0.0005} maxPolarAngle={1.55}
    enableDamping onStart={() => {
      interactingRef.current = true;
      transitionRef.current = null;
      if (introPhase !== 'done') { skipTransitionRef.current = true; setIntroPhase('done'); }
      if (controlsRef.current) controlsRef.current.enableDamping = true;
    }}
    onEnd={() => { interactingRef.current = false; }}
    onChange={() => {
      if (interactingRef.current && overheadFocused && controlsRef.current && controlsRef.current.getPolarAngle() > 0.04) {
        interactingRef.current = false;
        skipTransitionRef.current = onExitOverhead();
      }
    }} />;
}

function SceneFader({ root, fades, count, focus, introPhase, introFocus, introProgress }: {
  root: React.RefObject<Group | null>; fades: React.RefObject<number[]>; count: number; focus: number | null;
  introPhase: IntroPhase; introFocus: number; introProgress: React.RefObject<number>;
}) {
  const baseOpacity = useRef(new WeakMap<Material, number>());
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-8 * delta);
    for (let i = 0; i < count; i++) {
      const reveal = Math.max(0, Math.min(1, (introProgress.current - 0.12) / 0.8));
      const target = introPhase === 'hold' ? (i === introFocus ? 1 : 0)
        : introPhase === 'reveal' ? (i === introFocus ? 1 : reveal)
          : focus === null ? 1 : i === focus ? 1 : i < focus ? 0.1 : 0;
      fades.current[i] = (fades.current[i] ?? 1) + (target - (fades.current[i] ?? 1)) * blend;
    }
    for (const child of root.current?.children ?? []) {
      const index = child.userData.fadeLayer as number | undefined;
      if (index === undefined) continue;
      const other = child.userData.fadeOtherLayer as number | undefined;
      const opacity = other === undefined ? fades.current[index] : Math.min(fades.current[index], fades.current[other]);
      child.visible = opacity > 0.005;
      child.traverse((object) => {
        const objectMaterials = 'material' in object ? (object as { material: Material | Material[] }).material : undefined;
        if (!objectMaterials) return;
        let selectionOpacity = 1;
        let opacityMultiplier = 1;
        let ancestor: Object3D | null = object;
        while (ancestor) {
          if (typeof ancestor.userData.selectionOpacity === 'number') selectionOpacity *= ancestor.userData.selectionOpacity;
          if (typeof ancestor.userData.opacityMultiplier === 'number') opacityMultiplier *= ancestor.userData.opacityMultiplier;
          if (ancestor === child) break;
          ancestor = ancestor.parent;
        }
        for (const material of Array.isArray(objectMaterials) ? objectMaterials : [objectMaterials]) {
          const configuredOpacity = material.userData.baseOpacity;
          if (typeof configuredOpacity === 'number') baseOpacity.current.set(material, configuredOpacity);
          else if (!baseOpacity.current.has(material)) baseOpacity.current.set(material, material.opacity);
          material.transparent = true;
          material.opacity = Math.min(1, (baseOpacity.current.get(material) ?? 1) * opacity * selectionOpacity * opacityMultiplier);
        }
      });
    }
  });
  return null;
}

function Bloom({ strength }: { strength: number }) {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const engine = new EffectComposer(gl);
    engine.addPass(new RenderPass(scene, camera));
    const glow = new UnrealBloomPass(new Vector2(size.width, size.height), 0.65, 0.55, 0.18);
    engine.addPass(glow);
    engine.addPass(new OutputPass());
    return { engine, glow };
  }, [gl, scene, camera]);
  useEffect(() => {
    composer.engine.setSize(size.width, size.height);
    composer.glow.strength = strength;
  }, [composer, size.width, size.height, strength]);
  useEffect(() => () => composer.engine.dispose(), [composer]);
  useFrame(() => composer.engine.render(), 1);
  return null;
}

function Shelf({ index, spacing, z, width, depth, showGrid, opacity, theme }: {
  index: number; spacing: number; z: number; width: number; depth: number; showGrid: boolean; opacity: number; theme: GraphTheme;
}) {
  const y = index * spacing;
  const grid = useMemo(() => shelfGrid(width, depth), [width, depth]);
  const outline: [number, number, number][] = [
    [-width / 2, y + 5, z - depth / 2], [width / 2, y + 5, z - depth / 2], [width / 2, y + 5, z + depth / 2],
    [-width / 2, y + 5, z + depth / 2], [-width / 2, y + 5, z - depth / 2],
  ];
  return <group>
    <mesh position={[0, y, z]}>
      <boxGeometry args={[width, 8, depth]} />
      <meshStandardMaterial color={theme.shelf} emissive={theme.shelfEmissive} emissiveIntensity={0.5} metalness={0.2} roughness={0.5}
        transparent opacity={opacity} userData={{ baseOpacity: opacity }} side={DoubleSide} depthWrite={false} />
    </mesh>
    {showGrid && <lineSegments position={[0, y + 5, z]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[grid, 3]} /></bufferGeometry>
      <lineBasicMaterial color={theme.grid} transparent opacity={0.28} depthWrite={false} />
    </lineSegments>}
    <group userData={{ opacityMultiplier: opacity / DEFAULT_SHELF_OPACITY }}>
      <Line points={outline} color={theme.shelfGlow} lineWidth={9} transparent opacity={0.13} />
      <Line points={outline} color={theme.bright} lineWidth={1.8} transparent opacity={0.95} />
      <mesh position={[0, y + 5, z + depth / 2]}>
        <boxGeometry args={[width, 1.8, 2]} />
        <meshBasicMaterial color={theme.accent} transparent opacity={0.8} />
      </mesh>
    </group>
  </group>;
}

function Node({ node, shape, target, positions, selected, dimmed, onSelect, theme }: {
  node: PositionedGraphNode; shape: GraphNodeShape; target: Vector3; positions: MotionPositions;
  selected: boolean; dimmed: boolean; onSelect: (id: string) => void; theme: GraphTheme;
}) {
  const group = useRef<Group>(null);
  const rise = nodeRise(shape);
  useFrame(() => {
    const point = positions.current.get(node.id) ?? target;
    group.current?.position.set(point.x, point.y + rise, point.z);
  });
  const click = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(node.id); };
  const initial = positions.current.get(node.id) ?? target;
  return <group ref={group} position={[initial.x, initial.y + rise, initial.z]} userData={{ selectionOpacity: dimmed ? 0.14 : 1 }}>
    <mesh onClick={click}>
      {shape === 'cylinder' ? <cylinderGeometry args={[17, 17, 24, 40]} />
        : shape === 'hexagon' ? <cylinderGeometry args={[22, 22, 18, 6]} />
          : shape === 'panel' ? <boxGeometry args={[84, 7, 54]} />
            : <boxGeometry args={[92, 18, 30]} />}
      <meshStandardMaterial color={selected ? theme.selectedNode : shape === 'cylinder' ? theme.cylinder : theme.grid}
        emissive={selected ? theme.selectedEmissive : theme.emissive} emissiveIntensity={selected ? 0.8 : 0.55}
        metalness={0.3} roughness={0.34} transparent opacity={0.96} />
      <Edges threshold={20} color={selected ? theme.selectedEdge : theme.bright} />
    </mesh>
    {shape === 'panel' && <mesh position={[0, 4, 0]}>
      <boxGeometry args={[72, 1, 40]} /><meshBasicMaterial color={theme.shelfEmissive} transparent opacity={0.9} />
    </mesh>}
  </group>;
}

function AnimatedEdge({ source, target, sourceIndex, targetIndex, targets, positions, flow, phase, active, theme }: {
  source: string; target: string; sourceIndex: number; targetIndex: number;
  targets: Map<string, Vector3>; positions: MotionPositions; flow: boolean; phase: number; active: boolean; theme: GraphTheme;
}) {
  const same = sourceIndex === targetIndex;
  const glow = useRef<React.ComponentRef<typeof Line>>(null);
  const line = useRef<React.ComponentRef<typeof Line>>(null);
  const arrow = useRef<Mesh>(null);
  const dot = useRef<Mesh>(null);
  const direction = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  const orientation = useMemo(() => new Quaternion(), []);
  const lastValues = useRef<number[] | null>(null);
  const endpoint = (id: string): Vector3 => positions.current.get(id) ?? targets.get(id)!;
  const first = endpoint(source);
  const second = endpoint(target);
  const rise = same ? 7 : 20;
  const points: [number, number, number][] = [
    [first.x, first.y + rise, first.z], [second.x, second.y + rise, second.z],
  ];
  useFrame(({ clock }) => {
    const a = endpoint(source);
    const b = endpoint(target);
    const values = [a.x, a.y + rise, a.z, b.x, b.y + rise, b.z];
    if (!lastValues.current || values.some((value, index) => Math.abs(value - lastValues.current![index]) > 0.05)) {
      if (glow.current) glow.current.geometry.setPositions(values);
      if (line.current) {
        line.current.geometry.setPositions(values);
        if (!same) line.current.computeLineDistances();
      }
      lastValues.current = values;
    }
    direction.set(b.x - a.x, b.y - a.y, b.z - a.z);
    if (arrow.current && direction.lengthSq() > 0.001) {
      direction.normalize();
      arrow.current.position.set(b.x - direction.x * 27, b.y + rise - direction.y * 27, b.z - direction.z * 27);
      arrow.current.quaternion.copy(orientation.setFromUnitVectors(up, direction));
    }
    if (dot.current) {
      const progress = (clock.getElapsedTime() * 0.3 + phase) % 1;
      dot.current.position.set(a.x + (b.x - a.x) * progress, a.y + rise + (b.y - a.y) * progress, a.z + (b.z - a.z) * progress);
    }
  });
  return <group userData={{ fadeLayer: sourceIndex, fadeOtherLayer: targetIndex, selectionOpacity: active ? 1 : 0.07 }}>
    {same && <Line ref={glow} points={points} color={theme.edgeGlow} lineWidth={7} transparent opacity={0.14} />}
    <Line ref={line} points={points} color={same ? theme.bright : theme.accent} lineWidth={same ? 1.8 : 1.1}
      transparent opacity={same ? 0.85 : 0.45} dashed={!same} dashSize={8} gapSize={6} />
    {same && <mesh ref={arrow}>
      <coneGeometry args={[4.5, 12, 10]} />
      <meshBasicMaterial color={theme.arrow} transparent opacity={0.9} depthWrite={false} />
    </mesh>}
    {flow && <mesh ref={dot}>
      <sphereGeometry args={[4, 10, 8]} />
      <meshBasicMaterial color={theme.flow} transparent opacity={1} depthWrite={false} />
    </mesh>}
  </group>;
}

function SceneLabels({ data, indices, spacing, zSpacing, positions, visible, related, stage, nodeLabels, layerLabels, fades, focus, planeWidth, planeDepth }: {
  data: PositionedGraphData; indices: Map<string, number>; spacing: number; zSpacing: number; visible: Set<string>; related: Set<string> | null;
  positions: MotionPositions;
  stage: React.RefObject<HTMLDivElement | null>;
  nodeLabels: React.RefObject<Map<string, HTMLDivElement>>;
  layerLabels: React.RefObject<Map<string, HTMLDivElement>>;
  fades: React.RefObject<number[]>;
  focus: number | null;
  planeWidth: number; planeDepth: number;
}) {
  const point = useMemo(() => new Vector3(), []);
  const cameraPoint = useMemo(() => new Vector3(), []);
  const tick = useRef(0);
  useFrame(({ camera }) => {
    if (++tick.current % 2 || !stage.current) return;
    const width = stage.current.clientWidth;
    const height = stage.current.clientHeight;
    // Match the label's screen size to a world-space object at the same depth.
    // The floor keeps text legible when the camera frames a very large graph.
    const labelScale = (worldPoint: Vector3) => {
      const depth = -cameraPoint.copy(worldPoint).applyMatrix4(camera.matrixWorldInverse).z;
      const pixelsPerUnit = height * camera.projectionMatrix.elements[5] / (2 * Math.max(1, depth));
      return Math.max(0.55, Math.min(2, pixelsPerUnit / 0.75));
    };
    for (const layer of data.layers) {
      const label = layerLabels.current.get(layer.id);
      if (!label) continue;
      if (!visible.has(layer.id)) { label.style.visibility = 'hidden'; continue; }
      const index = indices.get(layer.id) ?? 0;
      const opacity = fades.current[index] ?? 1;
      point.set(-planeWidth / 2, index * spacing + 5, planeDepth * 0.15 + layerZOffset(index, data.layers.length, zSpacing));
      const scale = labelScale(point);
      point.project(camera);
      label.style.visibility = opacity < 0.01 || point.z < -1 || point.z > 1 ? 'hidden' : 'visible';
      label.style.opacity = String(opacity);
      const x = (point.x + 1) / 2 * width;
      const y = (1 - point.y) / 2 * height;
      label.style.transform = `translate3d(${Math.max(8, x - (label.offsetWidth + 18) * scale).toFixed(1)}px,${(y - label.offsetHeight * scale / 2).toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
    }
    for (const node of data.nodes) {
      const label = nodeLabels.current.get(node.id);
      if (!label) continue;
      if (!visible.has(node.layerId)) { label.style.visibility = 'hidden'; continue; }
      const index = indices.get(node.layerId) ?? 0;
      const opacity = fades.current[index] ?? 1;
      const labelOpacity = focus !== null && index < focus ? Math.max(opacity, 0.42) : opacity;
      const rise = labelRise(node.shape ?? 'box');
      const current = positions.current.get(node.id);
      point.set(current?.x ?? node.x, (current?.y ?? index * spacing) + rise,
        current?.z ?? node.z + layerZOffset(index, data.layers.length, zSpacing));
      const scale = labelScale(point);
      point.project(camera);
      label.style.visibility = opacity < 0.01 || point.z < -1 || point.z > 1 ? 'hidden' : 'visible';
      label.style.opacity = String(labelOpacity * (related && !related.has(node.id) ? 0.14 : 1));
      const x = (point.x + 1) / 2 * width;
      const y = (1 - point.y) / 2 * height;
      label.style.transform = `translate3d(${(x - label.offsetWidth * scale / 2).toFixed(1)}px,${(y - label.offsetHeight * scale / 2).toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
    }
  });
  return null;
}

type SideEdge = { key: string; edge: GraphEdge };
type SideEdgeRefs = {
  board: React.RefObject<HTMLDivElement | null>;
  stage: React.RefObject<HTMLDivElement | null>;
  rows: React.RefObject<Map<string, HTMLButtonElement>>;
  paths: React.RefObject<Map<string, SVGPathElement>>;
  dots: React.RefObject<Map<string, SVGCircleElement>>;
};

function SideEdgePaths({ edges, nodes, layerTypes, indices, spacing, zSpacing, layerCount, positions, related, refs, fades, flow, compact }: {
  edges: SideEdge[]; nodes: Map<string, GraphNode>; layerTypes: Map<string, GraphLayerType>;
  indices: Map<string, number>; spacing: number; zSpacing: number; layerCount: number;
  related: Set<string> | null; refs: SideEdgeRefs; fades: React.RefObject<number[]>;
  positions: MotionPositions; flow: boolean; compact: boolean;
}) {
  const vector = useMemo(() => new Vector3(), []);
  const tick = useRef(0);
  useFrame(({ camera, clock }) => {
    if (!refs.board.current || !refs.stage.current) return;
    const updatePaths = ++tick.current % 3 === 0;
    const board = refs.board.current.getBoundingClientRect();
    const stage = refs.stage.current.getBoundingClientRect();
    const endpoint = (id: string): { x: number; y: number; side: GraphLayerType } | null => {
      const node = nodes.get(id);
      if (!node) return null;
      const side = layerTypes.get(node.layerId) ?? 'default';
      if (side !== 'default') {
        const row = refs.rows.current.get(id)?.getBoundingClientRect();
        if (!row) return null;
        return { x: (side === 'left2d' ? row.right : row.left) - board.left,
          y: row.top + row.height / 2 - board.top, side };
      }
      const index = indices.get(node.layerId);
      if (index === undefined) return null;
      const current = positions.current.get(id);
      vector.set(current?.x ?? node.x ?? 0, (current?.y ?? index * spacing) + 18,
        current?.z ?? (node.z ?? 0) + layerZOffset(index, layerCount, zSpacing)).project(camera);
      if (vector.z < -1 || vector.z > 1) return null;
      return { x: (vector.x + 1) / 2 * stage.width + stage.left - board.left,
        y: (1 - vector.y) / 2 * stage.height + stage.top - board.top, side };
    };
    edges.forEach(({ key, edge }, index) => {
      const path = refs.paths.current.get(key);
      const dot = refs.dots.current.get(key);
      if (!path || !dot) return;
      if (updatePaths) {
        const a = endpoint(edge.source);
        const b = endpoint(edge.target);
        if (!a || !b) path.setAttribute('d', '');
        else {
          const sameSide = a.side !== 'default' && a.side === b.side;
          const bend = sameSide ? 24 + Math.min(48, Math.abs(b.y - a.y) * 0.12)
            : Math.max(40, Math.abs(b.x - a.x) * 0.36);
          const railDirection = (side: GraphLayerType) => side === 'left2d' ? (compact && sameSide ? -1 : 1)
            : side === 'right2d' ? (compact && sameSide ? 1 : -1) : 0;
          const fromDirection = railDirection(a.side) || Math.sign(b.x - a.x) || 1;
          const toDirection = railDirection(b.side) || Math.sign(a.x - b.x) || -1;
          path.setAttribute('d', `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C${(a.x + fromDirection * bend).toFixed(1)} ${a.y.toFixed(1)} ${(b.x + toDirection * bend).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
        }
      }
      const valid = !!path.getAttribute('d');
      const active = !related || (related.has(edge.source) && related.has(edge.target));
      const fade = [edge.source, edge.target].reduce((value, id) => {
        const node = nodes.get(id);
        const layerIndex = node ? indices.get(node.layerId) : undefined;
        return layerIndex === undefined ? value : Math.min(value, fades.current[layerIndex] ?? 1);
      }, 1);
      path.style.opacity = valid ? String((related ? active ? 0.85 : 0.025 : 0.16) * fade) : '0';
      const animate = flow && edge.type === 'call' && active;
      dot.style.visibility = animate && valid && fade > 0.01 ? 'visible' : 'hidden';
      dot.style.opacity = String(0.9 * fade);
      if (animate && valid) {
        const distance = path.getTotalLength();
        const point = path.getPointAtLength(distance * ((clock.getElapsedTime() * 0.28 + index * 0.137) % 1));
        dot.setAttribute('cx', point.x.toFixed(1));
        dot.setAttribute('cy', point.y.toFixed(1));
      }
    });
  });
  return null;
}

function SidePanel({ side, layers, nodes, counts, selected, related, rows, onSelect }: {
  side: 'left2d' | 'right2d'; layers: GraphLayer[]; nodes: readonly GraphNode[];
  counts: Map<string, number>; selected: string | null; related: Set<string> | null;
  rows: React.RefObject<Map<string, HTMLButtonElement>>; onSelect?: (nodeId: string | null) => void;
}) {
  return <aside className={`dgt-side dgt-side--${side === 'left2d' ? 'left' : 'right'}`}>
    {layers.map((layer) => <section className="dgt-side-section" key={layer.id}>
      <div className="dgt-side-heading"><h3>{layer.label}</h3></div>
      {layer.description && <p>{layer.description}</p>}
      {nodes.filter((node) => node.layerId === layer.id).map((node) =>
        <button key={node.id} type="button"
          ref={(element) => { if (element) rows.current.set(node.id, element); else rows.current.delete(node.id); }}
          className={`dgt-side-node${node.id === selected ? ' is-selected' : ''}${related && !related.has(node.id) ? ' is-dimmed' : ''}`}
          onClick={() => onSelect?.(node.id === selected ? null : node.id)}>
          <span className="dgt-side-copy"><strong>{node.label}</strong>{node.subtitle && <small>{node.subtitle}</small>}</span>
          <span className="dgt-side-count">{counts.get(node.id) ?? 0}</span>
        </button>)}
    </section>)}
  </aside>;
}

/** Render an interactive layered dependency graph from a graph snapshot. */
export function DependencyGraph({ data, selectedNodeId = null, onSelectNode, visibleLayerIds, visibleEdgeTypes,
  layerSpacing = 240, layerZSpacing = 0, view: controlledView, focusedLayerId = null,
  cameraRequestKey = 0, onViewChange, flow = true, bloom = true, glowIntensity = 0.65,
  baseColor = DEFAULT_BASE_COLOR, mode = 'dark', shelfOpacity = DEFAULT_SHELF_OPACITY,
  showGrid = true, showLabels = true, showLegend = true, title, description,
  introAnimation = true, className }: DependencyGraphProps) {
  const [uncontrolledView, setUncontrolledView] = useState<GraphView>('3d');
  const [toolbarRequestKey, setToolbarRequestKey] = useState(0);
  const view = controlledView ?? uncontrolledView;
  const theme = useMemo(() => createGraphTheme(baseColor, mode), [baseColor, mode]);
  const themeStyle = useMemo(() => ({
    '--dgt-bg': theme.background,
    '--dgt-text': theme.text,
    '--dgt-muted': theme.muted,
    '--dgt-subtle': theme.subtle,
    '--dgt-legend': theme.legend,
    '--dgt-border': theme.border,
    '--dgt-selection-border': theme.selectionBorder,
    '--dgt-selected-label': theme.selectedLabel,
    '--dgt-bright': theme.bright,
    '--dgt-shelf-label': theme.shelfLabel,
    '--dgt-node-label': theme.nodeLabel,
    '--dgt-toolbar-bg': `${theme.toolbarBackground}c9`,
    '--dgt-toolbar-border': `${theme.toolbarBorder}40`,
    '--dgt-toolbar-text': theme.toolbarText,
    '--dgt-toolbar-icon': theme.toolbarIcon,
    '--dgt-toolbar-strong': theme.toolbarStrong,
    '--dgt-toolbar-hover': `${theme.toolbarHover}24`,
    '--dgt-toolbar-active-bg': `${theme.toolbarActive}24`,
    '--dgt-toolbar-active-border': `${theme.toolbarActive}38`,
    '--dgt-toolbar-focus': theme.toolbarFocus,
    '--dgt-side-bg': theme.sideBackground,
    '--dgt-side-hover': theme.sideHover,
    '--dgt-selection-bg': `${theme.selectionBackground}ee`,
  }) as React.CSSProperties, [theme]);
  const requestKey = `${cameraRequestKey}:${toolbarRequestKey}`;
  const spatialLayers = useMemo(() => data.layers.filter((layer) => !layer.type || layer.type === 'default'), [data.layers]);
  function selectView(nextView: GraphView) {
    if (controlledView === undefined) setUncontrolledView(nextView);
    setToolbarRequestKey((key) => key + 1);
    onViewChange?.(nextView);
  }
  const board = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const sceneRoot = useRef<Group>(null);
  const [introPhase, setIntroPhase] = useState<IntroPhase>(() => introAnimation && view === '3d' && spatialLayers.length > 0 ? 'hold' : 'done');
  const introProgress = useRef(introPhase === 'done' ? 1 : 0);
  const fades = useRef<number[]>(spatialLayers.map((_, index) => introPhase === 'hold' && index !== spatialLayers.length - 1 ? 0 : 1));
  const [orbitExited, setOrbitExited] = useState(false);
  useEffect(() => { setOrbitExited(false); }, [view, focusedLayerId, requestKey]);
  useEffect(() => { if (view !== '3d' && introPhase !== 'done') setIntroPhase('done'); }, [view, introPhase]);
  useEffect(() => { if (spatialLayers.length === 0 && introPhase !== 'done') setIntroPhase('done'); }, [spatialLayers.length, introPhase]);
  const sideRows = useRef(new Map<string, HTMLButtonElement>());
  const paths = useRef(new Map<string, SVGPathElement>());
  const dots = useRef(new Map<string, SVGCircleElement>());
  const nodeLabels = useRef(new Map<string, HTMLDivElement>());
  const layerLabels = useRef(new Map<string, HTMLDivElement>());
  const previousLayout = useRef<GraphLayout | null>(null);
  const positions = useRef(new Map<string, Vector3>());
  const errors = useMemo(() => validateGraph(data), [data]);
  const layout = useMemo(() => layoutGraph(data, previousLayout.current ?? undefined), [data]);
  useEffect(() => { if (!errors.length) previousLayout.current = layout; }, [layout, errors]);
  const stackDepth = layout.depth + Math.max(0, spatialLayers.length - 1) * Math.abs(layerZSpacing);
  const sceneScale = Math.max(1, layout.width / 1080, stackDepth / 580);
  const ground = useMemo(() => groundGrid(layout.width, stackDepth), [layout.width, stackDepth]);
  const graph = useMemo<PositionedGraphData>(() => ({ ...data, layers: spatialLayers, nodes: layout.nodes }), [data, layout, spatialLayers]);
  const visible = useMemo(() => new Set(visibleLayerIds ?? data.layers.map((layer) => layer.id)), [visibleLayerIds, data.layers]);
  const edgeTypes = useMemo(() => new Set(visibleEdgeTypes ?? data.edges.map((edge) => edge.type ?? 'dependency')), [visibleEdgeTypes, data.edges]);
  const indices = useMemo(() => new Map(spatialLayers.map((layer, index) => [layer.id, index])), [spatialLayers]);
  const layerTypes = useMemo(() => new Map(data.layers.map((layer) => [layer.id, layer.type ?? 'default'] as const)), [data.layers]);
  const nodes = useMemo(() => new Map(data.nodes.map((node) => [node.id, node])), [data.nodes]);
  const edgeKeys = useMemo(() => {
    const occurrences = new Map<string, number>();
    return data.edges.map((edge) => {
      const identity = edge.id ?? JSON.stringify([edge.source, edge.target, edge.type ?? 'dependency']);
      const count = occurrences.get(identity) ?? 0;
      occurrences.set(identity, count + 1);
      return `${identity}:${count}`;
    });
  }, [data.edges]);
  const visibleEdges = useMemo(() => data.edges.map((edge, index) => ({ edge, key: edgeKeys[index], index }))
    .filter(({ edge }) => {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      return !!source && !!target && visible.has(source.layerId) && visible.has(target.layerId) && edgeTypes.has(edge.type ?? 'dependency');
    }), [data.edges, edgeKeys, nodes, visible, edgeTypes]);
  const sideEdges = useMemo(() => visibleEdges.filter(({ edge }) => {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    return layerTypes.get(source?.layerId ?? '') !== 'default' || layerTypes.get(target?.layerId ?? '') !== 'default';
  }).map(({ edge, key }) => ({ edge, key })), [visibleEdges, nodes, layerTypes]);
  const sideCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { edge } of visibleEdges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    return counts;
  }, [visibleEdges]);
  const sideLayers = data.layers.filter((layer) => layer.type === 'left2d' || layer.type === 'right2d')
    .filter((layer) => visible.has(layer.id) && data.nodes.some((node) => node.layerId === layer.id));
  const leftLayers = sideLayers.filter((layer) => layer.type === 'left2d');
  const rightLayers = sideLayers.filter((layer) => layer.type === 'right2d');
  useEffect(() => {
    const element = board.current;
    if (!element) return;
    const sideCount = Number(leftLayers.length > 0) + Number(rightLayers.length > 0);
    const update = () => setCompact(sideCount > 0 && element.clientWidth < (sideCount === 2 ? 910 : 700));
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [leftLayers.length, rightLayers.length]);
  const targets = useMemo(() => new Map(graph.nodes.map((node) => {
    const index = indices.get(node.layerId) ?? 0;
    return [node.id, new Vector3(node.x, index * layerSpacing,
      node.z + layerZOffset(index, spatialLayers.length, layerZSpacing))] as const;
  })), [graph.nodes, indices, layerSpacing, layerZSpacing, spatialLayers.length]);
  const selectionExists = !selectedNodeId || nodes.has(selectedNodeId);
  const activeSelectionId = selectionExists ? selectedNodeId : null;
  useEffect(() => { if (selectedNodeId && !selectionExists) onSelectNode?.(null); }, [selectedNodeId, selectionExists, onSelectNode]);
  const related = useMemo(() => {
    if (!activeSelectionId) return null;
    return getDownstreamNodes(activeSelectionId, data.edges, edgeTypes);
  }, [activeSelectionId, data.edges, edgeTypes]);
  const focus = focusedLayerId ? indices.get(focusedLayerId) ?? -1 : view === 'top' ? Math.min(1, spatialLayers.length - 1) : -1;
  const focusedOverhead = view === 'top' && focus >= 0 && !orbitExited;
  const introFocus = spatialLayers.length - 1;
  const introHolding = introPhase === 'hold' && introFocus >= 0;
  const fadeFocus = introHolding ? introFocus : focusedOverhead ? focus : null;
  if (errors.length) return <div className="dgt-error" role="alert">Invalid graph: {errors.join('; ')}</div>;
  const automaticTitle = introHolding ? `${spatialLayers[introFocus].key ?? spatialLayers[introFocus].id} · ${spatialLayers[introFocus].label}`
    : focusedOverhead ? `${spatialLayers[focus].key ?? spatialLayers[focus].id} · ${spatialLayers[focus].label}` : 'System architecture';
  const automaticDescription = introHolding ? `Top-down view of the ${spatialLayers[introFocus].label.toLowerCase()} shelf.`
    : focusedOverhead ? `Top-down view of the ${spatialLayers[focus].label.toLowerCase()} shelf.`
      : 'Explore relationships across 3D and 2D layers.';
  const headingTitle = title === undefined ? automaticTitle : title;
  const headingDescription = description === undefined ? automaticDescription : description;
  const glowStrength = bloom && Number.isFinite(glowIntensity) ? Math.max(0, Math.min(2, glowIntensity)) * (mode === 'light' ? 0.3 : 1) : 0;
  const fillOpacity = Number.isFinite(shelfOpacity) ? Math.max(0, Math.min(1, shelfOpacity)) : DEFAULT_SHELF_OPACITY;
  const selectedNode = activeSelectionId ? nodes.get(activeSelectionId) : undefined;
  const refs = { board, stage, rows: sideRows, paths, dots };
  return <div ref={board} style={themeStyle} className={`dgt-board${leftLayers.length ? ' has-left' : ''}${rightLayers.length ? ' has-right' : ''}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
    <div ref={stage} className="dgt-stage">
      <Canvas camera={{ position: [-670, 1225, 1235], fov: 34, near: 5, far: 9000 }}
        gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }} onPointerMissed={() => onSelectNode?.(null)}>
        <color attach="background" args={[theme.background]} /><fog attach="fog" args={[theme.background, 1900 * sceneScale, 4200 * sceneScale]} />
        <ambientLight intensity={0.55} /><directionalLight position={[-400, 900, 600]} intensity={1.1} />
        <pointLight position={[0, 300, 300]} intensity={1.2} color={theme.emissive} />
        <GraphMotion targets={targets} positions={positions} />
        <CameraRig view={view} focus={focus} spacing={layerSpacing} zSpacing={layerZSpacing} layerCount={spatialLayers.length}
          requestKey={requestKey} overheadFocused={focusedOverhead} introPhase={introPhase}
          introProgress={introProgress} setIntroPhase={setIntroPhase}
          planeWidth={layout.width} planeDepth={layout.depth}
          onExitOverhead={() => {
            setOrbitExited(true);
            if (controlledView === undefined) setUncontrolledView('3d');
            onViewChange?.('3d');
            return true;
          }} />
        {showGrid && <lineSegments position={[0, -100, 0]}>
          <bufferGeometry><bufferAttribute attach="attributes-position" args={[ground, 3]} /></bufferGeometry>
          <lineBasicMaterial color={theme.groundGrid} transparent opacity={0.2} depthWrite={false} />
        </lineSegments>}
        <group ref={sceneRoot}>
        {spatialLayers.map((layer, index) => visible.has(layer.id) && <group key={layer.id} userData={{ fadeLayer: index }}>
          <Shelf index={index} spacing={layerSpacing} z={layerZOffset(index, spatialLayers.length, layerZSpacing)}
            width={layout.width} depth={layout.depth} showGrid={showGrid} opacity={fillOpacity} theme={theme} />
          {graph.nodes.filter((node) => node.layerId === layer.id).map((node) => <Node key={node.id} node={node}
            shape={node.shape ?? 'box'} target={targets.get(node.id)!} positions={positions}
            selected={node.id === activeSelectionId} dimmed={!!related && !related.has(node.id)}
            onSelect={(id) => onSelectNode?.(id)} theme={theme} />)}
        </group>)}
        {visibleEdges.map(({ edge, index, key }) => {
          const a = nodes.get(edge.source)!; const b = nodes.get(edge.target)!;
          if (layerTypes.get(a.layerId) !== 'default' || layerTypes.get(b.layerId) !== 'default') return null;
          const ai = indices.get(a.layerId)!; const bi = indices.get(b.layerId)!;
          const active = !related || (related.has(edge.source) && related.has(edge.target));
          return <AnimatedEdge key={key}
            source={edge.source} target={edge.target} sourceIndex={ai} targetIndex={bi}
            targets={targets} positions={positions} flow={flow && edge.type === 'call' && active} phase={(index * 0.137) % 1} active={active} theme={theme} />;
        })}
        </group>
        <SceneFader root={sceneRoot} fades={fades} count={spatialLayers.length} focus={fadeFocus}
          introPhase={introPhase} introFocus={introFocus} introProgress={introProgress} />
        {showLabels && <SceneLabels data={graph} indices={indices} spacing={layerSpacing} zSpacing={layerZSpacing} positions={positions}
          visible={visible} related={related}
          stage={stage} nodeLabels={nodeLabels} layerLabels={layerLabels} fades={fades} focus={focusedOverhead ? focus : null}
          planeWidth={layout.width} planeDepth={layout.depth} />}
        {!!sideEdges.length && <SideEdgePaths edges={sideEdges} nodes={nodes} layerTypes={layerTypes} indices={indices}
          spacing={layerSpacing} zSpacing={layerZSpacing} layerCount={spatialLayers.length}
          positions={positions} related={related} refs={refs} fades={fades} flow={flow} compact={compact} />}
        <Bloom strength={glowStrength} />
      </Canvas>
      {showLabels && <div className="dgt-world-labels" aria-hidden="true">
        {spatialLayers.map((layer) => <div key={layer.id} className="dgt-shelf-label"
          ref={(element) => { if (element) layerLabels.current.set(layer.id, element); else layerLabels.current.delete(layer.id); }}>
          <strong>{layer.key ?? layer.id.toUpperCase()} {layer.label}</strong><span>{layer.description}</span>
        </div>)}
        {graph.nodes.map((node) => <div key={node.id} className={`dgt-node-label${node.id === activeSelectionId ? ' is-selected' : ''}`}
          ref={(element) => { if (element) nodeLabels.current.set(node.id, element); else nodeLabels.current.delete(node.id); }}>
          <span>{shapeIcons[node.shape ?? 'box']}</span> {node.label}
        </div>)}
      </div>}
      {(headingTitle !== null || headingDescription !== null) && <div className="dgt-heading">
        {headingTitle !== null && <h2>{headingTitle}</h2>}
        {headingDescription !== null && <p>{headingDescription}</p>}
      </div>}
      {selectedNode && <div className="dgt-selection"><button aria-label="Clear selection" onClick={() => onSelectNode?.(null)}>×</button>
        <strong>{selectedNode.label}</strong><span>{selectedNode.subtitle}</span>
        <small>{data.layers.find((layer) => layer.id === selectedNode.layerId)?.label ?? selectedNode.layerId}</small>
      </div>}
      {showLegend && <div className="dgt-legend"><span>◉ Cylinder</span><span>▭ Box</span><span>⬡ Hexagon</span><span>▣ Panel</span><span>━ In-layer dependency</span><span>┄ Cross-layer</span></div>}
      <div className="dgt-view-toolbar" role="toolbar" aria-label="Camera view">{(['3d', 'top', 'side', 'front'] as const).map((option) =>
        <button key={option} type="button" className={view === option ? 'is-active' : ''}
          aria-pressed={view === option} onClick={() => selectView(option)}>
          <span aria-hidden="true">{option === '3d' ? '◈' : option === 'top' ? '▣' : option === 'side' ? '☷' : '▥'}</span>
          {option === '3d' ? '3D' : option[0].toUpperCase() + option.slice(1)}
        </button>)}</div>
    </div>
    {!!leftLayers.length && <SidePanel side="left2d" layers={leftLayers} nodes={data.nodes} counts={sideCounts}
      selected={activeSelectionId} related={related} rows={sideRows} onSelect={onSelectNode} />}
    {!!rightLayers.length && <SidePanel side="right2d" layers={rightLayers} nodes={data.nodes} counts={sideCounts}
      selected={activeSelectionId} related={related} rows={sideRows} onSelect={onSelectNode} />}
    {!!sideEdges.length && <svg className="dgt-side-links" aria-hidden="true">{sideEdges.map(({ edge, key }) => <g key={key}>
      <path fill="none" stroke={theme.accent} strokeWidth="1" strokeDasharray="3 5"
        ref={(element) => { if (element) paths.current.set(key, element); else paths.current.delete(key); }} />
      <circle r="2.5" fill={theme.flow}
        ref={(element) => { if (element) dots.current.set(key, element); else dots.current.delete(key); }} />
    </g>)}</svg>}
  </div>;
}
