# TypeScript Coding Standards

## 1. Purpose & Scope

- **Why this guideline exists:** TypeScript's type system is only as protective as the discipline applied to it. Weakening it with `any`, unsafe casts, or loose null handling silently reintroduces the class of bugs it was designed to prevent. This document defines the standards that keep the codebase type-safe, readable, and idiomatic across all client-side development.
- **Who it applies to:** Every developer writing TypeScript in the `client/` project. This covers Angular components, services, pipes, guards, resolvers, models, utilities, and test files. Rules are grouped by concern; Angular-specific rules are in their own section.

---

## 2. Standards & Rules

---

### 2.1 — Compiler Configuration

The following compiler flags are already active in `tsconfig.json` and must never be weakened or disabled:

| Flag | Value | Effect |
|---|---|---|
| `strict` | `true` | Enables `strictNullChecks`, `strictFunctionTypes`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, and `alwaysStrict` |
| `noImplicitOverride` | `true` | Every `override` must be declared explicitly |
| `noImplicitReturns` | `true` | All code paths in a function must return a value |
| `noFallthroughCasesInSwitch` | `true` | Implicit switch case fall-through is a compile error |
| `noPropertyAccessFromIndexSignature` | `true` | Indexed properties must use bracket notation, not dot notation |
| `isolatedModules` | `true` | Every file must be a module (has at least one `import` or `export`) |
| `strictTemplates` | `true` | Angular template type-checking is maximally strict |
| `strictInjectionParameters` | `true` | All injectable constructor parameters must be resolvable |

1. **Never add `// @ts-ignore` or `// @ts-nocheck` to suppress errors.** Fix the underlying type problem. The only permitted suppression is `// @ts-expect-error` with a mandatory inline comment explaining the reason, used exclusively in test files for intentional negative type testing.
2. **Never set `skipLibCheck: false` exceptions per-file.** `skipLibCheck` is global and already set — do not override it per file.

---

### 2.2 — Naming Conventions

| Construct | Convention | Example |
|---|---|---|
| Classes, components, services, pipes | `PascalCase` | `SessionService`, `RoundCardComponent` |
| Interfaces and type aliases | `PascalCase` (no `I` prefix) | `PlayerViewModel`, `GamePhase` |
| Enums | `PascalCase` (name and members) | `ConnectionStatus.Connected` |
| Functions, methods, and variables | `camelCase` | `getSession()`, `currentRound` |
| Constants (module-level, never reassigned) | `UPPER_SNAKE_CASE` | `MAX_PLAYERS`, `DEFAULT_TIMEOUT_MS` |
| Angular component selectors | `app-kebab-case` | `app-score-board`, `app-player-card` |
| File names | `kebab-case` | `session.service.ts`, `round-card.component.ts` |
| Spec files | Same name as source + `.spec` | `session.service.spec.ts` |
| Signal variables | `camelCase`, no special suffix | `currentRound`, `isConnected` |
| Observable variables | `camelCase$` suffix | `messages$`, `connectionState$` |

3. **Boolean identifiers must read as a predicate.** Use `isActive`, `hasSubmitted`, `canStart` — never `active`, `submitted`, `start`.
4. **Do not use abbreviations** unless they are universally understood (`id`, `url`, `http`). Prefer `sessionId` over `sid`, `cancellationToken` over `ct`.

---

### 2.3 — Type System Usage

