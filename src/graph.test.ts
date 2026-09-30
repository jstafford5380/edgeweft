import { describe, expect, it } from 'vitest';
import { getConnectedNodes, validateGraph } from './graph';
import { graphNodeShapes, type GraphData } from './types';

describe('graph helpers', () => {
  const data: GraphData = {
    layers: [{ id: 'services', label: 'Services' }],
    nodes: [
      { id: 'a', label: 'A', layerId: 'services', x: 0, z: 0 },
      { id: 'b', label: 'B', layerId: 'services', x: 1, z: 1 },
    ],
    edges: [{ source: 'a', target: 'b' }],
  };

  it('finds direct neighbors in either direction', () => {
    expect([...getConnectedNodes('a', data.edges)]).toEqual(['a', 'b']);
    expect([...getConnectedNodes('b', data.edges)]).toEqual(['b', 'a']);
  });

  it('only highlights neighbors on visible relationship types', () => {
    const edges = [...data.edges, { source: 'a', target: 'c', type: 'call' }];
    expect([...getConnectedNodes('a', edges, new Set(['call']))]).toEqual(['a', 'c']);
  });

  it('reports references that cannot be rendered', () => {
    expect(validateGraph(data)).toEqual([]);
    expect(validateGraph({ ...data, edges: [{ source: 'a', target: 'missing' }] }))
      .toEqual(['Unknown edge target: missing']);
  });

  it('validates 2D ownership links', () => {
    expect(validateGraph({
      ...data,
      owners: [{ id: 'team', label: 'Team' }],
      ownership: [{ nodeId: 'a', ownerId: 'team' }],
    })).toEqual([]);
    expect(validateGraph({
      ...data,
      owners: [{ id: 'team', label: 'Team' }],
      ownership: [{ nodeId: 'a', ownerId: 'missing' }],
    })).toEqual(['Unknown owner: missing']);
  });

  it('supports different node shapes in one layer and rejects unknown shapes', () => {
    expect(graphNodeShapes).toEqual(['cylinder', 'box', 'hexagon', 'panel']);
    expect(validateGraph({ ...data, nodes: [
      { ...data.nodes[0], shape: 'cylinder' },
      { ...data.nodes[1], shape: 'panel' },
    ] })).toEqual([]);
    expect(validateGraph({ ...data, nodes: [{ ...data.nodes[0], shape: 'sphere' as never }, data.nodes[1]] }))
      .toContain('Unsupported shape for a: sphere');
  });
});
