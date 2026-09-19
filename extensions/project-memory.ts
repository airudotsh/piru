import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

let configuredStore: string | undefined;

export default async function projectMemory(pi: ExtensionAPI): Promise<void> {
	const cwd = realpathSync(process.cwd());
	let root = cwd;
	while (!existsSync(join(root, ".git"))) {
		const parent = dirname(root);
		if (parent === root) {
			root = cwd;
			break;
		}
		root = parent;
	}
	const agentDir = getAgentDir();
	const store = join(agentDir, "memory", "projects", createHash("sha256").update(root).digest("hex"));
	if (configuredStore && configuredStore !== store) {
		throw new Error("Pi memory scope changed inside this process; restart Pi before switching projects.");
	}
	configuredStore = store;

	// pi-memory captures its directory at module evaluation, so configure before import.
	Object.assign(process.env, {
		PI_MEMORY_DIR: store,
		PI_MEMORY_SNAPSHOT: "stable",
		PI_MEMORY_EXIT_SUMMARY: "0",
		PI_MEMORY_SUMMARIZE_TRANSITIONS: "0",
		PI_MEMORY_QMD_UPDATE: "background",
		PI_MEMORY_QMD_SEARCH_TIMEOUT_MS: "180000",
		QMD_CONFIG_DIR: join(store, ".qmd"),
		INDEX_PATH: join(store, ".qmd", "index.sqlite"),
	});
	const memory = await import(join(agentDir, "npm", "node_modules", "pi-memory", "index.ts"));
	mkdirSync(join(store, ".qmd"), { recursive: true });
	const marker = join(store, ".project.json");
	const identity = `${JSON.stringify({ projectRoot: root, memoryDir: store }, null, 2)}\n`;
	if (!existsSync(marker) || readFileSync(marker, "utf8") !== identity) {
		writeFileSync(marker, identity, "utf8");
	}
	await memory.default(pi);
}
