# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (root)
```bash
npm run dev          # Run backend API server (tsx watch on src/api/server.ts)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled server (node dist/api/server.js)
npm run lint         # ESLint on src/
npm run typecheck    # Type-check without emitting (tsc --noEmit)
```

### Frontend (ui/)
```bash
npm run dev:ui       # Run Vite dev server for UI (from root)
npm run build:ui     # Build UI (from root)
cd ui && npm run dev # Alternatively, run directly from ui/
```

### Discovery Tool Test Scripts (no test framework — manual CLI scripts)
```bash
npx tsx src/test-scraper.ts [all|dining|budget|concert|week]      # Test Eventbrite tool
npx tsx src/test-eventfinda.ts [all|dining|budget|concert|week]   # Test EventFinda tool
npx tsx src/test-pipeline-e2e.ts                                  # End-to-end pipeline test
npx tsx src/test-booking.ts                                       # Test ActionBook execution
```

Both discovery scripts fall back to demo data when API credentials are missing.

## Architecture

### Two separate apps, one monorepo
- **Backend** (`src/`): Node.js + Express API, TypeScript ESM, compiled to `dist/`
- **Frontend** (`ui/`): React 19 + Vite + Tailwind + shadcn/ui with its own `package.json`
- **Shared types** (`shared/`): Single source of truth for types used by both — imported via `@shared/*` path alias

### Agent pipeline (Mastra Workflow)
The backend runs a multi-agent pipeline orchestrated by Mastra (`@mastra/core`):

```
PlanFormData (user input)
  → Intent Agent (GPT-4o-mini, parseIntentTool) → UserConstraints
  → [Parallel] Discovery Agent (searchEventbriteTool + searchEventfindaTool) → merged Event[]
  → deduplicateEventsTool → Recommendation Agent (rankEventsTool) → ranked Event[]
  → Planning Agent (planItineraryTool) → Itinerary
  → [APPROVAL GATE] waitForApproval() — pipeline pauses until POST /api/workflow/:id/approve
  → Execution Agent (executeBookingTool + browser* tools via ActionBook) → BookingAction[]
```

- **`src/mastra/index.ts`** — Mastra entrypoint; registers all agents, tools, workflows, and `SSETracingExporter` observability config
- **`src/mastra/workflows/planning-pipeline.ts`** — Full pipeline definition; emits `TraceEvent`s at each phase via `emitTrace()` using `AsyncLocalStorage` for traceId threading
- **`src/mastra/agents/`** — 5 Mastra `Agent` instances; prompts are in `prompts.ts`
- **`src/mastra/tools/`** — Tools with Zod schemas; `search-eventbrite.ts` and `search-eventfinda.ts` are fully implemented; others are partially stubbed

### Real-time tracing (SSE)
Traces flow: pipeline `emitTrace()` → `TraceEventBus` (pub/sub singleton) → Express SSE route (`GET /api/traces/stream/:workflowId`) → frontend `useTraceStream` hook → `TraceViewer` component.

Mastra spans are also auto-exported via `SSETracingExporter` (`src/tracing/mastra-sse-exporter.ts`) which implements `ObservabilityExporter`.

- **`src/tracing/`** — `TraceEventBus`, `SSETracingExporter`, `AsyncLocalStorage` trace context
- **`shared/types/trace.ts`** — `TraceEvent`, `ReasoningStep`, `Decision` — the shared type contract

### Context / Memory (Acontext)
`src/context/context-manager.ts` implements a write-through cache pattern:
- Reads always hit the in-memory `Map` (zero latency)
- Writes update memory first, then fire-and-forget to Acontext sessions API
- Falls back to pure in-memory when `ACONTEXT_API_KEY` is unset
- One Acontext session per workflow run; each state mutation appends a structured message inspectable in the Acontext Dashboard

`contextRegistry` (a `Map<workflowId, ContextManager>`) is the global registry; entries are cleaned up 5 minutes after pipeline completion.

### Human-in-the-loop approval gate
`src/api/approval-registry.ts` implements an in-memory Promise-based gate:
- Pipeline calls `waitForApproval(workflowId)` which blocks execution
- User POSTs to `POST /api/workflow/:id/approve` with `{ approved: boolean }`
- On approval, `persistItinerary()` saves the itinerary to MongoDB before the pipeline continues to execution
- Pending approvals auto-expire after 30 minutes (resolved as rejected)

### Auth pattern
- Auth is **entirely client-side** via Supabase JS SDK (no backend login/signup routes)
- Backend uses `requireAuth` middleware (`src/api/middleware/auth.ts`) that verifies Supabase JWTs
- Frontend `tokenStorage.ts` stores the token synchronously; `apiClient.ts` reads it and attaches `Authorization: Bearer` headers
- Supabase `profiles` table for user onboarding data; `MONGO_URI` (MongoDB) stores itineraries

### Workflow API (async)
`POST /api/workflow` returns `{ workflowId }` immediately and runs the pipeline in the background. The client then subscribes to `GET /api/traces/stream/:workflowId` via SSE for real-time updates.

## Key Files

