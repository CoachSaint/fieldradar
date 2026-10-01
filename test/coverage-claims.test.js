/**
 * The Coverage drawer may only claim what the code can show.
 *
 * It renders from SOURCE_REGISTRY in public/index.html, where each source carries
 * a `kind` — a claim about the code. These tests check every claim against the
 * code itself, so a drawer that says a source is live (or merely lists it as
 * connected) while nothing calls it fails here instead of reaching a user:
 *
 *   none         the module must not be imported or named by the app, api/ or
 *                vercel.json (no call path)
 *   browser/byok the page must really fetch() every evidence host
 *   generated    the generator must exist and be called
 *   unavailable  api/ai.js must answer 503, and the page must never call /api
 *
 * The drawer's own source is also scanned: the word "connected" may appear only
 * as "Not connected in this build", and no percentage may be typed in by hand.
 *
 *   node test/coverage-claims.test.js
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import handler from '../api/ai.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('public/index.html');

const REGISTRY_BEGIN = '/* SOURCE_REGISTRY:BEGIN */';
const REGISTRY_END = '/* SOURCE_REGISTRY:END */';
const SECTION_START = '/* ============ DATA SOURCES IN THIS BUILD ============ */';
const SECTION_END = '/* ============ UI atoms ============ */';

// The registry/status section describes sources, so it names them; everything
// else is "the app" for the purpose of finding a call path.
const sectionStart = html.indexOf(SECTION_START);
const sectionEnd = html.indexOf(SECTION_END);
assert.ok(sectionStart > 0 && sectionEnd > sectionStart, 'data-sources section markers must exist');
const sourcesSection = html.slice(sectionStart, sectionEnd);
const appCode = html.slice(0, sectionStart) + html.slice(sectionEnd);

const regJson = sourcesSection.slice(
  sourcesSection.indexOf('[', sourcesSection.indexOf(REGISTRY_BEGIN)),
  sourcesSection.indexOf('];', sourcesSection.indexOf(REGISTRY_BEGIN)) + 1,
);
const registry = JSON.parse(regJson);

const drawerStart = html.indexOf('id="modal-coverage"');
const drawerEnd = html.indexOf('</ModalDrawer>', drawerStart);
const drawerSource = html.slice(drawerStart, drawerEnd);

const walk = dir =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name).replace(/\\/g, '/')]);
const libFiles = walk('lib').filter(f => f.endsWith('.js'));
const apiSource = walk('api').filter(f => f.endsWith('.js')).map(read).join('\n') + '\n' + read('vercel.json');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exportsOf = src =>
  [...src.matchAll(/export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_$]+)/g)].map(m => m[1]);

test('the registry parses and every entry has a known kind and a unique id', () => {
  assert.ok(registry.length >= 6, 'registry should not be empty');
  const kinds = new Set(['bundled', 'browser', 'byok', 'generated', 'unavailable', 'none']);
  const ids = new Set();
  for (const src of registry) {
    assert.ok(kinds.has(src.kind), `unknown kind for ${src.id}: ${src.kind}`);
    assert.ok(!ids.has(src.id), `duplicate id ${src.id}`);
    ids.add(src.id);
    assert.ok(src.name && src.detail, `${src.id} needs a name and detail`);
  }
});

test('every adapter and enrichment module in lib/ is accounted for, with the exports it claims', () => {
  const candidates = libFiles.filter(f => f.startsWith('lib/adapters/') || f.startsWith('lib/enrichment/'));
  const claimed = registry.filter(s => s.module).map(s => s.module);
  assert.deepEqual([...claimed].sort(), [...candidates].sort(),
    'registry modules must equal the adapter/enrichment files in lib/ (add a registry entry for any new one)');
  for (const src of registry.filter(s => s.module)) {
    assert.deepEqual(exportsOf(read(src.module)).sort(), [...src.exports].sort(), `${src.module} exports`);
  }
});

