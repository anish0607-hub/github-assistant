# GitHub Knowledge Assistant

An AI-powered platform where you paste any GitHub repository URL and instantly **chat with the codebase** — powered by Retrieval-Augmented Generation (RAG) over a vector index of the repository's source code.

## Features

- **Import any GitHub repository** — paste a URL (or `owner/repo`) and it's downloaded and indexed
- **Repository indexing** — files are chunked with language-aware splitting, embedded, and stored in a vector database (background job queue)
- **Semantic code search** — search by meaning ("jwt token validation"), not just keywords
- **Chat with the codebase** — streaming RAG chat grounded in retrieved source, with cited file paths
- **AI code explanation** — one-click explanations for any file
- **Architecture summary** — high-level overview of components, data flow and structure
- **Auto documentation generator** — generated developer docs (setup, modules, APIs)
- **Bug detection** — AI review of a file or area of the codebase
- **File search** — fast path/name filtering over the indexed file list
- **Commit history analysis** — recent commits with an AI summary of development themes

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn-style UI components |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| AI | Anthropic Claude (`@anthropic-ai/sdk`), LangChain text splitters, embedding models (OpenAI or Voyage) |
| Vector DB | Qdrant |
| Infrastructure | Docker Compose, Redis (BullMQ job queue) |
| APIs | GitHub REST API |

## Architecture

```
┌──────────────┐     ┌───────────────────────────────────────────┐
│   Next.js    │────▶│  Express API                              │
│   frontend   │ SSE │  ├─ /api/repositories  (import, files,    │
└──────────────┘     │  │                      commits, status)  │
                     │  ├─ /api/search        (semantic search)  │
                     │  ├─ /api/chat          (streaming RAG)    │
                     │  └─ /api/analysis      (architecture,     │
                     │                         docs, bugs, …)    │
                     └──────┬───────────┬───────────┬────────────┘
                            │           │           │
                     ┌──────▼─────┐ ┌───▼────┐ ┌────▼────┐
                     │ PostgreSQL │ │ Qdrant │ │  Redis  │
                     │  (Prisma)  │ │vectors │ │ BullMQ  │
                     └────────────┘ └────────┘ └────┬────┘
                                                    │ index jobs
                     GitHub API ◀── tarball ── ┌────▼────────┐
                                               │ Index worker │
                                               │ chunk→embed  │
                                               └──────────────┘
```

**Indexing pipeline:** GitHub tarball → walk source files (binary/vendor filtering) → language-aware chunking (LangChain `RecursiveCharacterTextSplitter`) → embeddings → Qdrant collection per repository.

**Chat pipeline:** question → embed → top-k vector search → retrieved chunks injected as context → Claude streams a grounded answer (SSE) with cited sources → conversation persisted in Postgres.

## Getting started

### 1. Configure environment

```bash
cp .env.example .env
```

Required keys:

- `ANTHROPIC_API_KEY` — for chat, explanations, docs, bug detection, commit analysis
- `OPENAI_API_KEY` — for embeddings (default provider), **or** set `EMBEDDINGS_PROVIDER=voyage` + `VOYAGE_API_KEY`
- `GITHUB_TOKEN` — optional, raises GitHub rate limits and enables private repos

### 2. Run everything with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:4000

### 3. Or run locally for development

```bash
# infra only
docker compose up postgres redis qdrant -d

# backend
cd backend
npm install
npx prisma db push
npm run dev          # http://localhost:4000

# frontend (new terminal)
cd frontend
npm install
npm run dev          # http://localhost:3000
```

## API overview

| Method | Route | Description |
|---|---|---|
| POST | `/api/repositories` | Import a repository `{ url }` and queue indexing |
| GET | `/api/repositories` | List repositories with status |
| GET | `/api/repositories/:id` | Repository details / indexing status |
| POST | `/api/repositories/:id/reindex` | Re-index a repository |
| DELETE | `/api/repositories/:id` | Remove repository + vector collection |
| GET | `/api/repositories/:id/files?q=` | File search |
| GET | `/api/repositories/:id/commits` | Recent commit history |
| POST | `/api/search` | Semantic code search `{ repositoryId, query }` |
| POST | `/api/chat` | Streaming RAG chat (SSE) `{ repositoryId, message, conversationId? }` |
| POST | `/api/analysis/architecture` | Architecture summary (cached) |
| POST | `/api/analysis/docs` | Auto documentation (cached) |
| POST | `/api/analysis/explain` | Explain a file/topic `{ target }` |
| POST | `/api/analysis/bugs` | Bug detection `{ target }` |
| POST | `/api/analysis/commits` | Commit history analysis (cached) |

## Notes

- The LLM defaults to `claude-opus-5` (configurable via `ANTHROPIC_MODEL`).
- Embeddings default to OpenAI `text-embedding-3-small`; switch to Voyage `voyage-code-3` (code-optimized) with `EMBEDDINGS_PROVIDER=voyage`.
- Each repository gets its own Qdrant collection (`repo_<id>`), dropped on delete and rebuilt on re-index.
- Indexing skips binaries, lockfiles, vendored directories and files over 300 KB.
