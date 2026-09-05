const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const config = { taxiBoardingPromptRadiusM: 100, taxiDropoffPromptRadiusM: 150,
    taxiConfirmationSnoozeMs: 120000, taxiWalkingEndThresholdM: 40 };
const runtime = createRuntime({ '/remoteConfigValues': { getAppConfig: () => config },
    '/voice-navigation.service': { voiceNavigationService: { speakInstruction: async () => true } } });
const journey = runtime.load('src/modules/navigation/utils/taxiJourney.ts');
const A = { id: 1, name: 'A', lat: 9, lng: 38 };
const B = { id: 2, name: 'B', lat: 9.01, lng: 38 };
const C = { id: 3, name: 'C', lat: 9.011, lng: 38 };
const D = { id: 4, name: 'D', lat: 9.02, lng: 38 };
const origin = { lat: 8.995, lng: 38 };
const destination = { lat: 9.025, lng: 38 };
const leg = (from, to, ride = false, routeId) => ({ from, to, fromNode: from.id ? from : undefined,
    toNode: to.id ? to : undefined, type: ride ? 'taxi' : 'walk', mode: ride ? 'auto' : 'pedestrian',
    routeId, polyline: '', overrideCoords: [[from.lat, from.lng], [to.lat, to.lng]], distance: 1, time: 100 });
const trip = () => ({ success: true, planId: 1, origin, destination, startNode: A, endNode: D,
    segments: [leg(origin, A), leg(A, B, true), leg(B, C), leg(C, D, true), leg(D, destination)],
    summary: { estimatedFare: 25, currency: 'ETB' } });
const fix = (point, timestamp = 0, speed = 0) => ({ ...point, accuracy: 5, speed, timestamp });

test('boarding midway skips A and routes toward B from the actual position', () => {
    const from = fix({ lat: 8.998, lng: 38.001 });
    const route = journey.boardTaxiJourney(trip(), 0, from);
    assert.equal(route.segments[0].type, 'taxi');
    assert.equal(route.segments[0].toNode.name, 'B');
    assert.equal(route.segments[0].fromNode, undefined);
    assert.deepEqual(route.segments[0].overrideCoords, trip().segments[1].overrideCoords,
        'keep the taxi road visible while rerouting, without retaining the walking approach');
    assert.deepEqual(route.origin, from);
    assert.equal(route.segments.length, 4);
    assert.deepEqual(route.destination, destination);
});

test('boarding keeps road bends drawable before the replacement request completes', () => {
    const { createTaxiRoad, taxiRoadCoordinates } = runtime.load('src/modules/navigation/utils/taxiRoadGeometry.ts');
    const { decodeTaxiSegmentPaths } = runtime.load('src/modules/navigation/utils/navigationUtils.ts');
    const route = trip();
    route.segments[1].overrideCoords = [[9, 38], [9, 38.001], [9.01, 38.001]];
    for (const position of [{ lat: 9, lng: 38.0005 }, { lat: 8.998, lng: 38.002 }]) {
        const boarded = journey.boardTaxiJourney(route, 0, fix(position));
        const coordinates = decodeTaxiSegmentPaths(boarded.segments)[0].map(([lat, lng]) => [lng, lat]);
        const line = taxiRoadCoordinates(createTaxiRoad(coordinates), position.lat, position.lng);
        assert.deepEqual(line, position.lat === 9
            ? [[38.0005, 9], [38.001, 9], [38.001, 9.01]]
            : [[38.001, 9], [38.001, 9.01]],
        'preserve remaining bends from the projected position, without an off-road connector');
    }
});

test('getting off early skips B and walks from GPS toward the next boarding station C', () => {
    const from = fix({ lat: 9.009, lng: 38.002 });
    const route = journey.alightTaxiJourney(trip(), 1, from);
    assert.equal(route.segments[0].type, 'walk');
    assert.equal(route.segments[0].toNode.name, 'C');
    assert.deepEqual(route.segments[0].from, from);
    assert.equal(route.segments[0].fromNode, undefined);
    assert.deepEqual(route.segments[0].overrideCoords, trip().segments[2].overrideCoords,
        'keep the known walking road while the new route loads');
});

test('adjacent services require a walk/boarding confirmation after getting off', () => {
    const route = { ...trip(), segments: [leg(A, B, true, 1), leg(B, D, true, 2)] };
    const changed = journey.alightTaxiJourney(route, 0, fix(B));
    assert.equal(changed.segments[0].type, 'walk');
    assert.equal(changed.segments[1].type, 'taxi');
});

