import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { existsSync } from "fs";
import Parser from "web-tree-sitter";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const EXTENSION_TO_GRAMMAR: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  go: "go",
  rs: "rust",
  css: "css",
  scss: "css",
  html: "html",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  sh: "bash",
  bash: "bash",
  sql: "sql",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  java: "java",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
};

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  await Parser.init();
  initialized = true;
}

const languageCache = new Map<string, Parser.Language>();

function findWasmPath(grammarName: string): string | null {
  try {
    const wasmsDir = dirname(require.resolve("tree-sitter-wasms/package.json"));
    const wasmsPkg = join(wasmsDir, "out", `tree-sitter-${grammarName}.wasm`);
    if (existsSync(wasmsPkg)) return wasmsPkg;
  } catch {}

  const local = resolve(__dirname, "../../grammars/tree-sitter-" + grammarName + ".wasm");
  if (existsSync(local)) return local;

  return null;
}

export async function getLanguageForFile(
  fileName: string
): Promise<Parser.Language | null> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const grammarName = EXTENSION_TO_GRAMMAR[ext];
  if (!grammarName) return null;

  if (languageCache.has(grammarName)) return languageCache.get(grammarName)!;

  await ensureInit();

  const wasmPath = findWasmPath(grammarName);
  if (!wasmPath) return null;

  const language = await Parser.Language.load(wasmPath);
  languageCache.set(grammarName, language);
  return language;
}

export async function createParser(fileName: string): Promise<Parser | null> {
  const language = await getLanguageForFile(fileName);
  if (!language) return null;

  await ensureInit();
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export function isStructuralDiffSupported(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext in EXTENSION_TO_GRAMMAR;
}
