import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'piru-setup-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const agent = join(root, 'agent');
  const log = join(root, 'calls.log');
  mkdirSync(bin);
  mkdirSync(agent);
  for (const [name, path] of Object.entries({
    bash: '/bin/bash', cp: '/bin/cp', mkdir: '/bin/mkdir',
    cmp: '/usr/bin/cmp', date: '/bin/date', basename: '/usr/bin/basename',
    dirname: '/usr/bin/dirname', cat: '/bin/cat', node: process.execPath,
  })) symlinkSync(path, join(bin, name));
  writeFileSync(join(bin, 'pi'), `#!${process.execPath}
const fs = require('node:fs');
const path = process.env.PI_CODING_AGENT_DIR + '/settings.json';
const data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : {};
const source = process.argv[3];
data.packages ??= [];
if (!data.packages.some(p => (typeof p === 'string' ? p : p.source) === source)) data.packages.push(source);
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\\n');
fs.appendFileSync(process.env.PIRU_TEST_LOG, 'pi ' + process.argv.slice(2).join(' ') + '\\n');
`, { mode: 0o755 });
  writeFileSync(join(bin, 'npm'), `#!${process.execPath}
require('node:fs').appendFileSync(process.env.PIRU_TEST_LOG, 'npm ' + process.argv.slice(2).join(' ') + '\\n');
`, { mode: 0o755 });
  const env = { ...process.env, PATH: bin, PI_CODING_AGENT_DIR: agent, PIRU_TEST_LOG: log };
  return {
    agent, log,
    run: (...args) => spawnSync('/bin/bash', [join(repo, 'setup.sh'), ...args], { env, encoding: 'utf8' }),
  };
}

function success(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

test('dry run previews search dependency and leaves the target untouched', t => {
  const f = fixture(t);
  const result = f.run('--dry-run', '--no-mcp', '--with-memory-search');
  success(result);
  assert.match(result.stdout, /@tobilu\/qmd@2\.8\.3/);
  assert.deepEqual(readdirSync(f.agent), []);
});

test('install disables direct pi-memory loading and preserves unrelated settings', t => {
  const f = fixture(t);
  const settingsPath = join(f.agent, 'settings.json');
  writeFileSync(settingsPath, JSON.stringify({
    theme: 'keep-me', defaultModel: 'keep-model',
    packages: [{ source: 'npm:pi-memory@0.4.2', skills: [], extensions: ['index.ts'] }],
  }, null, 2) + '\n');
  success(f.run('--no-mcp'));
  const settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const sources = settings.packages.map(p => typeof p === 'string' ? p : p.source);
  assert.ok(!sources.some(source => source.startsWith('npm:@tintinweb/pi-subagents')));
  assert.ok(sources.includes('npm:@tintinweb/pi-tasks'));
  assert.ok(sources.includes('npm:@narumitw/pi-plan-mode'));
  assert.equal(settings.theme, 'keep-me');
  assert.equal(settings.defaultModel, 'keep-model');
  assert.deepEqual(settings.packages.find(p => p.source === 'npm:pi-memory@0.4.2'), {
    source: 'npm:pi-memory@0.4.2', skills: [], extensions: [],
  });
  assert.equal(readFileSync(join(f.agent, 'extensions/project-memory.ts'), 'utf8'),
    readFileSync(join(repo, 'extensions/project-memory.ts'), 'utf8'));
  assert.equal(readFileSync(join(f.agent, 'extensions/session-recap.ts'), 'utf8'),
    readFileSync(join(repo, 'extensions/session-recap.ts'), 'utf8'));
  assert.ok(!sources.some(source => source.startsWith('npm:pi-session-summary')));
  assert.equal(readdirSync(f.agent).filter(n => n.startsWith('settings.json.bak.')).length, 1);
  const saved = readFileSync(settingsPath, 'utf8');
  success(f.run('--no-mcp'));
  assert.equal(readFileSync(settingsPath, 'utf8'), saved);
  assert.equal(readdirSync(f.agent).filter(n => n.startsWith('settings.json.bak.')).length, 1);
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /^npm /m);
});

test('local search dependency is installed only when explicitly requested', t => {
  const f = fixture(t);
  success(f.run('--no-mcp', '--with-memory-search'));
  assert.match(readFileSync(f.log, 'utf8'), /^npm install -g @tobilu\/qmd@2\.8\.3$/m);
});

test('unknown flags fail before any installation', t => {
  const f = fixture(t);
  const result = f.run('--typo');
  assert.notEqual(result.status, 0);
  assert.deepEqual(readdirSync(f.agent), []);
});
