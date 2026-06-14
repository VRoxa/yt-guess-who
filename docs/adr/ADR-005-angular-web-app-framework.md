# ADR-005: Angular as Web App Framework

* **Status:** Accepted
* **Date:** 2026-06-14
* **Context/Problem Statement:** The product requires a client-side web application capable of supporting real-time game interactions, reactive UI state, and tight integration with backend signalling and P2P transport layers. The framework choice directly impacts type safety, team velocity, long-term maintainability, and the cost of onboarding future contributors.

## Options Considered

### Option 1: Angular + SCSS
* **Description:** Build the web client using Angular as the primary framework with SCSS as the styling language. TypeScript is a first-class, non-optional citizen of the Angular ecosystem.
* **Pros:**
  - Built-in TypeScript support enforces type-safe contracts across components, services, and domain models without extra configuration.
  - Strong framework conventions (modules, services, dependency injection) reduce architectural drift across features.
  - Angular CLI provides consistent tooling for dev server, build, testing, and code generation out of the box.
  - SCSS enables structured, composable styling with variables, mixins, and nesting, scaling well with UI complexity.
  - Team familiarity lowers delivery risk and shortens onboarding time for new contributors.
  - RxJS is a first-class primitive, aligning well with reactive real-time event streams from SignalR and PeerJS.
* **Cons:**
  - More opinionated structure can feel heavyweight for simple UI slices.
  - Steeper learning curve for contributors unfamiliar with Angular's DI model and reactive patterns.
  - Bundle complexity is higher than lightweight alternatives for trivial applications.

### Option 2: React + TypeScript + CSS Modules
* **Description:** Build the web client using React with TypeScript and CSS Modules (or a utility-first library such as Tailwind CSS) for styling.
* **Pros:**
  - Large ecosystem and wide hiring market.
  - Flexible composition model for varied UI patterns and state management approaches.
  - Lighter runtime footprint depending on library choices.
* **Cons:**
  - Requires deliberate, additive decisions for routing, DI, state management, and architectural conventions — increasing inconsistency risk.
  - TypeScript is optional and not enforced by the framework itself.
  - Lower team familiarity increases execution risk and ramp-up time.
  - RxJS integration is a manual concern rather than a built-in primitive.

## Decision Outcome
* **Chosen Option:** Angular + SCSS
* **Justification:** Angular + SCSS best serves the product goals of predictable delivery, maintainable client architecture, and real-time reactivity. Built-in TypeScript and RxJS support aligns directly with the event-driven, real-time nature of the game and enforces contract safety across the client boundary. Existing team familiarity reduces execution risk and accelerates near-term throughput.
* **Consequences:** We gain strong architectural consistency, enforced type safety, a rich reactive programming model, and a unified toolchain. We accept Angular's opinionated structure as a constraint and commit to Angular-centric conventions for all future client-side evolution. Component style budget limits (configured in `angular.json`) are enforced at build time as an early guardrail against style bloat. **pnpm is mandated as the package manager** (in place of npm) for security reasons — it enforces strict, isolated dependency resolution that prevents phantom dependency attacks and ensures a more auditable, reproducible dependency graph.

