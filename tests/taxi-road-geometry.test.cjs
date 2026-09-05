const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const runtime = createRuntime();
const { createTaxiRoad, projectTaxiPosition, taxiRoadCoordinates } = runtime.load('src/modules/navigation/utils/taxiRoadGeometry.ts');
const { retargetTaxiMotion, sampleTaxiMotion } = runtime.load('src/modules/navigation/utils/taxiAnimation.ts');
const coordinates = [[38, 9], [38.001, 9], [38.001, 9.001], [38.002, 9.001]];
const road = createTaxiRoad(coordinates);

test('taxi animation follows every bend between GPS fixes instead of crossing the block', () => {
    let motion = retargetTaxiMotion(null, { lat: 9, lng: 38 }, 0, 1000, road);
    motion = retargetTaxiMotion(motion, { lat: 9.001, lng: 38.002 }, 1000, 1000, road);
    for (let frame = 1; frame <= 60; frame++) {
        const puck = sampleTaxiMotion(motion, 1000 + frame * 1000 / 60);
        assert.ok(projectTaxiPosition(road, puck.lat, puck.lng).distance < 0.001, 'puck must stay on a real road edge');
        const line = taxiRoadCoordinates(road, puck.lat, puck.lng);
        if (line.length) {
            assert.ok(Math.abs(line[0][0] - puck.lng) < 1e-10);
            assert.ok(Math.abs(line[0][1] - puck.lat) < 1e-10);
        }
    }
});


test('line retains the corner ahead of the animated puck even when GPS already passed it', () => {
    const line = taxiRoadCoordinates(road, 9, 38.0005);
    assert.deepEqual(line, [[38.0005, 9], ...coordinates.slice(1)]);
});
test('off-road position never creates a straight connector to the route', () => {
    const line = taxiRoadCoordinates(road, 9.0005, 38.0005);
    assert.ok(line.length < coordinates.length || line[0][0] !== coordinates[0][0], 'passed geometry stays trimmed');
    assert.ok(projectTaxiPosition(road, line[0][1], line[0][0]).distance < 0.001, 'line begins on the road');
    assert.notDeepEqual(line[0], [38.0005, 9.0005]);
});
test('missing road geometry leaves a gap instead of inventing a shortcut', () => {
    assert.deepEqual(taxiRoadCoordinates(null, 9, 38), []);
});
test('replacement route uses only its own road geometry', () => {
    const newRoad = createTaxiRoad([[38.003, 9], [38.003, 9.001], [38.002, 9.001]]);
    const line = taxiRoadCoordinates(newRoad, 9.0005, 38.003);
    assert.deepEqual(line, [[38.003, 9.0005], [38.003, 9.001], [38.002, 9.001]]);
});

test('moving off-road during recalculation never restores the passed section', () => {
    const line = taxiRoadCoordinates(road, 9.0006, 38.0013);
    assert.deepEqual(line, [[38.001, 9.0006], [38.001, 9.001], [38.002, 9.001]]);
});
