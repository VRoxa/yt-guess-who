import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr';

/** Hub WebSocket endpoint — TODO: move to environment configuration in a future ticket. */
const HUB_URL = 'http://localhost:5030/hubs/game';

/**
 * Injection token providing the SignalR {@link HubConnection} instance.
 *
 * Declared as a token with a root-level factory so that unit tests can substitute
 * a test double without constructing a real WebSocket connection.
 */
export const HUB_CONNECTION = new InjectionToken<HubConnection>('HUB_CONNECTION', {
  providedIn: 'root',
  factory: () => new HubConnectionBuilder().withUrl(HUB_URL).build(),
});

/**
 * Singleton service responsible for the SignalR {@link HubConnection} lifecycle.
 *
 * @remarks
 * This is the **single point of contact** with `@microsoft/signalr` in the client.
 * No other service or component may import from `@microsoft/signalr` directly.
 *
 * Responsibilities:
 * - Maintaining one connection instance for the entire application lifetime.
 * - Exposing reactive state signals consumed by the rest of the application.
 * - Starting and stopping the connection on demand.
 * - Capturing connection errors without propagating unhandled rejections.
 */
@Injectable({ providedIn: 'root' })
export class HubConnectionService {
  readonly #connection = inject(HUB_CONNECTION);

  /** Current {@link HubConnectionState} of the SignalR connection. */
  readonly connectionState = signal<HubConnectionState>(this.#connection.state);

  /**
   * Human-readable error from the most recent failed connection attempt.
   * `undefined` when no error has occurred or after a new attempt clears the previous one.
   */
  readonly errorMessage = signal<string | undefined>(undefined);

  /** Derived signal — `true` when the connection is fully established. */
  readonly isConnected = computed(
    () => this.connectionState() === HubConnectionState.Connected,
  );

  /**
   * Derived signal — `true` while a connect or disconnect operation is in flight
   * ({@link HubConnectionState.Connecting} or {@link HubConnectionState.Disconnecting}).
   *
   * Use this to disable UI controls that must not be activated during transitions.
   */
  readonly isTransitioning = computed(
    () =>
      this.connectionState() === HubConnectionState.Connecting ||
      this.connectionState() === HubConnectionState.Disconnecting,
  );

  constructor() {
    // Keep the state signal in sync when the connection closes for any reason
    // not triggered by an explicit disconnect() call — e.g. server restart or network drop.
    this.#connection.onclose(() => {
      this.connectionState.set(this.#connection.state);
    });

    // Attempt to connect automatically when the application starts.
    // connect() handles its own errors and never rejects, so discarding the
    // promise here is intentional and safe.
    void this.connect();
  }

  /**
   * Starts the SignalR connection to the game hub.
   *
   * @remarks
   * Sets {@link connectionState} to {@link HubConnectionState.Connecting} immediately,
   * then updates to the connection's actual state once the attempt settles.
   * On failure the state reverts to {@link HubConnectionState.Disconnected} and
   * {@link errorMessage} is populated. This method never throws.
   */
  async connect(): Promise<void> {
    this.errorMessage.set(undefined);
    this.connectionState.set(HubConnectionState.Connecting);
    try {
      await this.#connection.start();
      this.connectionState.set(this.#connection.state);
    } catch (error) {
      this.connectionState.set(HubConnectionState.Disconnected);
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Connection failed.',
      );
    }
  }

  /**
   * Stops the SignalR connection gracefully.
   *
   * @remarks
   * Sets {@link connectionState} to {@link HubConnectionState.Disconnecting} immediately,
   * then updates to the connection's actual state once the stop completes.
   */
  async disconnect(): Promise<void> {
    this.connectionState.set(HubConnectionState.Disconnecting);
    await this.#connection.stop();
    this.connectionState.set(this.#connection.state);
  }

  /**
   * Invokes the `CreateJam` hub method and returns the generated Jam code.
   *
   * @remarks
   * This is a thin delegation to the underlying {@link HubConnection}. All lobby-level
   * state management (isCreating, jamCode, errorMessage) is the responsibility of the
   * calling component, not this service.
   *
   * @param displayName - The display name chosen by the Host.
   * @returns A promise that resolves with the Jam code string returned by the server.
   */
  createJam(displayName: string): Promise<string> {
    return this.#connection.invoke<string>('CreateJam', displayName);
  }
}

