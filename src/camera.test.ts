import { describe, expect, it } from 'vitest';
import { cameraPoseForView, easeCubicInOut, interpolateCameraPose, layerZOffset } from './camera';

describe('camera transitions', () => {
  it('uses the prototype cubic easing curve', () => {
    expect(easeCubicInOut(0)).toBe(0);
    expect(easeCubicInOut(0.25)).toBeCloseTo(0.0625);
    expect(easeCubicInOut(0.5)).toBe(0.5);
    expect(easeCubicInOut(0.75)).toBeCloseTo(0.9375);
    expect(easeCubicInOut(1)).toBe(1);
  });

  it('takes the short route around the camera azimuth', () => {
    const from = { az: 170 * Math.PI / 180, pol: 1, r: 1000, tx: 0, ty: 0, tz: 0 };
    const to = { ...from, az: -170 * Math.PI / 180, r: 2000 };
    const halfway = interpolateCameraPose(from, to, 0.5);
    expect(halfway.az).toBeCloseTo(Math.PI);
    expect(halfway.r).toBe(1500);
  });

  it('centers a top view on the chosen layer', () => {
    const pose = cameraPoseForView('top', 2, 240, 1200);
    expect(pose.ty).toBe(480);
    expect(pose.pol).toBeCloseTo(0.0005);
  });

  it('moves back to frame a shelf that has grown for many nodes', () => {
    const standard = cameraPoseForView('top', 1, 240, 1200);
    const expanded = cameraPoseForView('top', 1, 240, 1200, 2160, 1160);
    expect(expanded.r).toBeCloseTo(standard.r * 2);
  });

  it('centers staggered shelves and tracks the chosen shelf in top view', () => {
    expect([0, 1, 2, 3].map((index) => layerZOffset(index, 4, 100))).toEqual([150, 50, -50, -150]);
    const top = cameraPoseForView('top', 2, 240, 1200, 1080, 580, 100, 4);
    expect(top.tz).toBe(-25);
    const compact = cameraPoseForView('3d', -1, 240, 1200);
    const spread = cameraPoseForView('3d', -1, 240, 1200, 1080, 580, 300, 4);
    const reverse = cameraPoseForView('3d', -1, 240, 1200, 1080, 580, -300, 4);
    expect(spread.r).toBeGreaterThan(compact.r);
    expect(reverse.r).toBe(spread.r);
    expect(layerZOffset(0, 4, -100)).toBe(-150);
    expect(spread.tz).toBe(0);
  });
});
