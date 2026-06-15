# YtGuessWho 🎵

An online multiplayer guessing game built around YouTube music videos.
Players join a shared session, each submits a song they like, and then everyone tries to guess which song belongs to which player.

---

## 🧪 What this repo really is

This project is an **experiment in vibe-coding** — a hands-on exercise to learn how to build software end-to-end using AI agents as the primary development workforce, with a human acting as the product owner and decision-maker.

The goal is to explore: how far can a structured, agent-driven workflow take a real product before it needs significant human intervention?

### Agent workflow

The pipeline is sequential. Each agent has a defined role and writes to a specific part of the repository:

```
┌─────────────┐     ┌────────────┐     ┌───────────┐     ┌────────────────┐
│  ARCHITECT  │ ──▶ │     PM     │ ──▶ │    DEV    │ ──▶ │    UX / UI     │
│             │     │            │     │           │     │  (independent) │
└─────────────┘     └────────────┘     └───────────┘     └────────────────┘
```

| Agent | Responsibility | Output |
|-------|---------------|--------|
| **Architect** | System design, ADRs, domain boundaries, technical guidelines | `docs/`, `docs/adr/`, `docs/guidelines/` |
| **PM** | Feature tickets with acceptance criteria, technical notes, and test plans | `.github/skills/ticket-*.md` |
| **Dev** | Full implementation of tickets across all layers, tests included | `server/`, `client/` |
| **UX / UI** | Visual design system, user flows, color palette, component style guide | `docs/design/` |

> 🔜 **A DevOps agent is planned** to cover CI/CD pipelines, containerisation, environment configuration, and deployment automation.

---

## Tech stack

### Server
- **ASP.NET Core 10** — HTTP host and middleware pipeline
- **SignalR** — real-time, bidirectional WebSocket communication
- **Clean Architecture** — Domain → Application → Infrastructure → Api layers (see `docs/solution-architecture.md`)
- **Autofac** — modular dependency injection
- **Serilog** — structured logging
- **xUnit + FakeItEasy + FluentAssertions** — unit testing

### Client
- **Angular 21** — standalone components, signals, OnPush change detection
- **TypeScript 5.9** — strict mode throughout
- **SCSS** — global design system with MD3 tokens (`src/styles.scss`)
- **@microsoft/signalr** — SignalR JavaScript client
- **Vitest + Testing Library** — component and service unit tests
- **pnpm** — package manager (do not use npm or yarn)

---

## Running locally

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/) — install once with `npm install -g pnpm@9.1.1`

---

### Server

**Run (production profile):**
```bash
dotnet run --project server/src/YtGuessWho.Api/YtGuessWho.Api.csproj
```

**Run with hot-reload (development):**
```bash
dotnet watch --project server/src/YtGuessWho.Api/YtGuessWho.Api.csproj
```

**Run tests:**
```bash
dotnet test
```

The server starts on `http://localhost:5030` by default.
Health check: `GET http://localhost:5030/health` → `200 OK`

---

### Client

**Install dependencies** *(first time or after pulling changes):*
```bash
cd client && pnpm install
```

**Start development server with hot-reload:**
```bash
cd client && pnpm start
```

**Run unit tests:**
```bash
cd client && pnpm test
```

**Production build:**
```bash
cd client && pnpm run build
```

The client dev server starts on `http://localhost:4200`.

> **Note:** the client connects to the server at `http://localhost:5030/hubs/game`. Start the server first.