| File | Purpose |
|------|---------|
| `src/config.ts` | Zod-validated env config (all env vars validated here, fails fast on startup) |
| `src/types/index.ts` | Backend Zod schemas: `Event`, `UserConstraints`, `PlanFormData`, `Itinerary`, etc. |
| `shared/types/trace.ts` | Shared `TraceEvent` type (backend + frontend both import from here) |
| `src/mastra/tools/utils/category.ts` | Shared category inference used by both discovery tools |
| `src/api/approval-registry.ts` | In-memory Promise gate for human-in-the-loop plan approval |
| `src/api/persist-itinerary.ts` | Maps domain `Itinerary` → MongoDB document and saves on approval |
| `src/context/context-manager.ts` | Write-through cache over Acontext; `contextRegistry` is the global map |
| `src/mongodb/models/` | Mongoose schemas for `Event` and `Itinerary` |
| `ui/src/lib/apiClient.ts` | Typed API client; reads token synchronously from `tokenStorage.ts` |
| `ui/src/lib/tokenStorage.ts` | Synchronous localStorage wrapper for the Supabase JWT |
| `ui/src/hooks/useTraceStream.ts` | SSE EventSource hook for real-time trace streaming |
| `ui/src/components/trace/` | Full trace viewer UI components (TraceViewer, SpanCard, PipelineProgress, etc.) |

## Path Aliases

- Backend: `@/*` → `src/*`, `@shared/*` → `shared/*` (configured in root `tsconfig.json`)
- Frontend: `@shared/*` → `shared/*` (configured in `ui/tsconfig.app.json` and `ui/vite.config.ts`)

Always use `@shared/types/trace` (not a relative path) when importing shared types.

## Environment Variables

Backend (`.env`):
```
# Required
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
MONGO_URI

# LLM
OPENAI_API_KEY

# Event discovery
BRIGHT_DATA_API_KEY, BRIGHT_DATA_ZONE
BRIGHT_DATA_CUSTOMER_ID, BRIGHT_DATA_PASSWORD  # alternative Bright Data auth
EVENTFINDA_USERNAME, EVENTFINDA_PASSWORD

# Execution agent
ACTIONBOOK_API_KEY

# Context/memory (optional — falls back to in-memory)
ACONTEXT_API_KEY, ACONTEXT_BASE_URL

# Optional integrations
GOOGLE_MAPS_API_KEY, WEATHER_API_KEY

# Feature flags
PORT, NODE_ENV, DEMO_MODE, TRACE_VERBOSE
```

Frontend (`ui/.env`):
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

## What's Implemented vs. Stub

**Fully implemented**: Intent Agent, Eventbrite scraping (Bright Data), EventFinda REST API, Mastra workflow pipeline, SSE tracing, Express API, Supabase auth, approval gate, itinerary persistence to MongoDB, full frontend (auth, onboarding, plan wizard, trace viewer, itineraries page).

**Partially stubbed**: `deduplicateEventsTool`, `rankEventsTool`, `planItineraryTool`, `executeBookingTool` (tool scaffolds exist with Zod schemas but may have simplified logic); `/api/events` route; itinerary timeline UI in frontend.

## Conventions

- All LLM-powered agents use `@ai-sdk/openai` model provider through Mastra `Agent` — not the OpenAI SDK directly
- Tools are `createTool()` with Zod input/output schemas; agents call tools, not raw API clients
- All data validation uses Zod (backend: zod v3; frontend: zod v4 — separate installs)
- ESM modules throughout — use `.js` extensions in backend imports even for `.ts` source files
- `Promise.allSettled` for parallel ops; retry with exponential backoff for rate-limited APIs

### Naming
- Agents: `xxxAgent` — Mastra `Agent` instances (e.g. `intentAgent`, `discoveryAgent`)
- Tools: `xxxTool` — Mastra `createTool()` instances (e.g. `parseIntentTool`, `rankEventsTool`)
- API routes: `/api/resource` RESTful

### Debug Log Prefixes
Each subsystem uses consistent console log prefixes for filtering:
- `[eventbrite]` — Eventbrite tool: fetch URLs, raw/filtered event counts, enrichment, errors
- `[eventfinda]` — EventFinda tool: search params, API result counts, retry warnings, errors
- `[pipeline:*]` — Workflow pipeline: agent invocations, per-source event counts
- `[workflow]` — API route: request validation, pipeline execution
- `[trace:*]` — Trace system: SSE connections, event emission, exporter span mapping
- `[context]` — Context manager: Acontext session lifecycle
- `[persist]` — Itinerary persistence to MongoDB

## Design System

The UI uses an **"Ink Wash"** palette (charcoal, cool gray, soft ivory, steel blue):

| Token | Hex | Role |
|-------|-----|------|
| Charcoal | `#4A4A4A` | Dark mode background |
| Cool Gray | `#CBCBCB` | Borders, muted elements |
| Soft Ivory | `#FFFFE3` | Light mode background |
| Steel Blue | `#6D8196` | Primary / accent |

CSS custom properties in `ui/src/index.css` (`:root` for light, `.dark` for dark mode). All Tailwind color tokens (`bg-background`, `text-foreground`, `text-primary`, etc.) derive from these variables — never use raw hex in components.

Shadcn/ui components exclusively — never build custom components that duplicate existing ones.

## Frontend Route Structure

Routes defined in `ui/src/components/layout/AppRoutes.tsx`. Protected routes use `<ProtectedRoute>`.

| Route | Protection | Notes |
|-------|-----------|-------|
| `/` | Public | Landing page with shader gradient |
| `/login`, `/signup` | Public | Supabase client-side auth |
| `/onboarding` | Auth required | 3-step wizard; POSTs to `/api/auth/onboarding` |
| `/dashboard` | Auth + onboarding | Metrics; "Plan a Trip" CTA → `/plan` |
| `/plan` | Auth + onboarding | 4-step wizard; POSTs to `POST /api/workflow`, streams traces via SSE |
| `/itineraries` | Auth + onboarding | Lists saved itineraries from MongoDB |
| `/events` | Public | Event cards |

## Supabase Database Setup

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  travel_style text,
  budget_range text,
  interests jsonb default '[]'::jsonb,
  phone_number text,
  dietary_preferences text[],
  special_requests text,
  is_onboarded boolean default false,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);
-- Service role bypasses RLS (used by backend middleware)
```
