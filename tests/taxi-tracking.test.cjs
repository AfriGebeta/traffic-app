const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function harness() {
    const refs = [];
    const effects = [];
    let cursor = 0;
    let pending = [];
    let gps;
    const cache = new Map();
    const react = {
        useRef(value) {
            const index = cursor++;
            return refs[index] ??= { current: value };
        },
        useCallback: fn => fn,
        useEffect(fn, deps) {
            const index = cursor++;
            if (!effects[index] || deps.some((dep, i) => dep !== effects[index][i])) {
                pending.push(fn);
                effects[index] = deps;
            }
        },
    };


    function load(filename) {
        if (cache.has(filename)) return cache.get(filename);
        const module = { exports: {} };
        cache.set(filename, module.exports);
        const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
        }).outputText;
        const requireMock = id => {
            if (id === 'react') return react;
            if (id === 'expo-location') return {
                requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
                Accuracy: { BestForNavigation: 6 },
                watchPositionAsync: async (_, callback) => {
                    gps = callback;
                    return { remove() { } };
                },
            };
            if (id.endsWith('/toast')) return { showToast() { } };
            if (id.endsWith('/remoteConfigValues')) return {
                getAppConfig: () => ({
                    navGpsIntervalMs: 1000, offRouteThresholdM: 30,
                    offRouteDelayMs: 2000, headingMinSpeed: 1,
                }),
            };
            return load(path.resolve(path.dirname(filename), `${id}.ts`));
        };
        new Function('require', 'module', 'exports', '__DEV__', code)(requireMock, module, module.exports, false);
        return module.exports;
    }
    const { useLocationTracking } = load(path.resolve(__dirname, '../src/modules/navigation/hooks/useLocationTracking.ts'));
    return {
        render(props) {
            cursor = 0;
            pending = [];
            const result = useLocationTracking(props);
            pending.forEach(fn => fn());
            return result;
        },
        fix(lat, lng) {
            gps({ coords: { latitude: lat, longitude: lng, heading: null, speed: 0, accuracy: 5 } });
        },
    };
}

const leg = points => ({ type: 'walk', mode: 'pedestrian', polyline: '', overrideCoords: points });
const flatten = segments => segments.flatMap(seg => seg.overrideCoords.map(([lat, lng]) => [lng, lat]));
function setup(segments, activeIndex = 0) {
    const h = harness();
    const updates = [];
    const rawFixes = [];
    const props = {
        routeCoordinates: { current: segments ? flatten(segments) : [[38, 9], [38, 9.01]] },
        isNavigatingRef: { current: true }, mapRef: { current: null },
        isOffRoute: false, rerouteTimeout: { current: null },
        totalRouteDistance: 1000, totalRouteDuration: 600,
        onTaxiFix: fix => rawFixes.push(fix),
        taxiSegments: segments, activeSegmentIndexRef: { current: activeIndex },
        setUserLocation: location => updates.push({ location }),
        updateNavigationState: (location, routes) => updates.push({ location, routes }),
        setSegmentedRoutes() { }, setCurrentHeading() { }, setRouteGeoJSON() { },
        setRemainingDistance() { }, setRemainingTime() { }, setIsOffRoute() { }, setIsRecalculating() { },
        recalculateRoute: async () => { },
    };
    return { h, props, updates, rawFixes };
}

test('taxi matches the active leg, excluding a closer completed leg and the join', async () => {
    const { h, props, updates } = setup([
        leg([[9, 38], [9.01, 38]]),
        leg([[9, 38.0001], [9.01, 38.0001]]),
    ], 1);
    await h.render(props).startLocationTracking();
    h.fix(9.005, 38);
    assert.equal(updates.at(-1).location.lng, 38.0001);
    assert.equal(updates.at(-1).routes[0].geoJSON.geometry.coordinates.length, 0);
});

test('taxi keeps off-route GPS coordinates instead of pinning to the old line', async () => {
    const { h, props, updates } = setup([leg([[9, 38], [9.01, 38]])]);
    await h.render(props).startLocationTracking();
    h.fix(9.005, 38.002);
    assert.equal(updates.at(-1).location.lng, 38.002);
});

test('taxi reroute replays the latest fix and updates marker and trimmed line together', async () => {
    const { h, props, updates } = setup([leg([[9, 38], [9.01, 38]])]);
    await h.render(props).startLocationTracking();
    h.fix(9.005, 38.002);
    const count = updates.length;
    props.taxiSegments = [leg([[9.004, 38.002], [9.006, 38.002], [9.01, 38]])];
    props.routeCoordinates.current = flatten(props.taxiSegments);
    h.render(props);
    assert.equal(updates.length, count + 1, 'reroute must update without waiting for new GPS');
    const { location, routes } = updates.at(-1);
    assert.equal(location.lat, 9.005);
    assert.equal(location.lng, 38.002);
    assert.deepEqual(routes[0].geoJSON.geometry.coordinates, [[38.002, 9.006], [38, 9.01]]);
    h.fix(9.0055, 38.002);
    assert.equal(updates.at(-1).location.lat, 9.0055, 'tracking must continue after reroute');
});

test('normal navigation retains its existing snapping and does not replay taxi updates', async () => {
    const { h, props, updates } = setup();
    await h.render(props).startLocationTracking();
    h.fix(9.005, 38.002);
    assert.equal(updates.at(-1).location.lng, 38);
    const count = updates.length;
    h.render(props);
    assert.equal(updates.length, count);
});

test('taxi journey decisions receive raw GPS separately from the snapped display position', async () => {
    const { h, props, updates, rawFixes } = setup([leg([[9, 38], [9.01, 38]])]);
    await h.render(props).startLocationTracking();
    h.fix(9.005, 38.0001);
    assert.equal(updates.at(-1).location.lng, 38);
    assert.equal(rawFixes.at(-1).lng, 38.0001);
    assert.equal(rawFixes.at(-1).accuracy, 5);
});

test('normal navigation never emits taxi journey events', async () => {
    const { h, props, rawFixes } = setup();
    await h.render(props).startLocationTracking();
    h.fix(9.005, 38);
    assert.equal(rawFixes.length, 0);
});

test('repeated taxi leg switches clear old timer handles and GPS invokes the latest reroute callback', async () => {
    const { h, props } = setup([leg([[9, 38], [9.01, 38]])]);
    const requests = [];
    props.offRouteProfileRef = { current: { thresholdM: 30, delayMs: 0, minRetriggerMs: 0, headingDiverge: false } };
    props.recalculateRoute = async () => requests.push('initial');
    await h.render(props).startLocationTracking();
    for (let i = 0; i < 3; i++) {
        const staleTimer = setTimeout(() => { }, 10000);
        props.rerouteTimeout.current = staleTimer;
        props.taxiSegments = [{ ...leg([[9, 38], [9.01, 38]]), type: i % 2 ? 'walk' : 'taxi', mode: i % 2 ? 'pedestrian' : 'auto' }];
        props.recalculateRoute = async position => requests.push({ i, position });
        h.render(props);
        assert.equal(props.rerouteTimeout.current, null);
        h.fix(9.005, 38.002 + i * 0.001);
        h.fix(9.005, 38.002 + i * 0.001);
        await new Promise(resolve => setTimeout(resolve, 130));
        assert.deepEqual(requests.at(-1), { i, position: { lat: 9.005, lng: 38.002 + i * 0.001 } });
    }
    assert.equal(requests.length, 3);
});
