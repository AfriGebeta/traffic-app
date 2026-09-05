const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');


test('off-route recovery starts immediately, retries without GPS, and stops when resolved', t => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const runtime = createRuntime();
    const hook = runtime.load('src/modules/navigation/hooks/useTaxiRouteRecovery.ts').useTaxiRouteRecovery;
    const calls = [];
    const props = {
        needsRoute: true, location: { lat: 9, lng: 38 },
        isNavigatingRef: { current: true }, recalculateRoute: async fix => calls.push(fix)
    };
    runtime.render(hook, props);
    assert.equal(calls.length, 1);
    t.mock.timers.tick(3000);
    assert.equal(calls.length, 2);
    props.location = { lat: 9.01, lng: 38.01 };
    runtime.render(hook, props);
    t.mock.timers.tick(3000);
    assert.deepEqual(calls.at(-1), props.location);
    props.needsRoute = false;
    runtime.render(hook, props);
    t.mock.timers.tick(6000);
    assert.equal(calls.length, 3);
});