test('same-service edges merge, but unknown or different services preserve possible transfers', () => {
    for (const [firstId, secondId, expected] of [[1, 1, 2], [1, 2, 3], [undefined, undefined, 3]]) {
        const route = journey.prepareTaxiJourney({ ...trip(), segments: [leg(A, B, true, firstId), leg(B, D, true, secondId)] });
        assert.equal(route.segments.length, expected); // Includes initial boarding walk.
        assert.equal(route.segments[0].type, 'walk');
    }
});

test('final taxi endpoint still needs getting-off confirmation followed by final walking arrival', () => {
    const route = journey.alightTaxiJourney({ ...trip(), segments: [leg(A, destination, true)] }, 0, fix(B));
    assert.equal(route.segments[0].type, 'walk');
    assert.deepEqual(route.segments[0].to, destination);
});

function observeSeries(points, target, riding = false, offRoute = false) {
    let evidence = journey.emptyPromptEvidence();
    let prompt = null;
    for (const point of points) {
        ({ evidence, prompt } = journey.observeTaxiJourney(evidence, point, target, riding, offRoute,
            riding ? 150 : 100, point.timestamp));
    }
    return prompt;
}
test('near-station prompts require sustained accurate fixes; a single fix is insufficient', () => {
    assert.equal(observeSeries([fix(A)], A), null);
    assert.equal(observeSeries([0, 1000, 2000, 3000].map(t => fix(A, t)), A).kind, 'board');
    assert.equal(observeSeries([0, 1000, 2000, 3000].map(t => ({ ...fix(A, t), accuracy: 200 })), A), null);
});
test('passing outside the old radius can still raise a drop-off question', () => {
    const points = [fix({ lat: B.lat + 0.0018, lng: B.lng }, 0)];
    for (let t = 1000; t <= 6000; t += 1000) points.push(fix({ lat: B.lat + 0.0025, lng: B.lng }, t, 8));
    assert.equal(observeSeries(points, B, true).reason, 'passed');
});
test('sustained vehicle speed midway through a walk raises a boarding question', () => {
    const points = Array.from({ length: 11 }, (_, i) => fix({ lat: 8.99 - i * 0.00005, lng: 38 }, i * 1000, 6));
    assert.equal(observeSeries(points, A).kind, 'board');
});
test('stopped traffic does not imply getting off, even when off-route', () => {
    const points = Array.from({ length: 20 }, (_, i) => fix(A, i * 1000, 0));
    assert.equal(observeSeries(points, B, true, true), null);
});
test('moving on a different road while riding asks whether the taxi still heads to the drop-off', () => {
    const points = Array.from({ length: 16 }, (_, i) => fix({ lat: 8.99, lng: 38 + i * 0.0001 }, i * 1000, 8));
    assert.equal(observeSeries(points, B, true, true).reason, 'route');
});
test('a long GPS gap cannot count as sustained evidence', () => {
    assert.equal(observeSeries([fix(A, 0), fix(A, 30000)], A), null);
});

function hookSetup(route = trip()) {
    const r = createRuntime({ '/remoteConfigValues': { getAppConfig: () => config },
        '/voice-navigation.service': { voiceNavigationService: { speakInstruction: async () => true } } });
    const { useTaxiNavigation } = r.load('src/modules/navigation/hooks/useTaxiNavigation.ts');
    let arrivals = 0;
    const props = { taxiRoute: route, userLocation: fix(A), isOffRoute: false,
        isNavigatingRef: { current: true }, currentSegmentIndexRef: { current: 0 }, pauseReroutingRef: { current: false },
        onNavigationComplete: () => { arrivals++; }, onRouteUpdate: updated => { props.taxiRoute = updated; } };
    return { props, render: () => r.render(useTaxiNavigation, props), arrivals: () => arrivals };
}
test('proximity pauses rerouting but never advances silently; confirming and undo update the real hook', () => {
    const h = hookSetup();
    let output;
    for (const time of [0, 1000, 2000, 3000]) { h.props.userLocation = fix(A, time); output = h.render(); }
    assert.equal(output.isOnTaxi, false);
    assert.equal(output.currentSegmentIndex, 0);
    assert.equal(output.prompt.kind, 'board');
    assert.equal(h.props.pauseReroutingRef.current, true);
    output.confirmTransition();
    output = h.render();
    assert.equal(output.isOnTaxi, true);
    assert.equal(output.currentSegment.toNode.name, 'B');
    assert.equal(h.props.pauseReroutingRef.current, false);
    output.undoTransition();
    output = h.render();
    assert.equal(output.isOnTaxi, false);
    assert.equal(output.currentSegment.toNode.name, 'A');
});
test('Not yet snoozes automatic prompts but manual boarding remains available', () => {
    const h = hookSetup();
    let output;
    for (const time of [0, 1000, 2000, 3000]) { h.props.userLocation = fix(A, time); output = h.render(); }
    output.dismissPrompt();
    h.props.userLocation = fix(A, 4000);
    output = h.render();
    assert.equal(output.prompt, null);
    assert.equal(output.isOnTaxi, false);
    output.requestConfirmation();
    assert.equal(h.render().prompt.reason, 'manual');
});
test('final walking arrival fires once; riding at the endpoint does not finish the trip', () => {
    const riding = hookSetup({ ...trip(), segments: [leg(A, B, true)] });
    for (const t of [0, 1000, 2000, 3000]) { riding.props.userLocation = fix(B, t); riding.render(); }
    assert.equal(riding.arrivals(), 0);
    const walking = hookSetup({ ...trip(), segments: [leg(A, B)] });
    walking.props.userLocation = fix(B);
    walking.render(); walking.render();
    assert.equal(walking.arrivals(), 1);
});

