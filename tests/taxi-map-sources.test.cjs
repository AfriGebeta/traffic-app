const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
const geometry = createRuntime().load('src/modules/navigation/utils/taxiRoadGeometry.ts');

const source = fs.readFileSync('src/components/GebetaMap/index.tsx', 'utf8');
const component = source.slice(source.indexOf('const taxiLineAtPosition ='),
    source.indexOf("AnimatedSegmentedRoutes.displayName ="));

const code = ts.transpileModule(component, {
    compilerOptions: {
        target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
    }
}).outputText;
const React = { createElement: (type, props, ...children) => ({ type, props, children }), Fragment: 'Fragment' };
const render = new Function('React', 'memo', 'useMemo', 'useRef', 'useLayoutEffect',
    'useForegroundEpoch', 'createTaxiRoad', 'taxiRoadCoordinates', 'MapLibreGL', 'WALK_DASH_PATTERN',
    `${code}\nreturn AnimatedSegmentedRoutes;`)(React, fn => fn, fn => fn(), value => ({ current: value }),
        fn => fn(), () => 0, geometry.createTaxiRoad, geometry.taxiRoadCoordinates,
        { ShapeSource: 'Source', LineLayer: 'Layer' }, [1, 2]);
const shape = coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } });
const road = [[38, 9], [38.001, 9], [38.001, 9.01]];
const props = {
    segmentedRoutes: [{ segmentIndex: 0, isWalking: false, geoJSON: shape(road) }],
    animatedLat: 9, animatedLng: 38.0005, currentTaxiSegmentIndex: 0,
    taxiActiveRouteGeoJSON: shape(road), updatePositionRef: { current: null }, routeEpoch: 1
};


const sources = props => render(props).children.flat();
test('recalculation uses fresh native IDs so old cleanup cannot remove its replacement', () => {
    const before = sources(props)[0];
    const replacement = [[38, 9], [38.002, 9], [38.002, 9.01]];
    const after = sources({ ...props, routeEpoch: 2, taxiActiveRouteGeoJSON: shape(replacement) })[0];
    assert.notEqual(before.props.key, after.props.key);
    assert.notEqual(before.props.id, after.props.id);
    assert.deepEqual(after.props.shape.geometry.coordinates, [[38.0005, 9], ...replacement.slice(1)]);
});
test('boarding replaces an empty walking source with a distinct visible taxi source', () => {
    const before = sources({
        ...props, taxiActiveRouteGeoJSON: null,
        segmentedRoutes: [{ segmentIndex: 0, isWalking: true, geoJSON: shape([]) }]
    })[0];
    assert.ok(before, 'empty sources stay mounted while road geometry loads');
    const after = sources({ ...props, routeEpoch: 2 })[0];
    assert.notEqual(before.props.key, after.props.key);
    assert.notEqual(before.props.id, after.props.id);
    assert.equal(after.props.shape.geometry.coordinates.length, 3);
});
test('completed segments stay empty when passing full journey geometry to the renderer', () => {
    const result = sources({
        ...props, currentTaxiSegmentIndex: 1,
        segmentedRoutes: [...props.segmentedRoutes, { segmentIndex: 1, isWalking: false, geoJSON: shape(road) }]
    });
    assert.deepEqual(result[0].props.shape.geometry.coordinates, []);
    assert.equal(result[1].props.shape.geometry.coordinates.length, 3);
});


test('boarding and alighting use distinct native layers so walking dashes cannot leak into taxi lines', () => {
    const walking = sources({
        ...props,
        segmentedRoutes: [{ ...props.segmentedRoutes[0], isWalking: true }]
    })[0];
    const riding = sources(props)[0];
    const layers = source => source.children.flat().filter(child => child && child.type === 'Layer');
    const walkLayer = layers(walking).find(layer => layer.props.style.lineDasharray);
    const rideLayer = layers(riding).find(layer => layer.props.style.lineColor === '#3B82F6');
    assert.ok(walkLayer);
    assert.ok(rideLayer);
    assert.equal(walking.props.key, riding.props.key, 'preserve the geometry source across boarding');
    assert.notEqual(walkLayer.props.key, rideLayer.props.key, 'replace the paint layer when travel mode changes');
    assert.notEqual(walkLayer.props.id, rideLayer.props.id, 'native layers must not share retained dash state');
    assert.ok(layers(riding).filter(layer => layer.props.style.lineOpacity > 0).every(layer => !layer.props.style.lineDasharray), 'taxi line and casing are solid');
    const recalculated = layers(sources({ ...props, routeEpoch: 3 })[0]);
    assert.ok(recalculated.every(layer => !layers(riding).some(old => old.props.id === layer.props.id)),
        'replacement layers cannot collide with old native cleanup');
});

test('mode styling within a route revision keeps both layers and shows only the current mode', () => {
    let previous;
    for (const isWalking of [true, false, true, false, true]) {
        const source = sources({ ...props, segmentedRoutes: [{ ...props.segmentedRoutes[0], isWalking }] })[0];
        const layers = source.children.flat().filter(child => child && child.type === 'Layer');
        const ids = layers.map(layer => layer.props.id);
        if (previous) assert.deepEqual(ids, previous, 'no native layers are removed or recreated');
        previous = ids;
        assert.equal(layers.find(layer => layer.props.key === 'walk').props.style.lineOpacity > 0, isWalking);
        assert.equal(layers.find(layer => layer.props.key === 'taxi').props.style.lineOpacity > 0, !isWalking);
    }
});

test('boarded, got off, boarded replacements send each animated frame to the latest native source', () => {
    let previousIds = new Set();
    for (const [epoch, isWalking] of [[1, false], [2, true], [3, false]]) {
        const coordinates = [[38 + epoch * 0.01, 9], [38 + epoch * 0.01, 9.01]];
        const frame = { current: null };
        const source = sources({
            ...props, routeEpoch: epoch, updatePositionRef: frame,
            taxiActiveRouteGeoJSON: shape(coordinates),
            segmentedRoutes: [{ segmentIndex: 0, isWalking, geoJSON: shape(coordinates) }]
        })[0];
        assert.ok(!previousIds.has(source.props.id));
        previousIds.add(source.props.id);
        const updates = [];
        source.props.ref.current = { setNativeProps: update => updates.push(JSON.parse(update.shape)) };
        frame.current(9.002, coordinates[0][0]);
        frame.current(9.004, coordinates[0][0]);
        assert.deepEqual(updates.at(-1).geometry.coordinates, [[coordinates[0][0], 9.004], coordinates[1]]);
    }
});