5. **Never use `any`.** `any` is a complete opt-out of type safety. Use `unknown` for values whose type is genuinely not yet known and narrow it with a type guard before use.
6. **Never use type assertions (`as T`) to silence a type error.** A type assertion that exists to paper over a mismatch is a latent bug. Use a type guard, a discriminated union, or fix the underlying type model instead.
7. **Type assertions are only permitted when the type system genuinely cannot infer what you already know statically** (e.g., casting a DOM event target). Every such assertion must have an inline `// reason:` comment.
8. **Always declare explicit return types on exported and public functions and methods.** Let inference work for local variables and private implementation details, but public contracts must be explicitly typed.
9. **Prefer `interface` for object shapes that may be extended or implemented.** Prefer `type` for union types, intersection types, mapped types, and conditional types. Do not use `interface` and `type` interchangeably for the same purpose within a feature.
10. **Prefer string literal union types over `enum`.** `type Direction = 'left' | 'right' | 'up' | 'down'` is preferred over an `enum`. Use `enum` only when the runtime value of the enum member matters (e.g., a numeric bitmask). Never use `const enum` — it is incompatible with `isolatedModules`.
11. **Use `readonly` on all properties that must not be mutated after construction.** Apply `readonly` to interface properties, class fields, and array/object parameters that the function must not modify.
12. **Use `as const` for module-level literal objects used as value maps.** This narrows the type to the most specific literal types and prevents accidental mutation.
13. **Use TypeScript utility types instead of manual type manipulation.** Prefer `Readonly<T>`, `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, and `ReturnType<T>` over manually rewriting equivalent types.
14. **Use `never` for exhaustive union checks.** When switching over a discriminated union, the default branch must assign to a `never`-typed variable to guarantee compile-time exhaustiveness.
15. **Use `import type` for type-only imports.** When an import is used solely as a type and not as a runtime value, use `import type { Foo } from '...'`. This is enforced by `isolatedModules`.

---

### 2.4 — Variables and Declarations

16. **Always use `const`. Use `let` only when reassignment is necessary. Never use `var`.**
17. **Declare variables at the tightest possible scope.** Do not declare a variable at the top of a function if it is only used inside a nested block.
18. **Prefer destructuring for object and array access.** `const { id, name } = player` is preferred over separate `player.id`, `player.name` accesses. Use array destructuring for tuples and known-length arrays.
19. **Use default parameters instead of null/undefined checks at the top of a function.** `function createRound(maxPlayers = 4)` is preferred over `maxPlayers = maxPlayers ?? 4` inside the body.
20. **Use rest parameters instead of the `arguments` object.** Rest parameters are typed; `arguments` is not.
21. **Prefer the spread operator for shallow copies and merges.** `{ ...defaults, ...overrides }` is preferred over `Object.assign({}, defaults, overrides)`.

---

### 2.5 — Null and Undefined Handling

22. **Prefer `undefined` over `null` for absent optional values.** TypeScript's optional chaining and optional properties use `undefined` natively. Use `null` only when integrating with an API or library that explicitly uses it.
23. **Use optional chaining `?.` for member access on potentially absent values.** Never write a manual null guard for simple member access.
24. **Use nullish coalescing `??` for fallback values.** `??` guards against `null` and `undefined` only, unlike `||` which also coalesces falsy values (`0`, `''`, `false`). Never use `||` as a null-fallback unless falsy coalescing is intentionally desired.
25. **Use nullish coalescing assignment `??=` for lazy initialisation.** `cache ??= new Map()` is preferred over `if (cache === undefined) cache = new Map()`.
26. **Never use non-null assertion `!` without an inline justification comment.** `value!.property` suppresses a null check the compiler was right to flag. Every `!` must be accompanied by `// reason:` explaining the guarantee.

---

### 2.6 — Control Flow and Expressions

27. **Use braces for all control flow statements.** Every `if`, `else`, `for`, `while`, and `do` block must use braces, including single-line bodies.
28. **Avoid excessive nesting.** Maximum two levels of nested control flow inside a function body. Use guard clauses (early returns) to flatten logic and eliminate deep `else` branches.
29. **Prefer the ternary operator for simple two-branch value assignments.** `const label = isHost ? 'Host' : 'Player'` is preferred over a four-line `if/else`. Do not use nested ternaries — extract to an `if/else` or a `switch` expression if more than two branches are needed.
30. **Prefer `switch` with exhaustive coverage for multi-branch type discrimination.** When branching on a union type with more than two members, prefer `switch` over chained `if/else if`.
31. **Use `for...of` for iterating arrays and iterables.** Avoid index-based `for (let i = 0; ...)` loops unless the index value is explicitly needed. Never use `for...in` on arrays.
32. **Do not use `delete` on object properties.** Mutating an object's shape with `delete` confuses the type system and the V8 optimiser. Prefer constructing a new object without the unwanted key using `Omit` + spread, or use a `Map` if the key set is dynamic.

---

### 2.7 — Functions and Arrow Functions

