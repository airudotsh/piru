import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

const STATE_FILE = join(homedir(), ".pi/agent/last-model.json");

const THINKING_LEVELS: ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

interface SavedModel {
	provider: string;
	id: string;
	thinking?: ThinkingLevel;
}

function load(): SavedModel | null {
	try {
		const raw = JSON.parse(readFileSync(STATE_FILE, "utf8"));
		if (typeof raw?.provider === "string" && typeof raw?.id === "string") return raw;
	} catch {}
	return null;
}

function save(state: SavedModel): void {
	try {
		const tmp = STATE_FILE + ".tmp";
		writeFileSync(tmp, JSON.stringify(state) + "\n");
		renameSync(tmp, STATE_FILE);
	} catch {}
}

export default function (pi: ExtensionAPI) {
	let ready = false;
	let current: SavedModel | null = null;

	pi.on("model_select", async (event, ctx) => {
		current = { provider: event.model.provider, id: event.model.id, thinking: ctx.thinkingLevel };
		if (ready) save(current);
	});

	pi.on("thinking_level_select", async (event) => {
		if (current) current.thinking = event.level;
		if (ready && current) save(current);
	});

	pi.on("session_start", async (event, ctx) => {
		const explicit = process.argv.includes("--model") || process.argv.includes("--provider");
		if (event.reason === "startup" && !explicit) {
			const saved = load();
			if (saved && !(ctx.model?.provider === saved.provider && ctx.model?.id === saved.id)) {
				const model = ctx.modelRegistry.find(saved.provider, saved.id);
				if (model) {
					try {
						await pi.setModel(model);
					} catch {}
				}
			}
			if (saved?.thinking && THINKING_LEVELS.includes(saved.thinking) && saved.thinking !== ctx.thinkingLevel) {
				try {
					pi.setThinkingLevel(saved.thinking);
				} catch {}
			}
		}
		ready = true;
		current = { provider: ctx.model?.provider ?? "", id: ctx.model?.id ?? "", thinking: ctx.thinkingLevel };
		if (event.reason !== "startup" && current.provider) save(current);
	});
}
