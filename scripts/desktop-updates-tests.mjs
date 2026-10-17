import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mountDesktopUpdatePanel } from '../js/ui/desktop-update-panel.js';
import { validateDesktopRelease } from './desktop-release-check.mjs';
const require = createRequire(import.meta.url);
const { parseVersion, compareVersions, selectRelease, createUpdateService, readReleaseResponse, isTrustedDesktopSender, API_URL, MAX_RESPONSE_BYTES } = require('../electron/updates.cjs');
const root = join(tmpdir(), 'opencode'); mkdirSync(root, { recursive: true });
const directory = mkdtempSync(join(root, 'brfut-updates-tests-'));
let passed = 0;
async function check(label, fn) { await fn(); passed++; console.log(`OK ${label}`); }
const release = (version, extra = {}) => ({ tag_name: `v${version}`, name: `BR Fut ${version}`, body: '<script>doNotExecute()</script>', published_at: '2026-10-17T12:00:00Z', draft: false, prerelease: false,
  assets: [{ name: `BR-Fut-${version}-instalador.exe`, state: 'uploaded', size: 90000000, browser_download_url: `https://github.com/VinaoGamez/BRFut/releases/download/v${version}/BR-Fut-${version}-instalador.exe` }], ...extra });
let sequence = 0;
const service = (overrides = {}) => createUpdateService({ currentVersion: '0.2.1', preferencesPath: join(directory, `preferences-${sequence++}.json`), fetchImpl: async () => new Response(JSON.stringify([release('0.2.2')])), ...overrides });

