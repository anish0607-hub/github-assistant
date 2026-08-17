import fs from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "out",
  ".next",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "coverage",
  "third_party",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
  "Cargo.lock",
  "composer.lock",
  "Gemfile.lock",
  "go.sum",
]);

const EXTENSION_LANGUAGES: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".scala": "scala",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".php": "php",
  ".swift": "swift",
  ".m": "objective-c",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".sql": "sql",
  ".html": "html",
  ".css": "css",
  ".scss": "css",
  ".less": "css",
  ".vue": "vue",
  ".svelte": "svelte",
  ".md": "markdown",
  ".mdx": "markdown",
  ".json": "json",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".graphql": "graphql",
  ".proto": "protobuf",
  ".tf": "terraform",
  ".dockerfile": "dockerfile",
  ".env.example": "dotenv",
  ".txt": "text",
};

const MAX_FILE_SIZE = 300 * 1024; // 300 KB per file

export interface SourceFile {
  /** Path relative to the repository root, with forward slashes. */
  relativePath: string;
  absolutePath: string;
  size: number;
  language: string | null;
}

export function detectLanguage(filePath: string): string | null {
  const base = path.basename(filePath).toLowerCase();
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile") return "makefile";
  const ext = path.extname(base);
  return EXTENSION_LANGUAGES[ext] ?? null;
}

function isProbablyBinary(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (const byte of sample) {
    if (byte === 0) return true;
  }
  return false;
}

/** Recursively walks a repository checkout and returns indexable text/source files. */
export async function listSourceFiles(rootDir: string): Promise<SourceFile[]> {
  const results: SourceFile[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (SKIP_FILES.has(entry.name)) continue;

      const stat = await fs.promises.stat(abs);
      if (stat.size === 0 || stat.size > MAX_FILE_SIZE) continue;

      const language = detectLanguage(abs);
      if (language === null) continue;

      const buffer = await fs.promises.readFile(abs);
      if (isProbablyBinary(buffer)) continue;

      results.push({
        relativePath: path.relative(rootDir, abs).split(path.sep).join("/"),
        absolutePath: abs,
        size: stat.size,
        language,
      });
    }
  }

  await walk(rootDir);
  return results;
}
