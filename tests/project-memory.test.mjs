import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));

test('memory scopes config/index per project before importing pi-memory', async t => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'piru-memory-')));
  const agent = join(root, 'agent');
  const project = join(root, 'project');
  const nested = join(project, 'src');
  const other = join(root, 'other');
  const dependency = join(agent, 'npm/node_modules/pi-memory');
  mkdirSync(nested, { recursive: true });
  mkdirSync(join(project, '.git'));
  mkdirSync(other);
  mkdirSync(dependency, { recursive: true });
  writeFileSync(join(dependency, 'index.mjs'), `
const captured = { ...process.env };
export default async function(pi) { pi.capture(captured); }
`);
  const oldCwd = process.cwd();
  const oldEnv = { ...process.env };
  t.after(() => {
    process.chdir(oldCwd);
    for (const key of Object.keys(process.env)) if (!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env, oldEnv);
    rmSync(root, { recursive: true, force: true });
  });
  process.env.PIRU_TEST_AGENT_DIR = agent;
  process.chdir(nested);
  let source = stripTypeScriptTypes(readFileSync(join(repo, 'extensions/project-memory.ts'), 'utf8'));
  assert.match(source, /import \{ getAgentDir \} from "@earendil-works\/pi-coding-agent";/);
  source = source.replace('import { getAgentDir } from "@earendil-works/pi-coding-agent";',
    'const getAgentDir = () => process.env.PIRU_TEST_AGENT_DIR;');
  // Pi loads TypeScript dependencies itself; this isolated Node test uses an ESM stub.
  assert.match(source, /"pi-memory", "index.ts"/);
  source = source.replace('"pi-memory", "index.ts"', '"pi-memory", "index.mjs"');
  const modulePath = join(root, 'project-memory.mjs');
  writeFileSync(modulePath, source);
  const { default: configure } = await import(pathToFileURL(modulePath).href);
  let captured;
  await configure({ capture: env => { captured = env; } });
  const store = join(agent, 'memory/projects', createHash('sha256').update(project).digest('hex'));
  assert.equal(captured.PI_MEMORY_DIR, store);
  assert.equal(captured.PI_MEMORY_SNAPSHOT, 'stable');
  assert.equal(captured.PI_MEMORY_EXIT_SUMMARY, '0');
  assert.equal(captured.PI_MEMORY_SUMMARIZE_TRANSITIONS, '0');
  assert.equal(captured.PI_MEMORY_QMD_UPDATE, 'background');
  assert.equal(captured.PI_MEMORY_QMD_SEARCH_TIMEOUT_MS, '180000');
  assert.equal(captured.QMD_CONFIG_DIR, join(store, '.qmd'));
  assert.equal(captured.INDEX_PATH, join(store, '.qmd/index.sqlite'));
  assert.deepEqual(JSON.parse(readFileSync(join(store, '.project.json'), 'utf8')), {
    projectRoot: project, memoryDir: store,
  });
  process.chdir(project);
  await configure({ capture() {} });
  process.chdir(other);
  await assert.rejects(configure({ capture() {} }), /scope changed/);
});
