export type GraphView = '3d' | 'top' | 'side' | 'front';

export interface CameraPose {
  az: number;
  pol: number;
  r: number;
  tx: number;
  ty: number;
  tz: number;
}

export function cameraPoseForView(view: GraphView, focus: number, spacing: number, width: number): CameraPose {
  const scale = Math.max(1.3, 1200 / Math.max(width, 1));
  const mid = spacing * 1.35;
  if (view === 'top') return { az: 0, pol: 0.0005, r: 1200 * scale, tx: 0, ty: focus >= 0 ? focus * spacing : mid, tz: 25 };
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
