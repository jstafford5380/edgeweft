/** Built-in camera presets for the full stack (`3d`) and orthogonal views. */
export type GraphView = '3d' | 'top' | 'side' | 'front';

export interface CameraPose {
  az: number;
  pol: number;
  r: number;
  tx: number;
  ty: number;
  tz: number;
}

export function layerZOffset(index: number, layerCount: number, spacing: number): number {
  return ((layerCount - 1) / 2 - index) * spacing;
}

export function cameraPoseForView(view: GraphView, focus: number, spacing: number, width: number,
  planeWidth = 1080, planeDepth = 580, zSpacing = 0, layerCount = 4): CameraPose {
  const stackDepth = planeDepth + Math.max(0, layerCount - 1) * Math.abs(zSpacing);
  const depth = view === 'top' ? planeDepth : stackDepth;
  const scale = Math.max(1.3, 1200 / Math.max(width, 1)) * Math.max(1, planeWidth / 1080, Math.sqrt(depth / 580));
  const mid = spacing * 1.35;
  if (view === 'top') return { az: 0, pol: 0.0005, r: 1200 * scale, tx: 0, ty: focus >= 0 ? focus * spacing : mid,
    tz: 25 + (focus >= 0 ? layerZOffset(focus, layerCount, zSpacing) : 0) };
  if (view === 'side') return { az: Math.PI / 2, pol: 1.46, r: 1350 * scale, tx: 0, ty: mid, tz: 0 };
  if (view === 'front') return { az: 0, pol: 1.47, r: 1500 * scale, tx: 0, ty: mid, tz: 0 };
  return { az: -0.497, pol: 1.02, r: 1650 * scale, tx: 0, ty: mid, tz: 0 };
}

export function easeCubicInOut(progress: number): number {
  const k = Math.max(0, Math.min(1, progress));
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

export function interpolateCameraPose(from: CameraPose, to: CameraPose, progress: number): CameraPose {
  const eased = easeCubicInOut(progress);
  const azDelta = Math.atan2(Math.sin(to.az - from.az), Math.cos(to.az - from.az));
  return {
    az: from.az + azDelta * eased,
    pol: from.pol + (to.pol - from.pol) * eased,
    r: from.r + (to.r - from.r) * eased,
    tx: from.tx + (to.tx - from.tx) * eased,
    ty: from.ty + (to.ty - from.ty) * eased,
    tz: from.tz + (to.tz - from.tz) * eased,
  };
}
