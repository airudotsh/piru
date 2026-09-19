/**
 * session-recap — an OMP-style idle recap for Pi.
 *
 * Why this exists: `pi-session-summary` displayed the raw Markdown compaction
 * summary in a below-editor widget. That text contains headings and embedded
 * newlines, so the line wrapped onto several rows. OMP (oh-my-pi) instead
 * generates a dedicated plain-text recap and collapses whitespace before
 * display, which guarantees a single line.
 *
 * Behaviour:
 *   - After a run settles, wait `idleSeconds` with an empty editor.
 *   - Ask the model for a ~5-word title and a <40-word plain recap.
 *   - Collapse whitespace, truncate to `maxChars`, show one line.
 *   - New input, a new run, or a session change cancels and clears it.
 *
 * Config: `<agent-dir>/session-recap.json` (every field optional).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { complete } from "@earendil-works/pi-ai/compat";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

const WIDGET_KEY = "session-recap";
/** Keeps the recap request bounded on very long sessions. */
const MAX_CONVERSATION_CHARS = 12_000;
/** Idle bounds mirror OMP's clamp so a bad config cannot arm an absurd timer. */
const MIN_IDLE_SECONDS = 1;
const MAX_IDLE_SECONDS = 3_600;

export interface RecapConfig {
	enabled: boolean;
	idleSeconds: number;
	maxChars: number;
	maxTokens: number;
	/** Set the session name from the generated title when the session has none. */
	sessionTitle: boolean;
	/** Optional model override; defaults to the session's active model. */
	provider?: string;
	model?: string;
}

export const RECAP_DEFAULTS: RecapConfig = {
	enabled: true,
	idleSeconds: 240,
	maxChars: 280,
	maxTokens: 200,
	sessionTitle: true,
};

/** Read the optional config file, falling back to defaults on any problem. */
export function loadRecapConfig(agentDir: string): RecapConfig {
	const path = join(agentDir, "session-recap.json");
	if (!existsSync(path)) return { ...RECAP_DEFAULTS };
	try {
		const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
		if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
			return { ...RECAP_DEFAULTS };
		}
		return { ...RECAP_DEFAULTS, ...(parsed as Partial<RecapConfig>) };
	} catch {
		return { ...RECAP_DEFAULTS };
	}
}

/**
 * OMP's recap prompt, adapted to also return the session title so one request
 * covers both. The "no markdown" rule and the word budget are what keep the
 * result renderable as a single line.
 */
export const RECAP_PROMPT = [
	"<recap>",
	"User stepped away; returning. Answer with exactly these two lines:",
	"TITLE: ~5 words naming the overall task. No trailing period.",
	"RECAP: under 40 words, 1-2 plain sentences, no markdown.",
	"Lead with the overall goal and the current task, then one next action.",
	"Skip root-cause narrative, fix internals, secondary to-dos, and tangents.",
	"</recap>",
].join("\n");

/**
 * Collapse every run of whitespace — including newlines — into a single space,
 * then truncate. This is the fix for the wrapped multi-line display: no summary
 * text can reach the widget with an embedded line break.
 */
