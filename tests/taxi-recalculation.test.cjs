const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const config = {
    taxiRerouteCooldownMs: 8000, taxiRerouteFailStreak: 2, taxiReplanGateStreak: 2,
    taxiReplanFloorWalkM: 500, taxiReplanRatioWalk: 2.5, taxiReplanFloorAutoM: 1500, taxiReplanRatioAuto: 2
};
const from = { lat: 9, lng: 38 };
const A = { lat: 9.001, lng: 38, name: 'A' };
const B = { lat: 9.01, lng: 38, name: 'B' };
const route = (ride = false) => ({
    planId: ride ? 2 : 1, destination: B,
    segments: [{
        mode: ride ? 'auto' : 'pedestrian', type: ride ? 'taxi' : 'walk',
        from, to: ride ? B : A, toNode: ride ? B : A, distance: 1, time: 60, polyline: ''
    }]
});
const response = () => ({
    data: {
        trip: {
            legs: [{ shape: 'shape', summary: { length: 1, time: 60 } }],
            summary: { length: 1, time: 60 }
        }
    }
});
function setup() {
    const requests = [], plans = [], patches = [], appliedPlans = [], busy = [];
    const runtime = createRuntime({
        '/remoteConfigValues': { getAppConfig: () => config }, '/toast': { showToast() { } },
        '/polyline': { decodePolyline: () => [[9, 38], [9.01, 38]] },
        '/navigation.service': { navigationService: { getNavigation: (request, options) => new Promise(resolve => requests.push({ request, options, resolve })) } },
        '/taxi.service': { taxiService: { requestTaxiNavigation: request => new Promise(resolve => plans.push({ request, resolve })) } },
    });


    const { useTaxiRecalculation } = runtime.load('src/modules/navigation/hooks/useTaxiRecalculation.ts');
    const props = {
        route: route(), currentSegmentIndexRef: { current: 0 }, isNavigatingRef: { current: true },
        pauseReroutingRef: { current: false }, onRoutePatched: r => patches.push(r), onReplanned: r => appliedPlans.push(r),
        setIsRecalculating: value => busy.push(value)
    };
    return { props, requests, plans, patches, appliedPlans, busy, render: () => runtime.render(useTaxiRecalculation, props) };
}

test('confirmation can reroute to B immediately; the old A response cannot overwrite it or clear its spinner', async () => {
    const h = setup();
    let hook = h.render();
    const old = hook.recalculateRoute(from, true);
    assert.deepEqual(h.requests[0].request.destination, [A.lat, A.lng]);
    hook.resetForJourneyChange();
    h.props.route = route(true);
    hook = h.render();
    const next = hook.recalculateRoute(from, true);
    assert.deepEqual(h.requests[1].request.destination, [B.lat, B.lng]);
    assert.equal(h.requests[1].request.costing, 'auto');
    h.requests[0].resolve(response()); await old;
    assert.equal(h.patches.length, 0);
    assert.equal(h.busy.at(-1), true);
    h.requests[1].resolve(response()); await next;
    assert.equal(h.patches.length, 1);
    assert.equal(h.patches[0].planId, 2);
    assert.equal(h.busy.at(-1), false);
});
test('an unanswered question allows the current leg reroute to finish', async () => {
    const h = setup();
    const hook = h.render();
    const pending = hook.recalculateRoute(from, true);
    h.props.pauseReroutingRef.current = true;
    await hook.recalculateRoute(from, true);
    assert.equal(h.requests.length, 1);
    h.requests[0].resolve(response()); await pending;
    assert.equal(h.patches.length, 1);
});
test('a full replan started before boarding cannot return the user to a walking state', async () => {
    const h = setup();
    let hook = h.render();
    hook.observeFix(from, false);
    const pending = hook.acceptSuggestion();
    hook.resetForJourneyChange();
    h.props.route = route(true);
    hook = h.render();
    h.plans[0].resolve({ ...route(), success: true }); await pending;
    assert.equal(h.appliedPlans.length, 0);
});
test('a route response after navigation stops is discarded', async () => {
    const h = setup();
    const pending = h.render().recalculateRoute(from, true);
    h.props.isNavigatingRef.current = false;
    h.requests[0].resolve(response()); await pending;
    assert.equal(h.patches.length, 0);
});

test('a visible question does not block starting a route to the confirmed target', async () => {
    const h = setup();
    h.props.route = route(true);
    h.props.pauseReroutingRef.current = true;
    const hook = h.render();
    const pending = hook.recalculateRoute(from, true);
    assert.equal(h.requests.length, 1);
    assert.deepEqual(h.requests[0].request.destination, [B.lat, B.lng]);
    h.requests[0].resolve(response()); await pending;
    assert.equal(h.patches.length, 1);
    hook.observeFix(from, false);
    await hook.acceptSuggestion();
    assert.equal(h.plans.length, 0, 'changing the journey still waits for confirmation');
});

test('repeated boarding and alighting cancels superseded requests and only draws the latest leg', async () => {
    const h = setup();
    const pending = [];
    let hook = h.render();
    for (let i = 0; i < 5; i++) {
        hook.resetForJourneyChange();
        h.props.route = { ...route(i % 2 === 0), planId: 10 + i };
        hook = h.render();
        pending.push(hook.recalculateRoute(from, true));
        if (i > 0) assert.equal(h.requests[i - 1].options.signal.aborted, true);
    }
    h.requests[4].resolve(response()); await pending[4];
    for (let i = 3; i >= 0; i--) { h.requests[i].resolve(response()); await pending[i]; }
    assert.equal(h.patches.length, 1);
    assert.equal(h.patches[0].planId, 14);
    assert.equal(h.requests[4].options.signal.aborted, false);
});
test('an empty route response exposes a recoverable error and a successful retry clears it', async () => {
    const h = setup();
    let hook = h.render();
    const pending = hook.recalculateRoute(from, true);
    h.requests[0].resolve(null); await pending;
    hook = h.render();
    assert.ok(hook.routeError);
    const retry = hook.recalculateRoute(from, true);
    h.requests[1].resolve(response()); await retry;
    assert.equal(h.render().routeError, null);
    assert.equal(h.patches.length, 1);
});