33. **Prefer arrow functions for callbacks, inline functions, and class methods that capture `this`.** Arrow functions do not rebind `this`, eliminating a common source of Angular service method bugs when passing methods as callbacks.
34. **Use arrow functions for all class property methods.** When a method is passed as a callback (e.g., to `subscribe()`, `map()`, or an event binding), declare it as an arrow property to guarantee `this` binding: `readonly submit = () => { ... }`.
35. **Omit parentheses around single arrow function parameters.** `x => x * 2` is preferred over `(x) => x * 2`. Use parentheses when there are zero or multiple parameters.
36. **Do not use `function` declarations inside Angular class bodies.** Use method syntax or arrow properties. `function` declarations inside classes are not valid TypeScript — this rule guards against the habit carried over from plain JS.
37. **Keep functions small and single-purpose.** A function that requires more than 20–25 lines to express its logic is a signal to extract a private helper or refactor the abstraction.
38. **Pure functions are preferred over methods with side effects.** Utility and transformation logic that does not depend on instance state must be extracted to standalone pure functions in a `*.utils.ts` file, not added as instance methods to a service or component.

---

### 2.8 — Strings

39. **Use single quotes for all string literals.** This is enforced by Prettier (`singleQuote: true`). Double quotes are only used inside strings that themselves contain single quotes.
40. **Use template literals for string interpolation and multi-line strings.** Never use `+` for string concatenation involving variables.
41. **Do not call `.toString()` inside template literals.** The interpolation context calls it implicitly.
42. **Use `===` and `!==` for all equality checks.** Never use `==` or `!=`. Loose equality with coercion is forbidden.

---

### 2.9 — Imports and Module Organisation

43. **Use path aliases instead of deep relative imports.** Configure `paths` in `tsconfig.json` (e.g., `@app/*`, `@core/*`, `@shared/*`) and import via alias, not via `../../../`. Deep relative paths are brittle to directory restructuring.
44. **Group and order imports consistently:** (1) Angular and third-party packages, (2) application aliases (`@app/`, `@core/`), (3) relative sibling/parent imports. A blank line separates each group.
45. **Use `import type` for type-only imports.** Reduces runtime bundle size and satisfies `isolatedModules`.
46. **Do not use barrel files (`index.ts`) that re-export everything from a directory indiscriminately.** Barrel files increase bundle size by pulling in code that tree-shaking cannot eliminate when the entire barrel is imported. Export only what is explicitly consumed by another module.
47. **Do not use circular imports.** A circular dependency is always a design problem — the types or logic need to be restructured, not worked around.

---

### 2.10 — Angular: Components

48. **All components must be `standalone: true`.** NgModule-based component declaration is not used in this project (Angular 21).
49. **Use `OnPush` change detection on all components.** `ChangeDetectionStrategy.OnPush` must be set explicitly on every component. Default change detection is forbidden — it defeats the performance model of signal-based and reactive Angular development.
50. **Prefer signal inputs (`input()`) over `@Input()` decorator.** Signal inputs are the Angular 21 standard; they are type-safe, support `required`, and integrate natively with the reactive graph.
51. **Prefer `output()` over `@Output() EventEmitter`.** `output()` is the Angular 21 standard and eliminates the need to manage `EventEmitter` types explicitly.
52. **Use `model()` for two-way binding.** `model<T>()` is preferred over `@Input()` + `@Output()` pairs for two-way bindable properties.
53. **Keep component templates small.** A component template exceeding 100 lines is a signal to extract child components. Logic in templates must be limited to: conditional rendering (`@if`), iteration (`@for`), event bindings, and property bindings. Never write complex expressions or function calls in template bindings.
54. **Do not call functions in template bindings that are not signals or pure getters.** Template functions are called on every change detection cycle. Use `computed()` signals or `@Pipe({ pure: true })` to memoize derived values.
55. **Use `@for` with `track` on every loop.** The `track` expression must uniquely identify each item (e.g., `track player.id`). Trackless `@for` loops are a compile-time warning under `strictTemplates` and degrade rendering performance.
56. **Apply the `app-` prefix to all component selectors.** This is the project prefix configured in `angular.json`.

---

### 2.11 — Angular: Services and Dependency Injection

57. **Use `inject()` for dependency injection in services, components, guards, and resolvers.** Constructor injection is permitted but `inject()` is the Angular 21 standard — it works outside constructors, in functional guards and resolvers, and composes cleanly with inheritance.
58. **Register singleton services with `providedIn: 'root'`.** Services that are used application-wide must not be provided in a component's `providers` array — that creates a new instance per component. Use component-scoped provision only when the service lifetime must be tied to the component lifetime, and document why.
59. **Services must be stateless or explicitly manage their state via signals.** A service holding raw mutable fields (`private currentPlayer = someValue`) without a signal wrapper is not reactive. Use `signal<T>()` for all mutable state that components or other services must react to.
60. **Never inject `HttpClient` directly into a component.** HTTP calls belong in services. Components receive data via service observables or signals, not by making HTTP calls themselves.

