import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { escapeHtml, escapeHtmlAttribute } from '../js/core/html-safe.js';
import { isUploadedCrestImage } from '../js/engine/custom-clubs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const crestEditor = fs.readFileSync(path.join(root, 'js/ui/crest-editor.js'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const gameHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
assert.equal(escapeHtmlAttribute('" onmouseover="alert(1)'), '&quot; onmouseover=&quot;alert(1)');
assert.equal(isUploadedCrestImage('data:image/png;base64,AAAA'), true);
assert.equal(isUploadedCrestImage('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+'), false);
assert.doesNotMatch(crestEditor, /insertAdjacentHTML\('beforeend',\s*inlineSvg\)/);
assert.doesNotMatch(crestEditor, /image\/svg\+xml/);
assert.doesNotMatch(homeHtml.match(/Content-Security-Policy[^>]+/)?.[0] || '', /script-src[^;]*unsafe-inline/);
assert.doesNotMatch(gameHtml.match(/Content-Security-Policy[^>]+/)?.[0] || '', /script-src[^;]*unsafe-inline/);

console.log('frontend-security-tests: OK');
