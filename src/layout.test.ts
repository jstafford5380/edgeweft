import { describe, expect, it } from 'vitest';
import { layoutGraph } from './layout';
import { validateGraph } from './graph';
import type { GraphData } from './types';

const layers = [{ id: 'lower', label: 'Lower' }, { id: 'upper', label: 'Upper' }];

describe('automatic graph layout', () => {
  it('keeps pinned positions and places other nodes clear of them', () => {
    const data: GraphData = {
      layers,
      nodes: [
        { id: 'pinned', label: 'Pinned', layerId: 'lower', x: 0, z: 0 },
        { id: 'a', label: 'A', layerId: 'lower' },
        { id: 'b', label: 'B', layerId: 'lower' },
      ],
      edges: [{ source: 'a', target: 'pinned' }],
    };
    const { nodes } = layoutGraph(data);
    expect(nodes.find((node) => node.id === 'pinned')).toMatchObject({ x: 0, z: 0 });
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(Math.abs(nodes[i].x - nodes[j].x) >= 150 || Math.abs(nodes[i].z - nodes[j].z) >= 95).toBe(true);
      }
    }
  });

  it('uncrosses a simple pair of directed links', () => {
    const data: GraphData = {
      layers,
      nodes: ['a', 'b'].map((id) => ({ id, label: id, layerId: 'upper' }))
        .concat(['c', 'd'].map((id) => ({ id, label: id, layerId: 'lower' }))),
      edges: [{ source: 'a', target: 'd' }, { source: 'b', target: 'c' }],
    };
    const positions = new Map(layoutGraph(data).nodes.map((node) => [node.id, node]));
    const length = (a: string, b: string) => {
      const first = positions.get(a)!;
      const second = positions.get(b)!;
      return Math.hypot(first.x - second.x, first.z - second.z);
    };
    expect(length('a', 'd') + length('b', 'c')).toBeLessThan(length('a', 'c') + length('b', 'd'));
  });

  it('grows the shelf for a dense layer without overlaps and stays deterministic', () => {
    const data: GraphData = {
      layers: [layers[0]],
      nodes: Array.from({ length: 60 }, (_, index) => ({ id: `node-${index}`, label: `Node ${index}`, layerId: 'lower' })),
      edges: [],
    };
    const first = layoutGraph(data);
    const second = layoutGraph({ ...data, nodes: [...data.nodes].reverse() });
    expect(first.width > 1080 || first.depth > 580).toBe(true);
    expect(new Map(first.nodes.map((node) => [node.id, [node.x, node.z]])))
      .toEqual(new Map(second.nodes.map((node) => [node.id, [node.x, node.z]])));
    for (let i = 0; i < first.nodes.length; i++) {
      for (let j = i + 1; j < first.nodes.length; j++) {
        expect(Math.abs(first.nodes[i].x - first.nodes[j].x) >= 150 || Math.abs(first.nodes[i].z - first.nodes[j].z) >= 95).toBe(true);
      }
    }
  });

  it('rejects an incomplete manual position', () => {
    expect(validateGraph({ layers, nodes: [{ id: 'a', label: 'A', layerId: 'upper', x: 2 }], edges: [] }))
      .toContain('Incomplete position for a: supply both x and z');
  });
});
