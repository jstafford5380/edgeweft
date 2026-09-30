import { describe, expect, it } from 'vitest';
import { getConnectedNodes, validateGraph } from './graph';
import { graphEdgeTypes, graphNodeShapes, type GraphData, type GraphEdge } from './types';

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
    const edges: GraphEdge[] = [...data.edges, { source: 'a', target: 'c', type: 'call' }];
    expect([...getConnectedNodes('a', edges, new Set(['call']))]).toEqual(['a', 'c']);
  });

  it('reports references that cannot be rendered', () => {
    expect(validateGraph(data)).toEqual([]);
    expect(validateGraph({ ...data, edges: [{ source: 'a', target: 'missing' }] }))
      .toEqual(['Unknown edge target: missing']);
  });

  it('limits relationship types to the public categories', () => {
    expect(graphEdgeTypes).toEqual(['dependency', 'call', 'resource', 'association']);
    expect(validateGraph({ ...data, edges: [{ source: 'a', target: 'b', type: 'owner' as never }] }))
      .toContain('Unsupported edge type: owner');
  });

  it('validates directed links between 2D and 3D nodes', () => {
    expect(validateGraph({
      ...data,
      layers: [...data.layers, { id: 'teams', label: 'Teams', type: 'right2d' }],
      nodes: [...data.nodes, { id: 'team', label: 'Team', layerId: 'teams' }],
      edges: [...data.edges, { source: 'a', target: 'team' }],
    })).toEqual([]);
    expect(validateGraph({
      ...data,
      edges: [{ source: 'a', target: 'missing' }],
    })).toEqual(['Unknown edge target: missing']);
  });

  it('accepts 2D positions as ignored metadata and rejects unknown layer types', () => {
    const side: GraphData = {
      layers: [...data.layers, { id: 'side', label: 'Side', type: 'left2d' }],
      nodes: [...data.nodes, { id: 'side-node', label: 'Side', layerId: 'side', x: 5 }], edges: data.edges,
    };
    expect(validateGraph(side)).toEqual([]);
    expect(validateGraph({ ...side, layers: [...data.layers,
      { id: 'side', label: 'Side', type: 'floating' as never }] }))
      .toContain('Unsupported layer type for side: floating');
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