---

### 2.12 — Angular: Signals and Reactivity

61. **Prefer signals for all local and shared component state.** `signal<T>()`, `computed<T>()`, and `effect()` are the primary reactivity primitives. Use RxJS Observables for streams — especially real-time SignalR events and PeerJS messages — and convert to signals at the component boundary with `toSignal()`.
62. **Use `computed()` for any value derived from one or more signals.** Never manually re-derive a value in multiple places when a `computed()` signal can capture it once and memoize it.
63. **Use `effect()` sparingly.** Effects are for synchronising signals to side effects (logging, localStorage, DOM interactions). Do not use `effect()` to update another signal in response to a signal change — use `computed()` instead.
64. **Never mutate signal values directly.** Always call `.set()`, `.update()`, or `.mutate()` on the signal itself. Mutating the held reference in place (e.g., `mySignal().push(item)`) bypasses the reactivity graph.
65. **Use `toSignal()` to bridge Observables to the template.** Avoid subscribing to Observables inside component class bodies when the result is only used in the template. `toSignal()` handles subscription lifetime automatically via the component's injection context.

---

### 2.13 — RxJS

66. **Use the `$` suffix for all Observable variables.** `messages$`, `connectionState$`, `rounds$` — this is the established Angular convention and makes Observable lifetimes visually traceable.
67. **Never subscribe inside another subscription (nested subscriptions).** Use higher-order mapping operators: `switchMap`, `mergeMap`, `concatMap`, or `exhaustMap` depending on the desired concurrency strategy.
68. **Always handle errors in Observable chains.** Every `subscribe()` call or `pipe()` that touches external I/O must include a `catchError` operator or an error callback. Unhandled Observable errors terminate the stream silently.
69. **Use `takeUntilDestroyed()` to manage subscription lifetimes in components.** The `DestroyRef`-based `takeUntilDestroyed()` helper (Angular 16+) is the standard — do not use `ngOnDestroy` + `Subject` + `takeUntil` patterns unless there is a specific reason.
70. **Prefer `switchMap` for user-triggered requests.** When a user action triggers an Observable (e.g., searching, selecting a session), `switchMap` automatically cancels the in-flight request when a new action arrives. Use `concatMap` when order must be preserved, `mergeMap` when parallelism is desired.
71. **Do not create Observables from Promises using `from()` unless bridging a non-RxJS API.** If you control the code, keep it consistently Observable-based. Do not mix observable and promise chains unnecessarily.
72. **Keep RxJS pipes readable.** A `pipe()` with more than five operators is a signal to extract a named pure function (`const transformRound = pipe(...)`) or split the stream into named intermediates.

---

### 2.14 — Error Handling

73. **Never use `catch` with an untyped `error` parameter without narrowing.** Caught errors are `unknown` in strict TypeScript. Always narrow with `if (error instanceof SomeErrorType)` before accessing properties.
74. **Never swallow errors silently.** Every `catch` block must either rethrow, log, or surface the error to the user. An empty `catch` block or a `catch` that only does `console.log` is forbidden in production code.
75. **Define typed error classes for domain-level failures.** Use `class SessionNotFoundError extends Error` rather than throwing plain `new Error('Session not found')`. Typed errors are catchable selectively and carry structured information.
76. **Propagate HTTP errors through the Observable chain.** Do not catch HTTP errors in a service and return `null` — return the error as a typed discriminated result or let it propagate so the component can handle it explicitly.

---

### 2.15 — Code Quality and Formatting

77. **Maximum line length is 100 characters.** Enforced by Prettier (`printWidth: 100`).
78. **Use single quotes for all string literals.** Enforced by Prettier (`singleQuote: true`).
79. **No trailing commas are required.** Prettier handles trailing comma insertion automatically — do not add or remove them manually.
80. **Do not commit `console.log`, `console.warn`, or `console.error` to production code.** Use Angular's structured logging service or remove debug statements before committing. `console` calls are permitted in test files.
81. **Remove all unused imports, variables, and dead code before committing.** The TypeScript compiler with `noUnusedLocals` and `noUnusedParameters` flags (enable these when adding ESLint) will surface these — treat them as errors.
82. **Do not leave TODO comments untracked.** A `// TODO:` comment that is not linked to a ticket is dead context. Either create a ticket and reference it (`// TODO: ticket-042 — extract to service`) or fix it immediately.

