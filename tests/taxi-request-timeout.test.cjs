const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRuntime } = require('./helpers/ts-hooks.cjs');
function setup() {
    const requests = [];
    const runtime = createRuntime({
        '/api': {
            apiService: {
                post: (path, payload, headers, signal) => new Promise(resolve => {
                    requests.push({ signal, resolve });
                })
            }
        },
        '/remoteConfigValues': { getAppConfig: () => ({}) },
    });
    return { service: runtime.load('src/modules/navigation/services/navigation.service.ts').navigationService, requests };
}


const request = { origin: [9, 38], destination: [9.01, 38], costing: 'auto' };
test('a hanging taxi request times out and the same trip can be requested again', async () => {
    const h = setup();
    await assert.rejects(h.service.getNavigation(request, { timeoutMs: 5 }), /timed out/);
    assert.equal(h.requests[0].signal.aborted, true);
    const retry = h.service.getNavigation(request, { timeoutMs: 1000 });
    assert.equal(h.requests.length, 2);
    h.requests[1].resolve({ data: { success: true } });
    assert.deepEqual(await retry, { success: true });
});
test('switching travel mode cancels the old taxi request without poisoning subsequent requests', async () => {
    const h = setup();
    const controller = new AbortController();
    const old = h.service.getNavigation(request, { timeoutMs: 1000, signal: controller.signal });
    controller.abort();
    await assert.rejects(old, /cancelled/);
    assert.equal(h.requests[0].signal.aborted, true);
    const next = h.service.getNavigation(request, { timeoutMs: 1000 });
    h.requests[1].resolve({ data: { latest: true } });
    assert.deepEqual(await next, { latest: true });
});
test('ordinary navigation retains request deduplication and has no taxi cancellation signal', async () => {
    const h = setup();
    const one = h.service.getNavigation(request);
    const two = h.service.getNavigation(request);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].signal, undefined);
    h.requests[0].resolve({ data: { normal: true } });
    assert.deepEqual(await one, await two);
});
