import assert from 'node:assert/strict';
import test from 'node:test';
import handler from '../api/ai.js';

function response() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

test('public requests cannot spend a configured key or obtain provider errors', async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFlag = process.env.FIELDRADAR_AI_ENABLED;
  const previousFetch = globalThis.fetch;
  let calls = 0;
  process.env.OPENROUTER_API_KEY = 'synthetic-secret-must-not-leak';
  process.env.FIELDRADAR_AI_ENABLED = 'true';
  globalThis.fetch = async () => { calls++; throw new Error('provider-private-detail'); };
  try {
    for (const body of [null, {}, { prompt: 'Find events', useSearch: true },
      { prompt: 'x'.repeat(1000000) }, { prompt: { forged: true } }]) {
      const res = response();
      await handler({ method: 'POST', headers: { origin: 'https://foreign.invalid', authorization: 'Bearer forged' }, body }, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.body.code, 'HOSTED_AI_UNAVAILABLE');
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.equal(res.headers['access-control-allow-origin'], undefined);
      assert.doesNotMatch(JSON.stringify(res.body), /synthetic-secret|provider-private-detail/);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
    if (previousFlag === undefined) delete process.env.FIELDRADAR_AI_ENABLED;
    else process.env.FIELDRADAR_AI_ENABLED = previousFlag;
  }
});

test('GET and preflight cannot activate the provider path', async () => {
  for (const method of ['GET', 'OPTIONS', 'PUT', 'DELETE']) {
    const res = response();
    await handler({ method }, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  }
});