---

## 3. Rationale

- **`strict: true` as non-negotiable baseline:** Strict mode catches the largest class of TypeScript bugs at compile time — null dereferences, implicit `any`, missing return paths. Weakening it in any file silently re-opens those classes of bugs in that file.
- **No `any` — use `unknown`:** `any` disables all type checking for a value and everything it flows into, propagating unsafety invisibly across the codebase. `unknown` requires explicit narrowing at the point of use, keeping the type boundary intact.
- **`import type` for type-only imports:** Prevents type-only code from appearing in the compiled output, reduces bundle size, and is required for `isolatedModules` correctness. Without it, importing a type from a file with side effects can pull those side effects into bundles that don't need them.
- **`OnPush` change detection by default:** In a real-time game with frequent SignalR events, default change detection would trigger full component tree checks on every event. `OnPush` limits re-rendering to explicit signal/input changes, which is critical for performance at scale.
- **Signals over raw state fields:** Raw mutable class fields are not reactive — they do not notify Angular's rendering engine or dependent computations when they change. Signals provide fine-grained reactivity with zero boilerplate and integrate directly with the template without requiring manual `detectChanges()` calls.
- **`inject()` over constructor injection:** `inject()` works in standalone functions (guards, resolvers, factory functions), does not require parameter order maintenance, and is compatible with signal-based component patterns. It is the direction Angular is standardising on.
- **`takeUntilDestroyed()` for subscription management:** Memory leaks from unmanaged subscriptions are the most common Angular performance problem. `takeUntilDestroyed()` is the minimal, idiomatic solution — tied to the component's `DestroyRef`, it requires no `ngOnDestroy` boilerplate.
- **Observable `$` suffix:** In a codebase that mixes signals, promises, and observables, visual disambiguation at the variable declaration site eliminates an entire class of misuse bugs (subscribing to a signal, awaiting an observable, etc.).
- **String literal unions over `enum`:** TypeScript `enum` members compile to runtime objects that require careful handling with `isolatedModules`. String literal unions are purely compile-time, tree-shakeable, and produce no runtime output. They are also directly serialisable to/from JSON API payloads without mapping.

---

## 4. Examples

### Naming — types, variables, observables, signals

```typescript
// ✅ Correct
type GamePhase = 'lobby' | 'active' | 'finished';
interface PlayerViewModel { readonly id: string; readonly displayName: string; }
const MAX_PLAYERS = 8;
const messages$ = new Observable<SignalRMessage>();
const currentRound = signal<Round | undefined>(undefined);

// ❌ Wrong
enum GamePhase { Lobby, Active, Finished }       // prefer string literal union
interface IPlayerViewModel { ... }               // no I prefix
var maxPlayers = 8;                              // never var
const messages = new Observable<SignalRMessage>(); // missing $ suffix
```

---

### Type safety — `unknown` over `any`, type guards

```typescript
// ✅ Correct
function parseEvent(raw: unknown): GameEvent {
  if (!isGameEvent(raw)) throw new UnexpectedEventError(raw);
  return raw;
}

function isGameEvent(value: unknown): value is GameEvent {
  return typeof value === 'object' && value !== null && 'type' in value;
}

// ❌ Wrong
function parseEvent(raw: any): GameEvent {
  return raw as GameEvent; // no validation, unsafe assertion
}
```

---

### Exhaustive switch with `never`

```typescript
// ✅ Correct
function getPhaseLabel(phase: GamePhase): string {
  switch (phase) {
    case 'lobby':    return 'Waiting for players';
    case 'active':   return 'Round in progress';
    case 'finished': return 'Game over';
    default: {
      const _exhaustive: never = phase;
      throw new Error(`Unhandled phase: ${_exhaustive}`);
    }
  }
}

// ❌ Wrong — no default, silent fall-through for future union members
switch (phase) {
  case 'lobby': return 'Waiting for players';
}
```

---

### Null handling — `?.`, `??`, no `!`

```typescript
// ✅ Correct
const name = session?.host?.displayName ?? 'Unknown host';
cache ??= new Map<string, Round>();

// ❌ Wrong
const name = session && session.host ? session.host.displayName : 'Unknown host';
if (cache == null) cache = new Map<string, Round>(); // == not ===
const name = session!.host!.displayName;             // suppresses the check entirely
```

---

### `const` assertions and `readonly`

