/** GitHub Releases discovery only. Never downloads or executes an installer. */
const fs = require('node:fs');
const path = require('node:path');
const OWNER = 'VinaoGamez';
const REPO = 'BRFut';
const RELEASES_URL = `https://github.com/${OWNER}/${REPO}/releases`;
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=100`;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function parseVersion(input) {
  if (typeof input !== 'string' || input.length > 128) return null;
  const match = /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(input);
  if (!match) return null;
  const core = match.slice(1, 4).map(Number), pre = match[4]?.split('.') || [];
  if (!core.every(Number.isSafeInteger) || pre.some(p => /^\d+$/.test(p) && p.length > 1 && p[0] === '0')) return null;
  return { core, pre };
}

function compareVersions(left, right) {
  const a = parseVersion(left), b = parseVersion(right);
  if (!a || !b) throw new Error('Versão inválida');
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
  if (!a.pre.length || !b.pre.length) return Number(!a.pre.length) - Number(!b.pre.length);
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === undefined || b.pre[i] === undefined) return a.pre[i] === undefined ? -1 : 1;
    const x = a.pre[i], y = b.pre[i];
    if (x === y) continue;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return x.length === y.length ? (x > y ? 1 : -1) : (x.length > y.length ? 1 : -1);
    if (xn !== yn) return xn ? -1 : 1;
    return x > y ? 1 : -1;
  }
  return 0;
}

function trustedGithubUrl(value, expectedPath) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.port && !url.username && !url.password &&
      !url.search && !url.hash && url.pathname === expectedPath;
  } catch { return false; }
}

function selectRelease(releases, currentVersion) {
  if (!Array.isArray(releases)) throw new Error('Resposta inválida');
  let selected = null;
  for (const item of releases) {
    if (!item || item.draft || item.prerelease || typeof item.tag_name !== 'string') continue;
    // This first channel publishes stable releases only, with one unique tag.
    const tag = item.tag_name;
    if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag) || !parseVersion(tag)) continue;
    const version = tag.slice(1), name = `BR-Fut-${version}-instalador.exe`;
    const expectedPath = `/${OWNER}/${REPO}/releases/download/${tag}/${name}`;
    const asset = Array.isArray(item.assets) && item.assets.find(a => a?.name === name && a.state === 'uploaded' &&
      Number.isSafeInteger(a.size) && a.size > 0 && trustedGithubUrl(a.browser_download_url, expectedPath));
    if (!asset || (selected && compareVersions(version, selected.version) <= 0)) continue;
    selected = {
      version, tag, title: String(item.name || `BR Fut ${version}`).slice(0, 160),
      notes: typeof item.body === 'string' ? item.body.slice(0, 8000) : '',
      publishedAt: typeof item.published_at === 'string' ? item.published_at.slice(0, 40) : '',
      notesUrl: `${RELEASES_URL}/tag/${tag}`, installerUrl: asset.browser_download_url,
      size: asset.size,
    };
  }
  return { release: selected, state: !selected ? 'no-release' : compareVersions(selected.version, currentVersion) > 0 ? 'available' : 'up-to-date' };
}

async function readReleaseResponse(response) {
  if (!response.body) throw new Error('Resposta vazia');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Resposta muito grande'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isTrustedDesktopSender(event, contents) {
  if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame) return false;
  try {
    const url = new URL(event.senderFrame.url);
    return url.protocol === 'app:' && url.hostname === 'brfut' && !url.username && !url.password && !url.port &&
      ['/home.html', '/index.html'].includes(url.pathname);
  } catch { return false; }
}

function createUpdateService({ currentVersion, preferencesPath, currentNotes = '', fetchImpl = fetch, now = Date.now, onChange = () => {}, cooldownMs = 60_000, timeoutMs = 8_000 }) {
  if (!parseVersion(currentVersion)) throw new Error('Versão instalada inválida');
  let autoCheck = false;
  try {
    if (fs.statSync(preferencesPath).size < 8192) autoCheck = JSON.parse(fs.readFileSync(preferencesPath, 'utf8')).autoCheck === true;
  } catch { /* Missing/corrupt preference never prevents offline startup. */ }
  let status = { currentVersion, currentNotes: String(currentNotes).slice(0, 8000), state: 'idle', checkedAt: null, release: null, error: null };
  let pending = null, lastAttempt = -Infinity;
  const getStatus = () => ({ ...status, autoCheck, release: status.release ? { ...status.release } : null });
  const notify = () => { try { onChange(getStatus()); } catch { /* Closed renderer is not an update failure. */ } };
  function setAutoCheck(value) {
    if (typeof value !== 'boolean') throw new Error('Preferência inválida');
    fs.mkdirSync(path.dirname(preferencesPath), { recursive: true });
    const temporary = preferencesPath + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify({ autoCheck: value }) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, preferencesPath);
    autoCheck = value; notify(); return getStatus();
  }
  function check() {
    if (pending) return pending;
    if (now() - lastAttempt < cooldownMs) return Promise.resolve(getStatus());
    lastAttempt = now();
    status = { ...status, state: 'checking', error: null }; notify();
    pending = (async () => {
      try {
        const response = await fetchImpl(API_URL, {
          method: 'GET', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': `BRFut/${currentVersion}`, 'X-GitHub-Api-Version': '2022-11-28' },
        });
        if (response.status === 403 || response.status === 429) {
          status = { ...status, state: 'unavailable', error: 'rate-limited' };
        } else {
          if (!response.ok) throw new Error('GitHub indisponível');
          const result = selectRelease(await readReleaseResponse(response), currentVersion);
          status = { ...status, ...result, error: null };
        }
      } catch { status = { ...status, state: 'unavailable', error: 'network-unavailable' }; }
      status.checkedAt = new Date(now()).toISOString();
      notify(); return getStatus();
    })().finally(() => { pending = null; });
    return pending;
  }
  // Renderer supplies no URL. Only validated metadata in main may be opened.
  function getOpenUrl(kind) {
    if (kind === 'history') return RELEASES_URL;
    const release = status.release;
    if (kind === 'notes' && release) return release.notesUrl;
    if (kind === 'installer' && release && status.state === 'available') return release.installerUrl;
    throw new Error('Atualização não disponível');
  }
  return { getStatus, setAutoCheck, check, getOpenUrl };
}

module.exports = { parseVersion, compareVersions, selectRelease, trustedGithubUrl, readReleaseResponse, isTrustedDesktopSender, createUpdateService, RELEASES_URL, API_URL, MAX_RESPONSE_BYTES };
