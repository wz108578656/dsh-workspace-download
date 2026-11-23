/**
 * Static checks for the files that ship in the bundle.
 * Run from the repo root: node scripts/selftest.mjs
 */
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

const repo = JSON.parse(read('../package.json'));
assert(repo.private === true, 'repo package stays private');
assert(repo.license === 'MIT', 'repo license');
assert(repo.scripts.test === 'node scripts/selftest.mjs', 'repo test script');

const pkg = JSON.parse(read('../plugin/package.json'));
assert(pkg.name === 'dsh-workspace-download', 'package name');
assert(pkg.license === 'MIT', 'bundle license');
assert(pkg.dsh.bundle.patch === './cordis.patch.yml', 'bundle patch');
assert(pkg.dsh.client.platform === 'web', 'client platform');
assert(pkg.dsh.client.immediately === true, 'client loads immediately');
assert(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'), 'client inject');
assert(pkg.exports['./client'] === './client.js', 'client export');
assert(pkg.exports['./icon'] === './icon.svg', 'icon export');
assert(pkg.exports['./package.json'] === './package.json', 'package export');
assert(pkg.files.includes('client.js') && pkg.files.includes('icon.svg'), 'files list');
assert(pkg.repository.directory === 'plugin', 'repository directory');

const patch = read('../plugin/cordis.patch.yml');
assert(patch.includes('id: workspace-download'), 'patch row id');
assert(patch.includes('name: dsh-workspace-download'), 'patch row name');

for (const locale of ['en', 'zh']) {
	const dict = JSON.parse(read(`../plugin/locale/${locale}.json`));
	assert(dict.meta.title && dict.meta.description, `${locale} meta`);
	assert(dict.title && dict.downloadSelected && dict.downloadAll, `${locale} core strings`);
}

const zh = JSON.parse(read('../plugin/locale/zh.json'));
const en = JSON.parse(read('../plugin/locale/en.json'));
const missing = Object.keys(zh).filter((key) => !(key in en));
const extra = Object.keys(en).filter((key) => !(key in zh));
assert(missing.length === 0 && extra.length === 0, `locale key parity: missing ${missing} extra ${extra}`);

const icon = read('../plugin/icon.svg');
assert(icon.startsWith('<svg') && icon.includes('</svg>'), 'icon svg');
assert(Buffer.byteLength(icon) < 256 * 1024, 'icon size');

const client = read('../plugin/client.js');
assert(client.startsWith('window.__ModuleLoader__.load('), 'module loader');
assert(client.includes("id: 'dsh-workspace-download',"), 'client id matches package name');
assert(client.includes('export function apply') === false, 'host export stays out of client');
assert(client.includes("inject: ['slots', 'locale', 'remote', 'remote.workspaceFiles']"), 'client inject list');
// The remote client answers { ok, value }; reading it as the payload made every
// directory look empty and every file look missing.
assert(client.includes('async function callFile'), 'remote envelope unwrap');
assert(client.includes('result.ok === false'), 'remote failure branch');
// One host read window is 2 MiB, so a bigger file has to be read in ranges.
assert(client.includes('const READ_WINDOW = 2 * 1024 * 1024'), 'read window');
assert(client.includes('range: { offset: offset, length: READ_WINDOW }'), 'ranged read');
// Two host limits are echoed in the UI, so the caps must stay named constants.
assert(client.includes('const MAX_FILE_BYTES = 32 * 1024 * 1024'), 'per-file cap');
assert(client.includes('const MAX_TOTAL_BYTES = 64 * 1024 * 1024'), 'total cap');
assert(client.includes('const MAX_FILES = 400'), 'file cap');
// A single selected file downloads as itself; a group is zipped without the
// workspace path in front of every entry.
assert(client.includes('const single = entries.length === 1'), 'single-file direct download');
assert(client.includes('function flattenEntries'), 'flat archive entries');
assert(client.includes('function archiveNameOf'), 'archive naming');
assert(client.includes('function buildZip'), 'zip writer');

const host = read('../plugin/index.js');
assert(host.includes('export function apply'), 'host half exports apply');
assert(host.includes('__ModuleLoader__') === false, 'host half stays out of the browser loader');

console.log('selftest: plugin/ is structurally sound');
