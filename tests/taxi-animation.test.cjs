const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const { retargetTaxiMotion, sampleTaxiMotion } = createRuntime().load('src/modules/navigation/utils/taxiAnimation.ts');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('one-second GPS fixes produce movement throughout every animation interval', () => {
    let motion = retargetTaxiMotion(null, { lat: 9, lng: 38 }, 0, 1000);
    for (let fix = 1; fix <= 5; fix++) {
        const now = fix * 1000;
        motion = retargetTaxiMotion(motion, { lat: 9 + fix * 0.0001, lng: 38 }, now, 1000);
        let last = sampleTaxiMotion(motion, now).lat;
        for (let frame = 1; frame <= 60; frame++) {
            const position = sampleTaxiMotion(motion, now + frame * 1000 / 60);
            close(position.lat - last, 0.0001 / 60);
            last = position.lat;
        }
    }
});

test('a fix arriving early continues from the current animation position', () => {
    let motion = retargetTaxiMotion(null, { lat: 9, lng: 38 }, 0, 1000);
    motion = retargetTaxiMotion(motion, { lat: 9.001, lng: 38 }, 1000, 1000);
    const before = sampleTaxiMotion(motion, 1500);
    motion = retargetTaxiMotion(motion, { lat: 9.002, lng: 38.001 }, 1500, 1000);
    assert.deepEqual(sampleTaxiMotion(motion, 1500), before);
    assert.ok(sampleTaxiMotion(motion, 1600).lat > before.lat);
});

test('a missing or stationary fix cannot cause movement beyond the last location', () => {
    const target = { lat: 9.001, lng: 38 };
    let motion = retargetTaxiMotion(null, { lat: 9, lng: 38 }, 0, 1000);
    motion = retargetTaxiMotion(motion, target, 1000, 1000);
    assert.deepEqual(sampleTaxiMotion(motion, 10000), target);
    motion = retargetTaxiMotion(motion, target, 10000, 1000);
    assert.deepEqual(sampleTaxiMotion(motion, 10500), target);
});



test('initialization after a reroute starts at the new position', () => {
    const target = { lat: 9.001, lng: 38.002 };
    const motion = retargetTaxiMotion(null, target, 1000, 1000);
    assert.deepEqual(sampleTaxiMotion(motion, 1000), target);
});