export function collapseLine(text: string, maxChars: number): string {
	const line = text.replace(/\s+/g, " ").trim();
	if (maxChars <= 0 || line.length <= maxChars) return line;
	return `${line.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/** Split the two-field reply. Falls back to treating the whole reply as a recap. */
export function parseRecapReply(text: string): { title: string | undefined; recap: string } {
	const titleMatch = /^\s*TITLE:\s*(.+)$/im.exec(text);
	const recapMatch = /^\s*RECAP:\s*([\s\S]+)$/im.exec(text);
	const title = titleMatch ? collapseLine(titleMatch[1], 80) : undefined;
	if (recapMatch) return { title, recap: recapMatch[1].trim() };
	return { title, recap: text.replace(/^\s*TITLE:\s*.+$/im, "").trim() };
}

interface ContentBlock {
	type?: string;
	text?: string;
	name?: string;
}

interface SessionEntry {
	type?: string;
	message?: { role?: string; content?: unknown };
}

/** Text-only rendering: tool output is reduced to a marker, never inlined. */
function renderContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts: string[] = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		const b = block as ContentBlock;
		if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
		else if (b.type === "toolCall" && typeof b.name === "string") parts.push(`[tool: ${b.name}]`);
	}
	return parts.join(" ");
}

/** Compact conversation text, keeping the most recent entries. */
export function buildConversation(entries: readonly SessionEntry[], maxChars = MAX_CONVERSATION_CHARS): string {
	const lines: string[] = [];
	for (const entry of entries) {
		if (entry?.type !== "message" || !entry.message?.role) continue;
		const role = entry.message.role;
		const text = renderContent(entry.message.content).trim();
		if (role === "user") {
			if (text) lines.push(`User: ${collapseLine(text, 600)}`);
		} else if (role === "assistant") {
			if (text) lines.push(`Assistant: ${collapseLine(text, 600)}`);
		} else if (role === "compactionSummary" || role === "branchSummary") {
			if (text) lines.push(`[earlier summary: ${collapseLine(text, 600)}]`);
		}
	}
	// Walk backwards so the newest context survives the budget.
	const kept: string[] = [];
	let used = 0;
	for (let i = lines.length - 1; i >= 0; i -= 1) {
		const line = lines[i]!;
		if (used + line.length + 1 > maxChars && kept.length > 0) break;
		kept.unshift(line);
		used += line.length + 1;
	}
	return kept.join("\n");
}

export default function sessionRecap(pi: ExtensionAPI) {
	let config: RecapConfig = { ...RECAP_DEFAULTS };
	let timer: ReturnType<typeof setTimeout> | undefined;
	let abort: AbortController | undefined;
	/** Bumped by every cancel; a reply from an older generation is discarded. */
	let generation = 0;

	function clearTimer(): void {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function clearRecap(ctx: ExtensionContext): void {
		if (ctx.hasUI) ctx.ui.setWidget(WIDGET_KEY, undefined);
	}

	/** Cancel pending and in-flight work, and drop the displayed recap. */
	function cancel(ctx: ExtensionContext): void {
		generation += 1;
		clearTimer();
		abort?.abort();
		abort = undefined;
		clearRecap(ctx);
	}

	function idleConditionsHold(ctx: ExtensionContext): boolean {
		if (!ctx.hasUI) return false;
		if (!ctx.isIdle()) return false;
		// A draft in the editor means the user is back but has not submitted yet.
		return ctx.ui.getEditorText().trim() === "";
	}

	function arm(ctx: ExtensionContext): void {
		clearTimer();
		if (!config.enabled) return;
		if (!ctx.hasUI) return;
		if (ctx.ui.getEditorText().trim() !== "") return;
		const seconds = Math.min(MAX_IDLE_SECONDS, Math.max(MIN_IDLE_SECONDS, config.idleSeconds));
		timer = setTimeout(() => {
			timer = undefined;
			void run(ctx);
		}, seconds * 1000);
		// Do not hold the process open just for a recap.
		(timer as unknown as { unref?: () => void }).unref?.();
	}

	async function run(ctx: ExtensionContext): Promise<void> {
		if (!config.enabled || !idleConditionsHold(ctx)) return;

		const model = config.provider && config.model
			? ctx.modelRegistry.find(config.provider, config.model)
			: ctx.model;
		if (!model) return;

		const entries = ctx.sessionManager.getBranch() as readonly SessionEntry[];
		const conversation = buildConversation(entries);
		if (!conversation.trim()) return;

		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth?.ok || !auth.apiKey) return;

		const name = pi.getSessionName()?.trim();
		const prompt = [name ? `Overall goal: ${name}` : "", "<conversation>", conversation, "</conversation>", RECAP_PROMPT]
			.filter(Boolean)
			.join("\n");

		const mine = ++generation;
		const controller = new AbortController();
		abort = controller;
		try {
			const response = await complete(
				model,
				{
					systemPrompt: "You write terse status recaps for a coding session.",
					messages: [
						{
							role: "user" as const,
							content: [{ type: "text" as const, text: prompt }],
							timestamp: Date.now(),
						},
					],
				},
				{ apiKey: auth.apiKey, headers: auth.headers, maxTokens: config.maxTokens },
			);
			if (mine !== generation || controller.signal.aborted) return;
			if (response.stopReason === "error") return;

			const raw = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");
			const { title, recap } = parseRecapReply(raw);
			const line = collapseLine(recap, config.maxChars);
			if (!line) return;
			// Conditions may have changed while the request was in flight.
			if (!idleConditionsHold(ctx)) return;

			if (config.sessionTitle && title && !pi.getSessionName()) {
				try {
					pi.setSessionName(title);
				} catch {
					// Session name is best-effort; the recap still shows.
				}
			}
			ctx.ui.setWidget(WIDGET_KEY, [ctx.ui.theme.fg("dim", `※ recap: ${line}`)], {
				placement: "belowEditor",
			});
		} catch {
			// A failed recap is not worth surfacing; the next idle retries.
		} finally {
			if (mine === generation) abort = undefined;
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		cancel(ctx);
		config = loadRecapConfig(getAgentDir());
	});

	// Any real activity invalidates a recap that is showing or in flight.
	pi.on("input", async (_event, ctx) => {
		cancel(ctx);
		return { action: "continue" as const };
	});
	pi.on("agent_start", async (_event, ctx) => {
		cancel(ctx);
	});

	pi.on("agent_settled", async (_event, ctx) => {
		arm(ctx);
	});

	pi.on("session_shutdown", async () => {
		generation += 1;
		clearTimer();
		abort?.abort();
		abort = undefined;
	});

	pi.registerCommand("recap", {
		description: "Generate the session recap now instead of waiting for idle",
		handler: async (_args, ctx) => {
			cancel(ctx);
			if (!ctx.hasUI) return;
			await run(ctx);
		},
	});
}
