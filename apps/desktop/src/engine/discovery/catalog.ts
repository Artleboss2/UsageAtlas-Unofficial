/**
 * Names worth pointing the discovery engine at. This is a seed list, not a
 * whitelist: `discoverProviderUsage` works on any string, and a name that does
 * not exist on disk simply scans nothing. `aliases` are the other names the same
 * product ships under, so a folder named after the old brand is still found.
 */
export interface CatalogEntry {
  /** Primary product name, as users write it. */
  name: string;
  /** Other names, folder spellings, or renames of the same product. */
  aliases?: string[];
  /** What kind of tool it is, used for grouping in reports. */
  kind?: "editor" | "cli-agent" | "gateway" | "desktop" | "observability" | "assistant";
}

export const CATALOG: CatalogEntry[] = [
  { name: "freebuff", aliases: ["manicode", "freebuff-desktop"], kind: "desktop" },
  { name: "codebuff", aliases: ["codefree", "codebuff-cli"], kind: "cli-agent" },
  { name: "zed", aliases: ["zed-industries"], kind: "editor" },
  { name: "cursor", aliases: ["cursor-agent"], kind: "editor" },
  { name: "windsurf", aliases: ["codeium"], kind: "editor" },
  { name: "cline", aliases: ["claude-dev"], kind: "editor" },
  { name: "roo code", aliases: ["roo-code", "roocode"], kind: "editor" },
  { name: "continue", aliases: ["continue-dev"], kind: "editor" },
  { name: "aider", aliases: ["aider-chat"], kind: "cli-agent" },
  { name: "opencode", aliases: ["open-code", "opencode-ai"], kind: "cli-agent" },
  { name: "claude code", aliases: ["claude", "claude-code", "anthropic"], kind: "cli-agent" },
  { name: "codex", aliases: ["openai-codex", "codex-cli"], kind: "cli-agent" },
  { name: "gemini", aliases: ["gemini-cli", "google-gemini"], kind: "cli-agent" },
  { name: "qwen code", aliases: ["qwen", "qwen-code", "qwen-cli"], kind: "cli-agent" },
  { name: "kimi", aliases: ["kimi-cli", "moonshot"], kind: "cli-agent" },
  { name: "kilo", aliases: ["kilo-code"], kind: "editor" },
  { name: "amp", aliases: ["sourcegraph-amp"], kind: "cli-agent" },
  { name: "copilot", aliases: ["github-copilot"], kind: "assistant" },
  { name: "factory", aliases: ["factory-ai", "droid"], kind: "cli-agent" },
  { name: "qoder", aliases: ["qoder-ai"], kind: "editor" },
  { name: "warp", aliases: ["warp-terminal"], kind: "cli-agent" },
  { name: "antigravity", aliases: ["google-antigravity"], kind: "editor" },
  { name: "muse", aliases: ["muse-ai"], kind: "cli-agent" },
  { name: "pi", aliases: ["pi-ai", "pi-cli"], kind: "cli-agent" },
  { name: "z.ai", aliases: ["zai", "glm", "zhipu", "bigmodel"], kind: "gateway" },
  { name: "openrouter", aliases: ["open-router"], kind: "gateway" },
  { name: "together", aliases: ["together-ai"], kind: "gateway" },
  { name: "groq", aliases: ["groq-cloud"], kind: "gateway" },
  { name: "mistral", aliases: ["mistral-ai"], kind: "gateway" },
  { name: "deepseek", aliases: ["deep-seek"], kind: "gateway" },
  { name: "perplexity", aliases: ["pplx"], kind: "gateway" },
  { name: "fireworks", aliases: ["fireworks-ai"], kind: "gateway" },
  { name: "deepinfra", aliases: ["deep-infra"], kind: "gateway" },
  { name: "replicate", aliases: [], kind: "gateway" },
  { name: "huggingface", aliases: ["hugging-face", "hf"], kind: "gateway" },
  { name: "ollama", aliases: [], kind: "gateway" },
  { name: "lm studio", aliases: ["lm-studio", "lmstudio"], kind: "desktop" },
  { name: "jan", aliases: ["jan-ai"], kind: "desktop" },
  { name: "gpt4all", aliases: ["gpt-4-all"], kind: "desktop" },
  { name: "vllm", aliases: ["v-llm"], kind: "gateway" },
  { name: "litellm", aliases: ["lite-llm"], kind: "gateway" },
  { name: "portkey", aliases: ["portkey-ai"], kind: "gateway" },
  { name: "one api", aliases: ["one-api", "oneapi"], kind: "gateway" },
  { name: "new api", aliases: ["new-api", "newapi"], kind: "gateway" },
  { name: "langfuse", aliases: ["lang-fuse"], kind: "observability" },
  { name: "helicone", aliases: ["heli-cone"], kind: "observability" },
  { name: "braintrust", aliases: ["brain-trust"], kind: "observability" },
  { name: "phoenix", aliases: ["arize-phoenix"], kind: "observability" },
  { name: "opik", aliases: ["comet-opik"], kind: "observability" },
  { name: "chatbox", aliases: ["chat-box"], kind: "desktop" },
  { name: "open webui", aliases: ["open-webui", "openwebui"], kind: "desktop" },
  { name: "librechat", aliases: ["libre-chat"], kind: "desktop" },
  { name: "lobechat", aliases: ["lobe-chat"], kind: "desktop" },
  { name: "anythingllm", aliases: ["anything-llm"], kind: "desktop" },
  { name: "cherry studio", aliases: ["cherry-studio"], kind: "desktop" },
  { name: "msty", aliases: ["msty-app"], kind: "desktop" },
  { name: "typingmind", aliases: ["typing-mind"], kind: "assistant" },
  { name: "openhands", aliases: ["open-hands"], kind: "cli-agent" },
  { name: "goose", aliases: ["block-goose"], kind: "cli-agent" },
  { name: "plandex", aliases: ["plan-dex"], kind: "cli-agent" },
  { name: "mentat", aliases: [], kind: "cli-agent" },
  { name: "sweep", aliases: ["sweep-ai"], kind: "cli-agent" },
  { name: "devin", aliases: ["cognition-devin"], kind: "cli-agent" }
];

/** Primary name plus aliases, deduplicated, for scanning a whole entry. */
export function catalogLead(entry: CatalogEntry): string[] {
  return [entry.name, ...(entry.aliases ?? [])];
}
