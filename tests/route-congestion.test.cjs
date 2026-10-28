const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const runtime = createRuntime({
    '/remoteConfigValues': { getAppConfig: () => ({ congestionLowLengthM: 100, congestionMediumLengthM: 200, congestionHighLengthM: 400 }) },
});
const { buildCumulativeDistances, calculateDistance } = runtime.load('src/modules/navigation/utils/navigationUtils.ts');
const { buildCongestionShapes, computeCongestionSpans } = runtime.load('src/modules/navigation/utils/routeCongestion.ts');

// straight eastbound route, ~1.1 km
const coords = [[38.86, 9.02], [38.865, 9.02], [38.87, 9.02]];
const cum = buildCumulativeDistances(coords);
const at = (meters) => 38.86 + (meters / cum[cum.length - 1]) * 0.01;
const jam = (meters, level, extra = {}) => ({
    lat: 9.02,
    lng: at(meters),
    type: { name: 'TRAFFIC_JAM' },
    congestionLevel: level,
    heading: 90,
    ...extra,
});
const near = (a, b, tolerance = 1) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);

test('jam spans a third behind the reporter and two thirds ahead, sized by level', () => {
    const [low] = computeCongestionSpans(coords, cum, [jam(500, 'low')]);
    near(low.startS, 500 - 100 / 3);
    near(low.endS, 500 + 200 / 3);
    const [high] = computeCongestionSpans(coords, cum, [jam(500, 'high')]);
    near(high.endS - high.startS, 400);
});

test('opposite-direction reports and other incident types are ignored', () => {
    assert.equal(computeCongestionSpans(coords, cum, [jam(500, 'high', { heading: 270 })]).length, 0);
    assert.equal(computeCongestionSpans(coords, cum, [jam(500, 'high', { type: { name: 'ACCIDENT' } })]).length, 0);
    assert.equal(computeCongestionSpans(coords, cum, [jam(500, 'high', { congestionLevel: null })]).length, 0);
    assert.equal(computeCongestionSpans(coords, cum, [jam(500, 'high', { expiresAt: '2000-01-01T00:00:00Z' })]).length, 0);
});

test('reports without a heading need to sit closer to the line', () => {
    const offset = (meters) => ({ lat: 9.02 + meters / 111320 });
    assert.equal(computeCongestionSpans(coords, cum, [jam(500, 'low', { heading: null, ...offset(10) })]).length, 1);
    assert.equal(computeCongestionSpans(coords, cum, [jam(500, 'low', { heading: null, ...offset(25) })]).length, 0);
    assert.equal(computeCongestionSpans(coords, cum, [jam(500, 'low', offset(25))]).length, 1);
});

test('overlapping jams keep the worse level and spans clamp to the route', () => {
    const spans = computeCongestionSpans(coords, cum, [jam(500, 'low'), jam(650, 'high'), jam(10, 'medium')]);
    assert.equal(spans[0].startS, 0);
    assert.deepEqual(spans.map((s) => s.level), ['medium', 'low', 'high']);
    for (let i = 1; i < spans.length; i++) assert.ok(spans[i].startS >= spans[i - 1].endS);
});

test('an isolated span fades in and out over a quarter of its length', () => {
    const spans = computeCongestionSpans(coords, cum, [jam(500, 'low')]);
    const { low, medium, high } = buildCongestionShapes(coords, cum, spans);
    assert.equal(medium.features.length + high.features.length, 0);
    const lengthOf = (part) => {
        const line = low.features.find((f) => f.properties.part === part).geometry.coordinates;
        return calculateDistance(line[0][1], line[0][0], line[line.length - 1][1], line[line.length - 1][0]);
    };
    near(lengthOf('in'), 25);
    near(lengthOf('solid'), 50);
    near(lengthOf('out'), 25);
});

test('a worse neighbour blends over the lower level instead of dipping to the base colour', () => {
    const spans = computeCongestionSpans(coords, cum, [jam(500, 'medium'), jam(700, 'high')]);
    assert.deepEqual(spans.map((s) => s.level), ['medium', 'high']);
    const { medium, high } = buildCongestionShapes(coords, cum, spans);
    assert.deepEqual(medium.features.map((f) => f.properties.part), ['in', 'solid']);
    assert.deepEqual(high.features.map((f) => f.properties.part), ['in', 'out', 'solid']);
    const mediumSolidEnd = medium.features[1].geometry.coordinates.at(-1)[0];
    const highFadeEnd = high.features[0].geometry.coordinates.at(-1)[0];
    near(mediumSolidEnd, highFadeEnd, 1e-9);
});

test('navigation clips pieces at the puck and drops the ones already passed', () => {
    const { buildCongestionPieces, congestionShapeAt } = runtime.load('src/modules/navigation/utils/routeCongestion.ts');
    const pieces = buildCongestionPieces(computeCongestionSpans(coords, cum, [jam(500, 'low')]));
    // low span runs ~467..567: in 467..492, solid 492..542, out 542..567
    const parts = (fromS) => congestionShapeAt(coords, cum, pieces, 'low', fromS).features.map((f) => f.properties.part);
    assert.deepEqual(parts(0), ['in', 'out', 'solid']);
    assert.deepEqual(parts(480), ['in', 'out', 'solid']);
    assert.deepEqual(parts(500), ['out', 'solid']);
    assert.deepEqual(parts(550), ['out']);
    assert.deepEqual(parts(600), []);
    const clipped = congestionShapeAt(coords, cum, pieces, 'low', 480).features[0].geometry.coordinates;
    near(clipped[0][0], at(480), 1e-9);
});

test('the clip key only changes when the shape would', () => {
    const { buildCongestionPieces, congestionClipKey } = runtime.load('src/modules/navigation/utils/routeCongestion.ts');
    const pieces = buildCongestionPieces(computeCongestionSpans(coords, cum, [jam(500, 'low')]));
    assert.equal(congestionClipKey(pieces, 'low', 100), congestionClipKey(pieces, 'low', 300));
    assert.notEqual(congestionClipKey(pieces, 'low', 480), congestionClipKey(pieces, 'low', 481));
    assert.equal(congestionClipKey(pieces, 'high', 480), congestionClipKey(pieces, 'high', 481));
    assert.equal(congestionClipKey(pieces, 'low', 600), '0');
});
