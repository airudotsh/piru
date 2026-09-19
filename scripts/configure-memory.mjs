// Keep pi-memory installed, but let project-memory.ts load it after setting its scope.
import { copyFileSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const agentDir = process.argv[2];
if (!agentDir) throw new Error('Usage: node scripts/configure-memory.mjs <agent-dir>');
const path = join(agentDir, 'settings.json');
const original = readFileSync(path, 'utf8');
const settings = JSON.parse(original);
if (!Array.isArray(settings.packages)) throw new Error('settings.json has no packages array');
let found = false;
let changed = false;
settings.packages = settings.packages.map(entry => {
  const source = typeof entry === 'string' ? entry : entry?.source;
  if (typeof source !== 'string' || !/^npm:pi-memory(?:@|$)/.test(source)) return entry;
  found = true;
  if (typeof entry === 'object' && Array.isArray(entry.extensions) && entry.extensions.length === 0) {
    return entry;
  }
  changed = true;
  return { ...(typeof entry === 'string' ? { source: entry } : entry), extensions: [] };
});
if (!found) throw new Error('pi-memory was not installed; refusing to change settings');
if (changed) {
  if (readFileSync(path, 'utf8') !== original) throw new Error('settings.json changed; retry setup');
  const suffix = `${Date.now()}-${process.pid}`;
  const backup = `${path}.bak.${suffix}`;
  copyFileSync(path, backup);
  const temp = `${path}.tmp.${suffix}`;
  writeFileSync(temp, JSON.stringify(settings, null, 2) + '\n', {
    mode: statSync(path).mode & 0o777, flag: 'wx',
  });
  renameSync(temp, path);
  console.log(`  Disabled direct pi-memory loading; backup: ${backup}`);
} else {
  console.log('  pi-memory already loads through project-memory.ts only');
}
