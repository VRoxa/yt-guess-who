# Web Client Documentation

## 1. Product Vision & Business Goals (PO/BO Perspective)

- **Core Value Proposition:** Deliver a responsive, real-time browser experience that allows players and hosts to interact with the game seamlessly. The client is the primary user-facing surface and directly drives engagement, session participation, and game completion rates.
- **Key User Personas:**
  - **Player:** Joins a game session, receives real-time prompts, and submits answers through the browser UI.
  - **Host/Facilitator:** Creates and manages game sessions, controls round progression, and monitors participant state.
  - **Developer/Maintainer:** Extends client features and maintains architectural consistency using Angular conventions and shared tooling.

---

## 2. Domain Boundaries & Context Mapping (DDD Perspective)

- **Bounded Contexts:**
  - **Web Client Context:** Owns all user interaction, view state management, routing, and client-side rendering. It is the only context that renders directly to the DOM.
  - **Realtime Communication Context (integration boundary):** Exchanges game events with the backend via SignalR and peer-to-peer channels via PeerJS. The client adapts these transport signals into view model updates.
  - **Session/Game State Context (integration boundary):** Consumes session and round state from backend application services and translates it into a UI-consumable shape.

- **Ubiquitous Language:**

  | Term | Definition |
  |---|---|
  | **Web Client** | The Angular application served to and executed in the user's browser. |
  | **View Model** | A UI-focused representation of domain or application data, decoupled from the raw API contract. |
  | **Session** | A running game instance, uniquely identified, with associated participants and round state. |
  | **Round** | A discrete unit of gameplay within a Session. |
  | **Participant** | A user who has joined and is active within a Session. |
  | **Realtime Event** | A server-pushed or peer-pushed message used to synchronise UI state across clients. |
  | **Hot Reload** | Local development mode where saved code changes are reflected in the browser automatically without a manual restart. |
  | **Build Artifact** | The production-optimised static output produced by `ng build`, ready for deployment. |

---

## 3. Domain Models & Rules

- **Core Aggregates and Entities:**
  - **Session View** (`sessionId`): The root client-side representation of an active game session, including status and participant list.
  - **Round View** (`roundId`): Represents the visual and interactive state of a single gameplay round.
  - **Participant View** (`participantId`): Represents an individual player's presence and state within the UI.
  - **Connection Status**: Tracks the real-time transport connection state (connected, reconnecting, disconnected) and surfaces it to the user.

- **Critical Invariants:**
  - A Session View must always be bound to a valid, non-null `sessionId`.
  - User actions that require an active Session must not be invokable without a confirmed active Session.
  - A Round View must not be rendered as active if its parent Session is not in an active state.
  - UI state must remain consistent with the latest accepted Realtime Event sequence; stale state must be explicitly invalidated.
  - Connection Status changes must always be surfaced to the user — silent failure in a real-time game is not acceptable.

---

## 4. Architecture Strategy

- **External Dependencies:**
  - **Node.js** (LTS) — runtime for Angular CLI and local development tooling.
  - **pnpm** (v9.1.1) — mandated package manager for security reasons. pnpm enforces strict, isolated dependency resolution that prevents phantom dependency attacks and guarantees a reproducible, auditable dependency graph. npm and yarn must not be used.
  - **Angular CLI** (v21) — dev server, build pipeline, code generation, and test runner orchestration.
  - **RxJS** (~7.8) — reactive stream primitives for handling real-time events throughout the client.
  - **PeerJS** (~1.5) — P2P transport abstraction for peer-to-peer game communication.
  - **Backend API / SignalR Hub** — consumed by client-side services at runtime.

- **Layout Recommendation:** Organise the Angular project into feature modules aligned to domain boundaries (e.g., `session/`, `round/`, `lobby/`). Keep presentational components, application-facing services, and transport integration adapters in clearly separated layers within each feature. Global infrastructure (realtime connection, routing, auth guards) lives in a dedicated `core/` module.

---

## 5. Project Location

| Artefact | Path |
|---|---|
| Angular project root | `client/` |
| Application source | `client/src/` |
| Entry point | `client/src/main.ts` |
| Global styles | `client/src/styles.scss` |
| App shell | `client/src/app/` |
| Angular workspace config | `client/angular.json` |
| Package manifest | `client/package.json` |
| TypeScript config (app) | `client/tsconfig.app.json` |
| TypeScript config (root) | `client/tsconfig.json` |
| Static assets | `client/public/` |

---

## 6. Runbook — Serve Locally with Hot Reload

### Prerequisites

- Node.js LTS installed and available on `$PATH`.
- pnpm v9.1.1 installed globally (pinned via `"packageManager": "pnpm@9.1.1"` in `package.json`). Install via `npm install -g pnpm@9.1.1` once, then use pnpm exclusively. Confirm with `pnpm -v`.

### Steps

From the application root directory (where `client/` is located):

**1. Navigate to the client directory**
```bash
cd client
```

**2. Install dependencies** *(first time or after pulling changes)*
```bash
pnpm install
```

**3. Start the development server with hot reload**
```bash
pnpm start
```

This runs `ng serve` under the `development` build configuration (source maps enabled, optimisation disabled). The Angular CLI will watch all files under `src/` and automatically recompile and reload the browser on every saved change.

**4. Open the application**

Navigate to [http://localhost:4200](http://localhost:4200) in your browser. The page will reload automatically when you save a file.

---

### Useful Variants

| Goal | Command (run from `client/`) |
|---|---|
| Serve on a custom port | `pnpm start -- --port 4201` |
| Serve and open browser automatically | `pnpm start -- --open` |
| Watch-mode build (no dev server) | `pnpm run watch` |
| Production build | `pnpm run build` |
| Run unit tests | `pnpm test` |

---

### Operational Notes

- **Package manager:** Always use `pnpm`. Never use `npm install` or `yarn` — doing so will produce an `npm`/`yarn` lockfile that conflicts with `pnpm-lock.yaml` and undermines dependency integrity guarantees.
- **Backend dependency:** If the client requires live backend API or SignalR Hub calls, ensure the server is running locally. See the server setup documentation for instructions.
- **Port conflicts:** If port `4200` is in use, use `-- --port <number>` to serve on an alternative port.
- **Dependency changes:** After any `package.json` change (e.g., pulling new commits), re-run `pnpm install` before starting the dev server.
- **Config changes:** Changes to `angular.json` or `tsconfig*.json` require restarting the dev server to take effect.

