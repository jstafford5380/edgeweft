import { describe, expect, it } from 'vitest';
import { createGraphTheme, DEFAULT_BASE_COLOR } from './theme';

describe('graph palette', () => {
  it('preserves the existing violet shades by default', () => {
    const theme = createGraphTheme(DEFAULT_BASE_COLOR);
    expect(theme.background).toBe('#10111e');
    expect(theme.shelf).toBe('#262a60');
    expect(theme.accent).toBe('#b5abfc');
    expect(theme.sideBackground).toBe('#222431');
  });

  it('recolors the scene and UI together from a shorthand or full hex color', () => {
    const shorthand = createGraphTheme('#3b9');
    const full = createGraphTheme('#33bb99');
    expect(shorthand).toEqual(full);
    expect(full.accent).not.toBe(createGraphTheme(DEFAULT_BASE_COLOR).accent);
    expect(full.background).not.toBe('#10111e');
    expect(full.sideBackground).not.toBe('#222431');
  });

  it('uses the default palette for an invalid color', () => {
    expect(createGraphTheme('green')).toEqual(createGraphTheme(DEFAULT_BASE_COLOR));
  });

  it('provides a readable light palette and keeps base-color changes in both modes', () => {
    const light = createGraphTheme(DEFAULT_BASE_COLOR, 'light');
    expect(light.background).toBe('#f5f6fb');
    expect(light.text).toBe('#2d293b');
    expect(light.sideBackground).toBe('#eceaf4');
    expect(createGraphTheme('#33bb99', 'light').accent).not.toBe(light.accent);
    expect(createGraphTheme(DEFAULT_BASE_COLOR, 'dark')).toEqual(createGraphTheme(DEFAULT_BASE_COLOR));
  });
});
