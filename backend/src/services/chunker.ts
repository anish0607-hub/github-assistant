import {
  RecursiveCharacterTextSplitter,
  SupportedTextSplitterLanguage,
} from "@langchain/textsplitters";

const LANGCHAIN_LANGUAGES: Record<string, SupportedTextSplitterLanguage> = {
  javascript: "js",
  typescript: "js",
  python: "python",
  go: "go",
  rust: "rust",
  java: "java",
  cpp: "cpp",
  c: "cpp",
  csharp: "java",
  php: "php",
  ruby: "ruby",
  swift: "swift",
  scala: "scala",
  markdown: "markdown",
  html: "html",
};

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export interface Chunk {
  content: string;
  startLine: number;
  endLine: number;
}

function splitterFor(language: string | null): RecursiveCharacterTextSplitter {
  const lcLanguage = language ? LANGCHAIN_LANGUAGES[language] : undefined;
  if (lcLanguage) {
    return RecursiveCharacterTextSplitter.fromLanguage(lcLanguage, {
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
    });
  }
  return new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
}

/** Splits file content into overlapping chunks with best-effort line ranges. */
export async function chunkFile(content: string, language: string | null): Promise<Chunk[]> {
  const splitter = splitterFor(language);
  const pieces = await splitter.splitText(content);

  const chunks: Chunk[] = [];
  let searchFrom = 0;
  for (const piece of pieces) {
    // Locate the chunk in the original text to compute line numbers.
    let index = content.indexOf(piece, searchFrom);
    if (index === -1) index = content.indexOf(piece);
    const before = index >= 0 ? content.slice(0, index) : "";
    const startLine = before.split("\n").length;
    const endLine = startLine + piece.split("\n").length - 1;
    if (index >= 0) searchFrom = index + 1;

    chunks.push({ content: piece, startLine, endLine });
  }
  return chunks;
}