test('ordinary walking detours do not ask whether the passenger boarded', () => {
    const points = Array.from({ length: 20 }, (_, i) => fix({ lat: 8.99, lng: 38 + i * 0.00002 }, i * 1000, 1.5));
    assert.equal(observeSeries(points, A, false, true), null);
});
test('a dismissed question is not repeated on the same leg after the snooze expires', () => {
    const originalNow = Date.now;
    let now = 1000000;
    Date.now = () => now;
    try {
        const h = hookSetup();
        let output;
        for (let i = 0; i <= 3; i++) { now += 1000; h.props.userLocation = fix(A, now); output = h.render(); }
        assert.equal(output.prompt.kind, 'board');
        output.dismissPrompt();
        now += 180000;
        for (let i = 0; i <= 5; i++) { now += 1000; h.props.userLocation = fix(A, now); output = h.render(); }
        assert.equal(output.prompt, null);
        output.requestConfirmation();
        assert.equal(h.render().prompt.reason, 'manual', 'manual corrections remain available');
    } finally { Date.now = originalNow; }
});
test('confirmation gets a quiet period before the next leg can ask a new question', () => {
    const originalNow = Date.now;
    let now = 1000000;
    Date.now = () => now;
    try {
        const h = hookSetup();
        let output = h.render();
        output.confirmTransition();
        output = h.render();
        for (let i = 0; i <= 5; i++) { now += 1000; h.props.userLocation = fix(B, now); output = h.render(); }
        assert.equal(output.prompt, null);
        now += 30000;
        for (let i = 0; i <= 3; i++) { now += 1000; h.props.userLocation = fix(B, now); output = h.render(); }
        assert.equal(output.prompt.kind, 'alight');
    } finally { Date.now = originalNow; }
});
test('progress retains completed steps through boarding, alighting, and undo', () => {
    const h = hookSetup();
    let hook = h.render();
    const modes = hook => hook.journeySegments.map(segment => segment.type);
    assert.deepEqual(modes(hook), ['walk', 'taxi', 'walk', 'taxi', 'walk']);
    hook.confirmTransition();
    hook = h.render();
    assert.equal(hook.journeySegmentIndex, 1);
    assert.deepEqual(modes(hook), ['walk', 'taxi', 'walk', 'taxi', 'walk']);
    hook.confirmTransition();
    hook = h.render();
    assert.equal(hook.journeySegmentIndex, 2);
    assert.deepEqual(modes(hook), ['walk', 'taxi', 'walk', 'taxi', 'walk']);
    hook.undoTransition();
    hook = h.render();
    assert.equal(hook.journeySegmentIndex, 1);
    assert.deepEqual(modes(hook), ['walk', 'taxi', 'walk', 'taxi', 'walk']);
    h.props.taxiRoute = { ...h.props.taxiRoute, segments: h.props.taxiRoute.segments.map(s => ({ ...s, time: 80 })) };
    hook = h.render();
    assert.equal(hook.journeySegmentIndex, 1);
    assert.equal(hook.journeySegments.length, 5, 'geometry patches do not duplicate history');
});
test('repeated mode confirmations never add steps to the original preview itinerary', () => {
    const original = { ...trip(), segments: [leg(origin, A), leg(A, B, true), leg(B, destination)] };
    const h = hookSetup(original);
    h.props.previewSegments = original.segments;
    let hook = h.render();
    for (const expected of [1, 2, 1, 2, 1, 2]) {
        hook.confirmTransition();
        hook = h.render();
        assert.equal(hook.journeySegments, original.segments);
        assert.deepEqual(hook.journeySegments.map(segment => segment.type), ['walk', 'taxi', 'walk']);
        assert.equal(hook.journeySegmentIndex, expected);
    }
});
