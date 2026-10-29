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
  { name: "devin", aliases: ["cognition-devin"], kind: "cli-agent" },
  ...additionalNames(`
    codeium|tabnine|supermaven|sourcegraph cody|augment code|jetbrains ai|junie|amazon q|aws bedrock|azure openai|
    vertex ai|google ai studio|google ai|openai|anthropic|cohere|ai21 labs|anyscale|perplexity lab|xai|
    meta llama|nvidia nim|cerebras|sambanova|graphcore|tenstorrent|etched|groq cloud|novita ai|nebius ai|
    scaleway ai|ovhcloud ai|cloudflare workers ai|replicate|baseten|modal labs|runpod|lambda labs|vast ai|
    fal ai|octoai|hyperbolic|deepinfra|fireworks ai|together ai|openrouter|portkey ai|litellm|one api|
    new api|kong ai|cloudflare ai gateway|martian|not diamond|openpipe|unify ai|keywords ai|langsmith|
    wandb weave|promptlayer|humanloop|vellum|promptfoo|langwatch|agenta|flowise|dify|n8n|activepieces|
    relevance ai|crewai|autogen|langgraph|semantic kernel|haystack|llamaindex|dspy|instructor|outlines|
    guidance|marvin|mirascope|magentic|pydantic ai|smolagents|openai agents sdk|google adk|strands agents|
    mastra|vercel ai sdk|genkit|copilotkit|assistant ui|big agi|chatall|nextchat|betterchatgpt|hollama|
    page assist|open interpreter|localai|text generation webui|koboldcpp|sillytavern|aphrodite|sglang|
    text generation inference|lmdeploy|exllama|llama cpp|mlx lm|llamafile|cortex|ramalama|docker model runner|
    podman ai lab|triton inference|torchserve|kserve|bentoml|ray serve|replit agent|replit|lovable|bolt new|
    v0 by vercel|firebase studio|project idx|trae|kiro|void editor|theia ai|twinny|tabby|continue dev|
    cody|codegen|graphite diamond|greptile|coderabbit|ellipsis|sourcery|codiga|deepsource|qodo|refact ai|
    bite|pieces for developers|aide|melty|mutable ai|codegpt|codeium windsurf|aws codewhisperer|google cloud code|
    gemini code assist|visual studio intellicode|jetbrains fleet|zed ai|neovim avante|copilot chat|codex cloud|
    claude computer use|openai operator|manus|genspark|perplexity|you com|phind|andisearch|kagi assistant|
    poe|character ai|pi ai|inflection|hume|elevenlabs|assemblyai|deepgram|whisper api|groq whisper|
    runway|pika|luma ai|stability ai|midjourney|dall e|ideogram|leonardo ai|playground ai|krea ai|
    hedra|heygen|synthesia|descript|otter ai|fireflies ai|granola|rewind ai|limitless|notion ai|mem ai|
    reflect notes|obsidian copilot|logseq ai|roam smart blocks|craft ai|bear ai|ulysses ai|ia writer|
    lex|sudowrite|jasper|copy ai|writesonic|rytr|grammarly go|deepl write|quillbot|wordtune|
    n8n cloud|zapier ai|make ai|retool ai|appsmith ai|budibase ai|tooljet ai|metabase ai|superset ai|preset ai|
    hex magic|mode ai|sigma ai|databricks assistant|snowflake cortex|bigquery gemini|redshift q|athena ai|
    dbt copilot|monte carlo ai|anomalo ai|great expectations ai|sifflet ai|atlan ai|collibra ai|alation ai|
    langfuse cloud|arize ai|fiddler ai|whyLabs|evidently ai|galileo ai|patronus ai|guardrails ai|lakera|
    robust intelligence|hiddenlayer|protect ai|calypso ai|prompt security|pangea ai|indirect prompt injection|
    modal|beam cloud|fly io gpu|coreweave|paperspace|jarvislabs|genesis cloud|nscale|fluidstack|
    crusoe energy|voltage park|massed compute|prime intellect|vast ai cloud|runpod serverless|replicate cog|
    hugging face inference|inference endpoints|sagemaker|vertex model garden|azure ai foundry|bedrock agents|
    openai assistants|anthropic mcp|model context protocol|openrouter fusion|requesty|helicone gateway|
    llm gateway|ai gateway|truefoundry|traceloop|openllmetry|phoenix arize|langtrace|braintrust proxy|
    opik comet|weights biases|neptune ai|comet ml|mlflow ai|kubeflow ai|bento ai|dvc ai|clearml|
    arize ax|fiddler|superwise|monita ai|vijil|robustness gym|inspect ai|inspect|eval harness|
    lm evaluation harness|helm|openai evals|braintrust evals|freeplay|humanloop evals|langsmith evals|
    promptfoo eval|deepeval|ragas|truera|arize eval|galileo evaluate|patronus evaluate|guardrails eval|
    codefree|freebuff cli|codebuff cli|charm crush|crush|opencode zen|zed agent|warp agent|amazon kiro|
    cody desktop|sourcegraph amp|amp cli|factory droid|qoder cli|antigravity cli|muse cli|pi cli|
    kimi cli|qwen cli|gemini cli|codex cli|claude cli|cursor cli|windsurf cli|junie cli|tabnine cli|
    copilot cli|devin cli|openhands cli|goose cli|plandex cli|mentat cli|sweep cli|aider cli|
    cline cli|roo cli|kilo cli|continue cli|kilocode|roocode|claude-dev|saoudrizwan|rooveterinaryinc|
    opencode ai|sst opencode|charmbracelet crush|block goose|all hands openhands|cognition windsurf|
    magic dev|magic ai|refact|supermaven cli|codeium cli|tabby cli|twinny cli|void cli|zed cli|
    amazon codewhisperer|google code assist|jetbrains ai assistant|visual studio copilot|eclipse copilot|
    xcode copilot|android studio gemini|intellij ai|webstorm ai|pycharm ai|rider ai|goland ai|
    clion ai|phpstorm ai|rubymine ai|datagrip ai|fleet ai|aqua ai|rustrover ai|writer side ai|
    devin desktop|codex desktop|claude desktop|gemini desktop|copilot desktop|perplexity desktop|
    chatgpt desktop|poe desktop|lm studio cli|jan desktop|anythingllm desktop|msty desktop|
    cherry studio desktop|chatbox desktop|open webui desktop|librechat desktop|lobe chat desktop|
    big agi desktop|nextchat desktop|chatall desktop|betterchatgpt desktop|hollama desktop|
    page assist browser|sider ai|monica ai|maxai|harpa ai|merlin ai|bing copilot|edge copilot|
    arc max|brave leo|opera aria|vivaldi ai|sigma ai browser|perplexity browser|comet browser|
    dia browser|atlas browser|chatgpt atlas|notion ai desktop|craft ai desktop|obsidian copilot desktop|
    logseq ai desktop|reflect ai desktop|mem ai desktop|rewind desktop|limitless desktop|granola desktop|
    otter desktop|fireflies desktop|descript desktop|synthesia desktop|heygen desktop|hedra desktop|
    runway desktop|pika desktop|luma desktop|stability desktop|midjourney desktop|leonardo desktop|
    ideogram desktop|krea desktop|playground desktop|fal desktop|replicate desktop|baseten desktop|
    modal desktop|runpod desktop|lambda desktop|vast desktop|coreweave desktop|paperspace desktop|
    nscale desktop|fluidstack desktop|crusoe desktop|voltage park desktop|prime intellect desktop|
    sagemaker studio|vertex workbench|azure ml studio|databricks notebook|snowflake copilot|
    bigquery studio|redshift query editor|athena console|dbt cloud|monte carlo desktop|
    langfuse desktop|arize desktop|fiddler desktop|evidently desktop|galileo desktop|patronus desktop|
    guardrails desktop|lakera desktop|hiddenlayer desktop|protect ai desktop|calypso desktop|
    pangea desktop|traceloop desktop|openllmetry desktop|langtrace desktop|braintrust desktop|
    opik desktop|neptune desktop|comet desktop|mlflow desktop|kubeflow desktop|clearml desktop|
    superwise desktop|monita desktop|vijil desktop|inspect desktop|helm desktop|freeplay desktop|
    humanloop desktop|promptfoo desktop|deepeval desktop|ragas desktop|truera desktop|
    codefree desktop|freebuff desktop|codebuff desktop|crush desktop|opencode desktop|
    cline desktop|roo desktop|kilo desktop|continue desktop|tabby desktop|twinny desktop|
    void desktop|theia desktop|zed desktop|cursor desktop|windsurf desktop|trae desktop|
    kiro desktop|firebase studio desktop|project idx desktop|replit desktop|lovable desktop|
    bolt desktop|v0 desktop|augment desktop|supermaven desktop|tabnine desktop|codeium desktop|
    amazon q desktop|jetbrains desktop|sourcegraph desktop|cody desktop|amp desktop|factory desktop|
    qoder desktop|antigravity desktop|muse desktop|pi desktop|kimi desktop|qwen desktop|gemini desktop|
    codex desktop|claude desktop|copilot desktop|perplexity desktop|chatgpt desktop|poe desktop|
    manus desktop|genspark desktop|you desktop|phind desktop|kagi desktop|bing desktop|brave desktop|
    arc desktop|opera desktop|vivaldi desktop|sigma desktop|comet desktop|dia desktop|atlas desktop|
    notion desktop|craft desktop|obsidian desktop|logseq desktop|reflect desktop|mem desktop|rewind desktop|
    limitless desktop|granola desktop|otter desktop|fireflies desktop|descript desktop|synthesia desktop|
    heygen desktop|hedra desktop|runway desktop|pika desktop|luma desktop|stability desktop|midjourney desktop|
    leonardo desktop|ideogram desktop|krea desktop|playground desktop|fal desktop|replicate desktop|
    baseten desktop|modal desktop|runpod desktop|lambda desktop|vast desktop|coreweave desktop|
    paperspace desktop|nscale desktop|fluidstack desktop|crusoe desktop|voltage desktop|prime desktop|
    sagemaker desktop|vertex desktop|azureml desktop|databricks desktop|snowflake desktop|
    bigquery desktop|redshift desktop|athena desktop|dbt desktop|monte desktop|langfuse desktop|
    arize desktop|fiddler desktop|evidently desktop|galileo desktop|patronus desktop|guardrails desktop|
    lakera desktop|hiddenlayer desktop|protect desktop|calypso desktop|pangea desktop|traceloop desktop|
    openllmetry desktop|langtrace desktop|braintrust desktop|opik desktop|neptune desktop|comet desktop|
    mlflow desktop|kubeflow desktop|clearml desktop|superwise desktop|monita desktop|vijil desktop|
    inspect desktop|helm desktop|freeplay desktop|humanloop desktop|promptfoo desktop|deepeval desktop|
    ragas desktop|truera desktop
  `)
];

/**
 * The long tail of the catalog. Names only: discovery derives folder spellings
 * and probes what exists, so a name that is not installed costs one failed
 * readdir per data root and never a network call.
 */
function additionalNames(names: string): CatalogEntry[] {
  return names.split("|").map(name => name.trim().replace(/\s+/g, " "))
    .filter(name => name.length >= 2)
    .map(name => ({ name, kind: "gateway" as const }));
}

/** Primary name plus aliases, deduplicated, for scanning a whole entry. */
export function catalogLead(entry: CatalogEntry): string[] {
  return [entry.name, ...(entry.aliases ?? [])];
}
