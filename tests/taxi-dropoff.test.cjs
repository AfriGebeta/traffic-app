const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const from = { lat: 9, lng: 38 };
const dropoff = { name: 'Different station', lat: 9.01, lng: 38 };
const destination = { lat: 9.02, lng: 38 };
const route = { origin: from, destination, summary: { estimatedFare: 25, currency: 'ETB' } };
function setup({ noRoad = false, noContinuation = false } = {}) {
    const calls = [];

    const r = createRuntime({
        '/navigation.service': {
            navigationService: {
                getNavigation: async request => {
                    calls.push(request);
                    return noRoad ? null : { data: { trip: { legs: [{ shape: 'shape' }], summary: { length: 1, time: 60 } } } };
                }
            }
        },
        '/taxi.service': {
            taxiService: {
                requestTaxiNavigation: async request => {
                    calls.push(request);
                    return noContinuation ? { success: false } : {
                        success: true, origin: dropoff, destination,
                        segments: [{ type: 'walk', mode: 'pedestrian', from: dropoff, to: destination, polyline: '', distance: 1, time: 600 }],
                        summary: { estimatedFare: 10, currency: 'ETB' }
                    };
                }
            }
        },
        '/polyline': { decodePolyline: () => [[9, 38], [9.01, 38]] },
    });
    return { calls, change: r.load('src/modules/navigation/services/taxiJourney.service.ts').changeTaxiDropoff };
}
test('a different taxi destination changes the ride target and plans onward to the original final destination', async () => {
    const h = setup();
    const result = await h.change(route, from, dropoff);
    assert.equal(result.segments[0].type, 'taxi');
    assert.equal(result.segments[0].toNode.name, dropoff.name);
    assert.deepEqual(result.destination, destination);
    assert.deepEqual(h.calls[1], { origin: [dropoff.lat, dropoff.lng], destination: [destination.lat, destination.lng] });
    assert.equal(result.summary.pricingSource, 'onward-only');
    assert.equal(route.summary.estimatedFare, 25, 'original trip is preserved for undo');
});
test('a taxi going directly to the final destination needs no extra taxi plan', async () => {
    const h = setup();
    const result = await h.change(route, from, { ...destination, name: 'Destination' });
    assert.equal(h.calls.length, 1);
    assert.equal(result.segments[1].type, 'walk');
    assert.deepEqual(result.segments[1].to, destination);
});


test('failed alternative routing is recoverable and does not mutate the current journey', async () => {
    const original = structuredClone(route);
    await assert.rejects(setup({ noRoad: true }).change(route, from, dropoff));
    await assert.rejects(setup({ noContinuation: true }).change(route, from, dropoff));
    assert.deepEqual(route, original);
});