try {
  await check('semantic versions, prereleases, numeric order and invalid inputs', () => {
    assert.ok(compareVersions('0.2.10', '0.2.9') > 0);
    assert.ok(compareVersions('0.2.1', '0.2.1-beta.9') > 0);
    assert.ok(compareVersions('0.2.1-beta.10', '0.2.1-beta.2') > 0);
    assert.equal(compareVersions('v0.2.1+build.1', '0.2.1+build.2'), 0);
    for (const value of ['Alpha V.6.00', '0.02.1', '0.2', '../0.2.1', '0.2.1-beta.01', '999999999999999999.0.0', '', null]) assert.equal(parseVersion(value), null, String(value));
  });
  await check('pick newest eligible stable version, not publication order; never downgrade', () => {
    const data = [release('0.2.2'), release('0.2.10'), release('0.3.0', { draft: true }), release('0.4.0', { prerelease: true }), release('0.5.0', { assets: [] })];
    assert.equal(selectRelease(data, '0.2.1').release.version, '0.2.10');
    assert.equal(selectRelease(data, '0.2.10').state, 'up-to-date');
    assert.equal(selectRelease(data, '1.0.0').state, 'up-to-date');
    assert.equal(selectRelease([], '0.2.1').state, 'no-release');
    assert.throws(() => selectRelease({}, '0.2.1'));
  });
  await check('reject untrusted installer URLs, redirects in metadata and wrong assets', () => {
    const fixture = release('0.2.2');
    const valid = fixture.assets[0];
    for (const url of ['http://github.com/VinaoGamez/BRFut/releases/download/v0.2.2/BR-Fut-0.2.2-instalador.exe',
      valid.browser_download_url + '?redirect=https://evil.test', valid.browser_download_url + '#fragment',
      valid.browser_download_url.replace('github.com', 'github.com.evil.test'),
      valid.browser_download_url.replace('VinaoGamez', 'someone'),
      valid.browser_download_url.replace('https://', 'file://'),
      valid.browser_download_url.replace('github.com', 'user:password@github.com')]) {
      assert.equal(selectRelease([{ ...fixture, assets: [{ ...valid, browser_download_url: url }] }], '0.2.1').state, 'no-release', url);
    }
    assert.equal(selectRelease([{ ...fixture, assets: [{ ...valid, name: 'install.exe' }] }], '0.2.1').state, 'no-release');
    assert.equal(selectRelease([release('0.2.2', { tag_name: 'v0.2.2-beta.1' })], '0.2.1').state, 'no-release');
  });
  await check('no network on startup; explicit check uses only fixed endpoint and validated release', async () => {
    let requests = 0;
    const updater = service({ fetchImpl: async (url, options) => {
      requests++; assert.equal(url, API_URL); assert.equal(options.redirect, 'error'); assert.ok(options.signal);
      assert.equal(options.headers.Authorization, undefined);
      return new Response(JSON.stringify([release('0.2.2')]));
    } });
    assert.equal(requests, 0); assert.equal(updater.getStatus().autoCheck, false);
    const status = await updater.check(); assert.equal(status.state, 'available'); assert.equal(requests, 1);
    status.release.installerUrl = 'https://evil.test';
    assert.equal(updater.getOpenUrl('installer'), release('0.2.2').assets[0].browser_download_url);
    assert.throws(() => updater.getOpenUrl('file:///tmp/install.exe'));
  });
  await check('parallel requests coalesce and manual retries respect cooldown', async () => {
    let resolveFetch, calls = 0, time = 1000000;
    const updater = service({ now: () => time, fetchImpl: () => { calls++; return new Promise(resolve => { resolveFetch = resolve; }); } });
    const a = updater.check(), b = updater.check(); assert.equal(a, b); assert.equal(calls, 1);
    resolveFetch(new Response('[]')); await a;
    await updater.check(); assert.equal(calls, 1);
    time += 60001; const c = updater.check(); assert.equal(calls, 2);
    resolveFetch(new Response('[]')); await c;
  });
  await check('offline, HTTP errors, limits and malformed JSON are nonfatal states', async () => {
    for (const status of [403, 429, 500, 404]) {
      const updater = service({ fetchImpl: async () => new Response('', { status }) });
      const result = await updater.check(); assert.equal(result.state, 'unavailable');
      assert.equal(result.error, [403, 429].includes(status) ? 'rate-limited' : 'network-unavailable');
      assert.throws(() => updater.getOpenUrl('installer'));
    }
    const offline = service({ fetchImpl: async () => { throw new Error('secret-network-details'); } });
    const result = await offline.check(); assert.equal(result.state, 'unavailable'); assert.ok(!JSON.stringify(result).includes('secret-network-details'));
    assert.equal((await service({ fetchImpl: async () => new Response('not JSON') }).check()).state, 'unavailable');
  });
  await check('network timeout is handled without blocking the game', async () => {
    const keepAlive = setTimeout(() => {}, 100);
    try {
      const updater = service({ timeoutMs: 5, fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }) });
      assert.equal((await updater.check()).state, 'unavailable');
    } finally { clearTimeout(keepAlive); }
  });
  await check('oversized responses are rejected', async () => {
    await assert.rejects(readReleaseResponse(new Response('x'.repeat(MAX_RESPONSE_BYTES + 1))));
  });
  await check('opt-in persists separately and never writes career files', () => {
    const preferencesPath = join(directory, 'update-preferences.json');
    const careerPath = join(directory, 'career-save.json'); writeFileSync(careerPath, 'DO NOT CHANGE');
    const updater = service({ preferencesPath }); updater.setAutoCheck(true);
    assert.equal(service({ preferencesPath }).getStatus().autoCheck, true);
    updater.setAutoCheck(false); assert.equal(service({ preferencesPath }).getStatus().autoCheck, false);
    assert.throws(() => updater.setAutoCheck('true'));
    assert.deepEqual(JSON.parse(readFileSync(preferencesPath, 'utf8')), { autoCheck: false });
    assert.equal(readFileSync(careerPath, 'utf8'), 'DO NOT CHANGE');
    writeFileSync(preferencesPath, 'corrupt'); assert.equal(service({ preferencesPath }).getStatus().autoCheck, false);
    assert.ok(!readdirSync(directory).some(name => name.endsWith('.exe')));
  });
  await check('IPC accepts only own top-level app pages, not iframes or external origins', () => {
    const frame = { url: 'app://brfut/home.html' }, contents = { mainFrame: frame };
    const event = { sender: contents, senderFrame: frame };
    assert.equal(isTrustedDesktopSender(event, contents), true);
    frame.url = 'app://brfut/index.html?carreira=1'; assert.equal(isTrustedDesktopSender(event, contents), true);
    for (const url of ['https://github.com/', 'app://evil/index.html', 'app://brfut/other.html', 'file:///index.html']) {
      frame.url = url; assert.equal(isTrustedDesktopSender(event, contents), false);
    }
    frame.url = 'app://brfut/home.html';
    assert.equal(isTrustedDesktopSender({ sender: contents, senderFrame: { ...frame } }, contents), false);
    assert.equal(isTrustedDesktopSender({ ...event, sender: {} }, contents), false);
  });
  await check('release preflight enforces a unique matching version and changelog', () => {
    const data = { version: '0.2.1', lockVersion: '0.2.1', rootVersion: '0.2.1', tag: 'v0.2.1', notes: 'A release with documented changes, offline operation and saved-career compatibility.' };
    assert.equal(validateDesktopRelease(data).installer, 'BR-Fut-0.2.1-instalador.exe');
    for (const changed of [{ tag: 'v0.2.0' }, { notes: '' }, { version: '0.2.1-beta.1' }, { lockVersion: '0.2.0' }]) assert.throws(() => validateDesktopRelease({ ...data, ...changed }));
  });

  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.events = {}; this.attributes = {}; this.hidden = false; this.textContent = ''; this.classList = { toggle: () => {} }; }
    append(child) { this.children.push(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(event, fn) { this.events[event] = fn; }
    focus() { this.focused = true; }
    set innerHTML(_value) { throw new Error('Release metadata must never become HTML'); }
  }
  const document = { body: new Element('body'), createElement: tag => new Element(tag), getElementById(id) {
    const find = node => node.id === id ? node : node.children.map(find).find(Boolean);
    return find(this.body);
  } };
  await check('web version does not mount desktop controls or query the network', () => {
    assert.equal(mountDesktopUpdatePanel(document, undefined), null); assert.equal(document.body.children.length, 0);
  });
  await check('desktop panel is nonmodal, opt-in, text-only and never passes an external URL', async () => {
    let checks = 0, downloads = 0, removed = false;
    const initial = { currentVersion: '0.2.1', state: 'idle', autoCheck: false, currentNotes: 'Offline local changelog' };
    const available = { ...initial, state: 'available', release: { version: '0.2.2', notes: '<img src=x onerror=stealSave()>' } };
    const panel = mountDesktopUpdatePanel(document, { getStatus: async () => initial, check: async () => { checks++; return available; },
      onStatus: () => () => { removed = true; }, openInstaller: async (...args) => { assert.equal(args.length, 0); downloads++; },
      openNotes: async () => true, openHistory: async () => true, setAutoCheck: async value => ({ ...available, autoCheck: value }) });
    await new Promise(setImmediate);
    assert.equal(checks, 0); assert.equal(document.getElementById('desktopUpdatesPanel').hidden, true);
    document.getElementById('desktopUpdatesToggle').events.click();
    document.getElementById('desktopUpdatesCheck').events.click(); await new Promise(setImmediate);
    assert.equal(checks, 1);
    assert.equal(document.getElementById('desktopUpdatesBody').textContent, available.release.notes);
    assert.equal(document.getElementById('desktopUpdatesDownload').hidden, false);
    document.getElementById('desktopUpdatesDownload').events.click(); await new Promise(setImmediate);
    assert.equal(downloads, 1);
    document.getElementById('desktopUpdatesClose').events.click(); assert.equal(document.getElementById('desktopUpdatesPanel').hidden, true);
    panel.dispose(); assert.equal(removed, true);
  });
  console.log(`desktop-updates: ${passed} passed, 0 failed`);
} finally { rmSync(directory, { recursive: true, force: true }); }