```typescript
// ✅ Correct
const PHASES = ['lobby', 'active', 'finished'] as const;
type GamePhase = typeof PHASES[number]; // 'lobby' | 'active' | 'finished'

interface RoundConfig { readonly maxSubmissions: number; readonly durationSeconds: number; }

// ❌ Wrong
const PHASES = ['lobby', 'active', 'finished']; // inferred as string[], loses literal types
```

---

### Angular component — standalone, OnPush, signal input, output

```typescript
// ✅ Correct
@Component({
  selector: 'app-player-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ player().displayName }}</span>`,
})
export class PlayerCardComponent {
  readonly player = input.required<PlayerViewModel>();
  readonly eliminated = output<string>();
}

// ❌ Wrong
@Component({ selector: 'PlayerCard', changeDetection: ChangeDetectionStrategy.Default })
export class PlayerCardComponent implements OnInit {
  @Input() player!: PlayerViewModel; // non-signal input, no required
  @Output() eliminated = new EventEmitter<string>(); // deprecated pattern
}
```

---

### Signals — `signal`, `computed`, `toSignal`

```typescript
// ✅ Correct
readonly #sessionService = inject(SessionService);

readonly session = toSignal(this.#sessionService.session$);
readonly playerCount = computed(() => this.session()?.players.length ?? 0);
readonly hasEnoughPlayers = computed(() => this.playerCount() >= MIN_PLAYERS);

// ❌ Wrong — raw field, not reactive
session: SessionViewModel | undefined;
get playerCount() { return this.session?.players.length ?? 0; } // called every CD cycle
```

---

### RxJS — `takeUntilDestroyed`, error handling, no nested subscribes

```typescript
// ✅ Correct
readonly #destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.#hubService.roundStarted$
    .pipe(
      switchMap(round => this.#roundService.load(round.id)),
      catchError(err => { this.error.set(err.message); return EMPTY; }),
      takeUntilDestroyed(this.#destroyRef),
    )
    .subscribe(round => this.currentRound.set(round));
}

// ❌ Wrong — nested subscribe, no error handling, no lifetime management
this.#hubService.roundStarted$.subscribe(round => {
  this.#roundService.load(round.id).subscribe(details => {
    this.currentRound = details; // raw field mutation
  });
});
```

---

### Import grouping and `import type`

```typescript
// ✅ Correct
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SessionService } from '@app/session/session.service';

import type { PlayerViewModel } from './player.model';

// ❌ Wrong — mixed groups, missing import type, deep relative path
import { PlayerViewModel } from '../../../shared/models/player.model';
import { Component } from '@angular/core';
import { SessionService } from '@app/session/session.service';
```

---

## 5. Enforcement

| Rule | Enforcement mechanism |
|---|---|
| `strict` and all compiler flags | `tsconfig.json` — already active; CI fails on any compiler error |
| `@ts-ignore` / `@ts-nocheck` prohibition | ESLint rule `@typescript-eslint/ban-ts-comment` (to be configured per ADR) |
| `no-any` | ESLint rule `@typescript-eslint/no-explicit-any: error` |
| `import type` for type-only imports | ESLint rule `@typescript-eslint/consistent-type-imports: error` |
| Single quotes, line length 100 | Prettier — enforced in CI via `pnpm exec prettier --check .` |
| `OnPush` change detection | ESLint rule `@angular-eslint/prefer-on-push-component-change-detection: error` |
| `standalone: true` | ESLint rule `@angular-eslint/prefer-standalone-component: error` |
| `app-` component selector prefix | ESLint rule `@angular-eslint/component-selector` (prefix: `app`) |
| `takeUntilDestroyed` for subscriptions | Enforced by code review; `rxjs/no-ignored-subscription` ESLint rule aspirational |
| No `console.log` in production | ESLint rule `no-console: error` scoped to `src/app/**` |
| No `var` | ESLint rule `no-var: error` |
| `const` over `let` | ESLint rule `prefer-const: error` |
| `===` / `!==` only | ESLint rule `eqeqeq: error` |
| Explicit return types on public members | ESLint rule `@typescript-eslint/explicit-module-boundary-types: warn` |
| All other rules | Code review is the primary gate; all reviewers are expected to know this document |

> **Note:** ESLint is not yet configured in the project. An ADR to select and configure `@typescript-eslint` and `@angular-eslint` is required. Until that ADR is accepted and the tooling is active, all rules above marked as "ESLint" are enforced exclusively by code review.

