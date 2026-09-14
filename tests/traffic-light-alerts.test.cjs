const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const runtime = createRuntime();
const { roadIntersections, trafficLightIntersection, reachedIntersection } = runtime.load('src/modules/map/utils/trafficLightIntersections.ts');

const road = (coordinates, properties = {}) => ({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates } });
const junction = [38.0024, 9];
const route = [[38, 9], junction, [38.005, 9]];
const roads = [road(route), road([junction, [38.0024, 9.001]])];

test('shared road branches form a junction; duplicate style features do not add branches', () => {
    assert.deepEqual(roadIntersections([...roads, ...roads]), [junction]);
    assert.deepEqual(roadIntersections([roads[0], roads[0]]), []);
});

test('crossing lines, bridges, tunnels and paths do not create junctions', () => {
    assert.deepEqual(roadIntersections([road([[38, 9], [38.005, 9]]), road([[38.0024, 8.999], [38.0024, 9.001]])]), []);
    for (const properties of [{ brunnel: 'bridge' }, { tunnel: 'yes' }, { class: 'path' }, { layer: 1 }]) {
        assert.deepEqual(roadIntersections([roads[0], road([junction, [38.0024, 9.001]], properties)]), []);
    }
});
test('junction must be near the report, on route, and ahead at activation', () => {
    assert.deepEqual(trafficLightIntersection(route, [junction], [38.001, 9], [38, 9]), junction);
    assert.equal(trafficLightIntersection(route, [junction], [38.001, 9], [38.003, 9]), null);
    assert.equal(trafficLightIntersection(route, [[38.0024, 9.001]], [38.001, 9], [38, 9]), null);
    assert.equal(trafficLightIntersection(route, [[38.005, 9]], [38.001, 9], [38, 9]), null);
});

test('arrival clears at the junction or after a skipped GPS fix, but not on a parallel road', () => {
    assert.equal(reachedIntersection(route, junction, [38.001, 9]), false);
    assert.equal(reachedIntersection(route, junction, junction), true);
    assert.equal(reachedIntersection(route, junction, [38.003, 9]), true);
    assert.equal(reachedIntersection(route, junction, [38.003, 9.001]), false);
});

test('traffic light persists beyond its report and radius, then clears at the map junction', async () => {
    const t = value => value;
    let vibrations = 0;
    const rt = createRuntime({
        'expo-haptics': { notificationAsync: () => { vibrations++; }, NotificationFeedbackType: { Warning: 'warning' } },
        'react-i18next': { useTranslation: () => ({ t }) },
        'remoteConfigValues': { getAppConfig: () => ({ ruleAlertDistanceKm: 0.2, ruleClearDistanceKm: 0.05 }) },
    });

    const { useRuleAlerts } = rt.load('src/modules/map/hooks/useRuleAlerts.ts');
    const light = { id: 'light', lat: 9, lng: 38.0002, type: { name: 'Traffic Light', img: 'light.png' }, punishment: '' };
    const other = { ...light, id: 'other', lng: 38.0021, type: { name: 'Stop', img: 'stop.png' } };
    const rules = [light, other];
    let resolveQuery;

    const query = () => new Promise(resolve => { resolveQuery = resolve; });
    const render = (lng, navigation = true) => rt.render(p => useRuleAlerts(p, rules, navigation, route, query), { lat: 9, lng });

    assert.equal(render(38).ruleId, 'light');
    assert.equal(render(38.0003).ruleId, 'light', 'passing report must not clear');
    assert.equal(render(38.0021).ruleId, 'light', 'missing map data and a closer rule must not dismiss the light beyond 200m');
    resolveQuery(roads);

    await new Promise(resolve => setImmediate(resolve));

    assert.equal(render(38.0021).ruleId, 'light');
    assert.equal(vibrations, 1);

    assert.equal(render(38.0024), null, 'reaching junction clears');
    rules.pop();
    
    assert.equal(render(38.001), null, 'passed light stays dismissed');
    assert.equal(render(38, false), null);
    assert.equal(render(38).ruleId, 'light', 'new session resets');
});
