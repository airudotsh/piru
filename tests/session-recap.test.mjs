import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * The extension imports Pi runtime packages, which are only resolvable inside
 * Pi. Load it in plain Node by stubbing those two imports; every function under
 * test is pure and touches neither.
 */
async function loadExtension() {
  let source = stripTypeScriptTypes(readFileSync(join(repo, 'extensions/session-recap.ts'), 'utf8'));
  source = source
    .replace(/import \{[^}]*\} from "@earendil-works\/pi-ai[^"]*";/, 'const complete = async () => ({});')
    .replace(/import \{[^}]*\} from "@earendil-works\/pi-coding-agent";/, 'const getAgentDir = () => "/nonexistent-agent-dir";');
  assert.doesNotMatch(source, /@earendil-works/, 'a Pi import was left unstubbed');
  const path = join(repo, 'tests/.session-recap.tmp.mjs');
  writeFileSync(path, source);
  return import(pathToFileURL(path).href);
}

test('the recap line collapses markdown headings and newlines onto one line', async () => {
  const { collapseLine } = await loadExtension();
  const summary = '## Goal\nCurate and simplify the harness: remove unnecessary extensions.\n\n## Constraints\n- Keep it simple';
  const line = collapseLine(summary, 280);
  assert.equal(line.includes('\n'), false);
  assert.equal(line, '## Goal Curate and simplify the harness: remove unnecessary extensions. ## Constraints - Keep it simple');
});

test('truncation stays inside the character budget and marks the cut', async () => {
  const { collapseLine } = await loadExtension();
  const line = collapseLine('x'.repeat(500), 40);
  assert.equal(line.length, 40);
  assert.equal(line.endsWith('…'), true);
  assert.equal(collapseLine('short', 40), 'short');
});

test('a two-field reply is split, and a fieldless reply still yields one line', async () => {
  const { parseRecapReply, collapseLine } = await loadExtension();
  const parsed = parseRecapReply('TITLE: Replace the summary widget\nRECAP: I replaced the widget with an idle recap.\nNext: restart Pi.');
  assert.equal(parsed.title, 'Replace the summary widget');
  assert.equal(parsed.recap, 'I replaced the widget with an idle recap.\nNext: restart Pi.');
  assert.equal(collapseLine(parsed.recap, 280).includes('\n'), false);
  assert.equal(parseRecapReply('Just a recap sentence.').recap, 'Just a recap sentence.');
});

test('tool output bodies never reach the recap prompt', async () => {
  const { buildConversation } = await loadExtension();
  const conversation = buildConversation([
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'do the thing' }] } },
    { type: 'message', message: { role: 'toolResult', content: [{ type: 'text', text: 'X'.repeat(5000) }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }, { type: 'toolCall', name: 'bash' }] } },
  ], 400);
  assert.match(conversation, /User: do the thing/);
  assert.match(conversation, /Assistant: done \[tool: bash\]/);
  assert.equal(conversation.includes('XXXX'), false);
});

test('config falls back to defaults when the file is missing', async () => {
  const { loadRecapConfig, RECAP_DEFAULTS, RECAP_PROMPT } = await loadExtension();
  assert.deepEqual(loadRecapConfig('/nonexistent-agent-dir'), RECAP_DEFAULTS);
  assert.equal(RECAP_DEFAULTS.idleSeconds, 240);
  assert.match(RECAP_PROMPT, /no markdown/);
});
