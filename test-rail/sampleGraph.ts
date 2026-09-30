import type { GraphData, GraphEdge, GraphEdgeType, GraphNode, GraphNodeShape } from '../src';

// Data and positions from the v3 Claude prototype. Side groups use ordinary nodes and edges.
const nodes: [string, string, number, number, number, string][] = [
  ['sessions', 'session-cache', 0, 30, -165, 'Redis'], ['usersdb', 'users-db', 0, 190, -150, 'Postgres'],
  ['ordersdb', 'orders-db', 0, 40, -10, 'Postgres'], ['stripe', 'stripe-api', 0, 200, -30, 'External API'],
  ['invdb', 'inventory-db', 0, 40, 125, 'Postgres'], ['es', 'search-index', 0, -115, 150, 'Elasticsearch'],
  ['kafka', 'event-bus', 0, 270, 70, 'Kafka'], ['cdn', 'asset-cdn', 0, -230, -110, 'S3 + CDN'],
  ['warehouse', 'warehouse', 0, 250, 200, 'Snowflake'],
  ['auth', 'auth-service', 1, 30, -165, 'Service'], ['users', 'user-service', 1, 190, -165, 'Service'],
  ['orders', 'order-service', 1, 50, -20, 'Service'], ['pay', 'payment-service', 1, 225, -45, 'Service'],
  ['inv', 'inventory-service', 1, 70, 120, 'Service'], ['search', 'search-service', 1, -115, 150, 'Service'],
  ['notif', 'notification-service', 1, 270, 70, 'Service'], ['analytics', 'analytics-worker', 1, 250, 200, 'Worker'],
  ['catalog', 'catalog-service', 1, -250, 30, 'Service'],
  ['web-bff', 'web-bff', 2, -150, -90, 'Node · GraphQL'], ['mobile-bff', 'mobile-bff', 2, 80, 40, 'Node · REST'],
  ['admin-bff', 'admin-bff', 2, 230, -100, 'Go · REST'],
  ['web-app', 'web-app', 3, -150, -90, 'React SPA'], ['mobile-app', 'mobile-app', 3, 80, 40, 'iOS / Android'],
  ['admin-console', 'admin-console', 3, 230, -100, 'Internal tool'],
  ['partner-portal', 'partner-portal', 3, -190, 140, 'Partner web'],
];

const edgeLists: Record<Extract<GraphEdgeType, 'dependency' | 'call' | 'resource'>, string> = {
  dependency: 'orders>pay orders>inv orders>notif pay>notif search>inv analytics>orders users>notif auth>users search>catalog invdb>es kafka>warehouse',
  call: 'web-app>web-bff partner-portal>web-bff mobile-app>mobile-bff admin-console>admin-bff web-bff>auth web-bff>orders web-bff>search web-bff>catalog mobile-bff>auth mobile-bff>orders mobile-bff>search mobile-bff>notif admin-bff>users admin-bff>inv admin-bff>analytics',
  resource: 'auth>sessions users>usersdb orders>ordersdb orders>kafka pay>stripe pay>kafka inv>invdb inv>kafka search>es notif>kafka analytics>warehouse analytics>kafka catalog>cdn web-app>cdn',
};
const edges: GraphEdge[] = (Object.entries(edgeLists) as [GraphEdgeType, string][]).flatMap(([type, list]) =>
  list.split(' ').map((pair) => { const [source, target] = pair.split('>'); return { source, target, type }; }),
);

const ownerList: [string, string, string][] = [
  ['o-clients', 'Client Apps', 'A. Kim'], ['o-exp', 'Experience', 'T. Nguyen'],
  ['o-back', 'Back Office', 'P. Rossi'], ['o-discovery', 'Discovery', 'L. Moreau'],
  ['o-identity', 'Identity', 'M. Chen'], ['o-commerce', 'Commerce', 'S. Patel'],
  ['o-platform', 'Platform', 'R. Okafor'], ['o-data', 'Data', 'J. Alvarez'],
];
const ownership = 'web-app>o-clients mobile-app>o-clients partner-portal>o-clients web-bff>o-exp mobile-bff>o-exp admin-console>o-back admin-bff>o-back auth>o-identity users>o-identity sessions>o-identity usersdb>o-identity orders>o-commerce pay>o-commerce inv>o-commerce ordersdb>o-commerce stripe>o-commerce invdb>o-commerce search>o-discovery catalog>o-discovery es>o-discovery notif>o-platform kafka>o-platform cdn>o-platform analytics>o-data warehouse>o-data';
const shapes: GraphNodeShape[] = ['cylinder', 'box', 'hexagon', 'panel'];
export const leftExampleNodes: GraphNode[] = [
  { id: 'cloud-provider', label: 'Cloud Provider', layerId: 'external', subtitle: 'Infrastructure' },
  { id: 'identity-provider', label: 'Identity Provider', layerId: 'external', subtitle: 'Authentication' },
  { id: 'support-vendor', label: 'Support Vendor', layerId: 'partners', subtitle: 'Operations' },
];
export const leftExampleEdges: GraphEdge[] = [
  { id: 'external-cloud', source: 'cloud-provider', target: 'cdn', type: 'association' },
  { id: 'external-identity', source: 'auth', target: 'identity-provider', type: 'call' },
  { id: 'external-peer', source: 'cloud-provider', target: 'identity-provider', type: 'association' },
  { id: 'partner-link', source: 'identity-provider', target: 'support-vendor', type: 'association' },
];

export const sampleGraph: GraphData = {
  layers: [
    { id: 'resources', key: 'L0', label: 'Resources', description: 'Datastores, queues and external APIs' },
    { id: 'components', key: 'L1', label: 'Components', description: 'Domain services and workers' },
    { id: 'bffs', key: 'L2', label: 'BFFs', description: 'Backends shaped for each client' },
    { id: 'apps', key: 'L3', label: 'Apps', description: 'User-facing clients' },
    { id: 'owners', label: 'Owners', description: 'Stays flat while the stack rotates', type: 'right2d' },
    { id: 'external', label: 'External systems', description: 'Optional left-side example', type: 'left2d' },
    { id: 'partners', label: 'Partners', description: 'Second left-side group', type: 'left2d' },
  ],
  nodes: [...nodes.map(([id, label, layer, x, z, subtitle]) => ({
    id, label, layerId: ['resources', 'components', 'bffs', 'apps'][layer], shape: shapes[layer],
    x: x * 1.5, z: z * 1.3, subtitle,
  })), ...ownerList.map(([id, label, lead]) => ({ id, label, subtitle: lead, layerId: 'owners' }))],
  edges: [...edges, ...ownership.split(' ').map((pair): GraphEdge => {
    const [source, target] = pair.split('>');
    return { source, target, type: 'association' };
  })],
};
