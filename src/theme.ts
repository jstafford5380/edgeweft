/** The existing violet theme's base color. */
export const DEFAULT_BASE_COLOR = '#968ae0';

/** The application controls this appearance; the graph defaults to dark. */
export type GraphMode = 'dark' | 'light';

const darkReference = {
  background: '#10111e',
  shelf: '#262a60',
  shelfEmissive: '#423a6a',
  grid: '#796cbf',
  shelfGlow: '#9180e8',
  bright: '#d2cefd',
  accent: '#b5abfc',
  cylinder: '#595d6c',
  emissive: '#968ae0',
  edgeGlow: '#a99cf4',
  arrow: '#dcd4ff',
  flow: '#eee9ff',
  groundGrid: '#3e376d',
  shelfLabel: '#e7e5fe',
  nodeLabel: '#f5f4ff',
  toolbarBackground: '#1d1c31',
  toolbarBorder: '#aaa2da',
  toolbarText: '#c9c6df',
  toolbarIcon: '#a9a1db',
  toolbarStrong: '#f3f0ff',
  toolbarActive: '#a99bdf',
  toolbarHover: '#8880bc',
  toolbarFocus: '#c7b9ff',
  sideBackground: '#222431',
  sideHover: '#34314b',
  selectionBackground: '#232532',
  text: '#e9e9ed',
  muted: '#b2b6ca',
  subtle: '#9397ab',
  legend: '#cfd3e5',
  border: '#3f424d',
  selectionBorder: '#595d6c',
  selectedLabel: '#fff0b0',
  selectedNode: '#eee0ae',
  selectedEmissive: '#d7ba5b',
  selectedEdge: '#fff1ba',
} as const;

const lightReference: { readonly [K in keyof typeof darkReference]: string } = {
  background: '#f5f6fb',
  shelf: '#b9afe2',
  shelfEmissive: '#6a58ab',
  grid: '#9483c2',
  shelfGlow: '#9c87d3',
  bright: '#735cb4',
  accent: '#765fbc',
  cylinder: '#9b97a9',
  emissive: '#8c77c7',
  edgeGlow: '#aa93dc',
  arrow: '#5b439e',
  flow: '#6549a9',
  groundGrid: '#c8c2d9',
  shelfLabel: '#3e315f',
  nodeLabel: '#29243b',
  toolbarBackground: '#ffffff',
  toolbarBorder: '#9e91c0',
  toolbarText: '#514668',
  toolbarIcon: '#6d5c9d',
  toolbarStrong: '#2f2548',
  toolbarActive: '#b3a0e2',
  toolbarHover: '#d5c9ee',
  toolbarFocus: '#654aab',
  sideBackground: '#eceaf4',
  sideHover: '#ded8ec',
  selectionBackground: '#ffffff',
  text: '#2d293b',
  muted: '#625d72',
  subtle: '#777184',
  legend: '#514b62',
  border: '#c5bfd4',
  selectionBorder: '#ab9ac9',
  selectedLabel: '#745000',
  selectedNode: '#dba830',
  selectedEmissive: '#9e6b00',
  selectedEdge: '#765000',
};

/** Colors derived from a single base while retaining the original palette's relative shades. */
export type GraphTheme = { readonly [K in keyof typeof darkReference]: string };

type Hsl = { h: number; s: number; l: number };

function parseHex(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
  return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number];
}

function toHsl([r, g, b]: [number, number, number]): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const difference = max - min;
  const l = (max + min) / 2;
  if (difference === 0) return { h: 0, s: 0, l };
  const s = difference / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / difference) % 6
    : max === g ? (b - r) / difference + 2 : (r - g) / difference + 4;
  h = ((h * 60) + 360) % 360;
  return { h, s, l };
}

function fromHsl({ h, s, l }: Hsl): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const [r, g, b] = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0]
    : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma]
      : h < 300 ? [x, 0, chroma] : [chroma, 0, x];
  const shift = l - chroma / 2;
  return `#${[r, g, b].map((channel) => Math.round((channel + shift) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Derive a light or dark scene and UI palette from a CSS hex color; invalid input uses the default. */
export function createGraphTheme(baseColor: string, mode: GraphMode = 'dark'): GraphTheme {
  const reference = mode === 'light' ? lightReference : darkReference;
  const parsed = parseHex(baseColor) ?? parseHex(DEFAULT_BASE_COLOR)!;
  const base = toHsl(parsed);
  const original = toHsl(parseHex(DEFAULT_BASE_COLOR)!);
  if (base.h === original.h && base.s === original.s && base.l === original.l) return { ...reference };
  const hueOffset = base.h - original.h;
  const saturationScale = original.s ? base.s / original.s : 1;
  const lightnessOffset = base.l - original.l;
  const lightSurfaces = new Set(['background', 'sideBackground', 'sideHover', 'selectionBackground',
    'toolbarBackground', 'toolbarHover', 'toolbarActive']);
  return Object.fromEntries(Object.entries(reference).map(([name, color]) => {
    const shade = toHsl(parseHex(color)!);
    const dark = shade.l < 0.3;
    const surface = mode === 'light' && lightSurfaces.has(name);
    return [name, fromHsl({
      h: (shade.h + hueOffset + 360) % 360,
      s: Math.max(0, Math.min(1, shade.s * saturationScale * (surface ? 0.55 : 1))),
      l: Math.max(0.025, Math.min(0.975, shade.l + lightnessOffset * (surface ? 0.08 : dark ? 0.22 : mode === 'light' ? 0.35 : 0.55))),
    })];
  })) as GraphTheme;
}
