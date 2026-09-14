import { buildCumulativeDistances, snapToRouteDistance } from '../../navigation/utils/navigationUtils';

export type Coordinate = [number, number];

export function roadIntersections(features: GeoJSON.Feature[]): Coordinate[] {
    const nodes = new Map<string, { point: Coordinate; bearings: number[] }>();
    for (const feature of features) {

        const p = feature.properties ?? {};

        if (p.brunnel === 'bridge' || p.brunnel === 'tunnel' ||
            (p.bridge && p.bridge !== 'no') || (p.tunnel && p.tunnel !== 'no') ||
            (p.layer != null && Number(p.layer) !== 0) ||
            ['path', 'track', 'rail', 'transit', 'ferry'].includes(p.class)) continue;

        const lines = feature.geometry?.type === 'LineString' ? [feature.geometry.coordinates]
            : feature.geometry?.type === 'MultiLineString' ? feature.geometry.coordinates : [];

        for (const line of lines) {
            for (let i = 0; i < line.length; i++) {
                const point: Coordinate = [line[i][0], line[i][1]];
                const key = point.map(n => n.toFixed(6)).join(',');
                const node = nodes.get(key) ?? { point, bearings: [] };

                for (const neighbor of [line[i - 1], line[i + 1]]) {
                    if (!neighbor) continue;
                    const dx = (neighbor[0] - point[0]) * Math.cos(point[1] * Math.PI / 180);
                    const dy = neighbor[1] - point[1];

                    if (Math.hypot(dx, dy) < 1e-8) continue;
                    const angle = Math.atan2(dy, dx);

                    if (!node.bearings.some(b => Math.abs(Math.atan2(Math.sin(b - angle), Math.cos(b - angle))) < Math.PI / 12)) {
                        node.bearings.push(angle);
                    }
                }
                nodes.set(key, node);
            }
        }
    }
    return [...nodes.values()].filter(n => n.bearings.length >= 3).map(n => n.point);
}

export function routePosition(route: Coordinate[], point: Coordinate) {
    const cumulative = buildCumulativeDistances(route);
    return snapToRouteDistance(route, cumulative, point[1], point[0], 0, cumulative.at(-1) || 1);
}

export function trafficLightIntersection(route: Coordinate[], junctions: Coordinate[], rule: Coordinate, activation: Coordinate): Coordinate | null {
    if (route.length < 2) return null;

    const start = routePosition(route, activation).s;
    const report = routePosition(route, rule).s;
    
    const candidates = junctions.map(point => ({ point, ...routePosition(route, point) }))
        .filter(p => p.distance <= 20 && p.s >= start - 15 && Math.abs(p.s - report) <= 250)
        .sort((a, b) => Math.abs(a.s - report) - Math.abs(b.s - report));
    return candidates[0]?.point ?? null;
}

export function reachedIntersection(route: Coordinate[], junction: Coordinate, location: Coordinate): boolean {
    const current = routePosition(route, location);
    const target = routePosition(route, junction);
    return current.distance <= 30 && current.s >= target.s - 15;
}