test('any other lib/ file that performs HTTP is declared, so no live adapter can hide', () => {
  const declared = new Set(registry.filter(s => s.module).map(s => s.module));
  for (const f of libFiles) {
    if (/\bfetch\s*\(/.test(read(f))) assert.ok(declared.has(f), `${f} calls fetch() but is not in the registry`);
  }
});

test('kind "none": nothing in the app, api/ or vercel.json imports or names the module', () => {
  for (const src of registry.filter(s => s.kind === 'none')) {
    const base = path.basename(src.module, '.js');
    const needles = [src.module, `adapters/${base}`, `enrichment/${base}`, base, ...src.exports];
    for (const needle of needles) {
      assert.ok(!appCode.includes(needle), `${src.id}: app code mentions "${needle}", so it is not "none"`);
      assert.ok(!apiSource.includes(needle), `${src.id}: api/ or vercel.json mentions "${needle}", so it is not "none"`);
    }
  }
});

test('kind "browser" and "byok": the page really fetch()es every evidence host', () => {
  for (const src of registry.filter(s => s.kind === 'browser' || s.kind === 'byok')) {
    assert.ok(src.evidence && src.evidence.length > 0, `${src.id} must name its evidence`);
    for (const host of src.evidence) {
      const call = new RegExp('fetch\\(\\s*[`"\']https://' + esc(host));
      assert.ok(call.test(appCode), `${src.id}: no fetch() to ${host} in the app, so it cannot be claimed as live`);
    }
  }
});

test('kind "byok": the call carries the user\'s own key, not a bundled one', () => {
  const callModel = appCode.slice(appCode.indexOf('async function callModel'), appCode.indexOf('async function scoutLive'));
  assert.match(callModel, /cfg\.orKey/);
  assert.match(callModel, /cfg\.apiKey/);
});

test('kind "generated": the demo generator exists and is called', () => {
  for (const src of registry.filter(s => s.kind === 'generated')) {
    for (const needle of src.evidence) assert.ok(appCode.includes(needle), `${src.id}: missing "${needle}"`);
  }
  assert.match(appCode, /scoutDemo\(params\)/);
});

test('kind "unavailable": api/ai.js refuses with 503 and the page never calls /api', async () => {
  const res = { headers: {}, statusCode: null, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; } };
  await handler({ method: 'POST', headers: {}, body: { prompt: 'x' } }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'HOSTED_AI_UNAVAILABLE');
  assert.ok(!/fetch\(\s*[`"']\/?api\//.test(appCode), 'the page must not fetch() the hosted API');
  assert.ok(!/\/api\/ai/.test(appCode), 'the page must not reference /api/ai');
});

test('the drawer never says "connected" except as "Not connected in this build"', () => {
  const scrub = s => s.replace(/not connected in this build/gi, '');
  for (const [label, text] of [['drawer', drawerSource], ['registry and status section', sourcesSection]]) {
    assert.ok(!/connected/i.test(scrub(text)), `${label} contains a bare "connected"`);
  }
});

test('the drawer has no hand-typed percentage and no integrations the code does not contain', () => {
  assert.ok(!/\d+\s*%/.test(drawerSource), 'percentages must be computed (pctOf), not typed');
  for (const phantom of ['DeepSeek', 'GPT-4o', 'GPT-4']) {
    assert.ok(!html.slice(drawerStart, drawerEnd).includes(phantom), `drawer mentions ${phantom}`);
    assert.ok(!sourcesSection.includes(phantom), `registry mentions ${phantom}`);
  }
});

test('catalog stats are computed from the bundled events, not typed in', () => {
  const stats = sourcesSection.slice(sourcesSection.indexOf('const CATALOG_STATS'));
  assert.match(stats, /P0_SEED_EVENTS\.length/);
  assert.match(stats, /P0_SEED_EVENTS\.filter/);
  assert.ok(!/(total|appUrl|deadline|org)\s*:\s*\d+/.test(stats), 'no literal totals in CATALOG_STATS');
});
