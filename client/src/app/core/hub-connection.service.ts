import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr';

import type { HostChangedEvent } from './models/host-changed.model';
import type { Player } from './models/player.model';

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

  /**
   * Invokes the `JoinJam` hub method, adding the caller to an existing Jam.
   *
   * @remarks
   * Thin delegation to the underlying {@link HubConnection}. All lobby-level
   * state management (isJoining, jamCode, errorMessage) is the responsibility of the
   * calling component, not this service.
   *
   * @param jamCode - The invite code of the Jam to join.
   * @param displayName - The display name chosen by the joining Player.
   * @returns A promise that resolves when the server confirms the join, or rejects
   * with the error code string when the server sends a {@link HubException}.
   */
  joinJam(jamCode: string, displayName: string): Promise<void> {
    return this.#connection.invoke<void>('JoinJam', jamCode, displayName);
  }

  /**
   * Registers a handler invoked each time the server sends a `PlayerJoined` event.
   *
   * @remarks
   * Thin delegation to `HubConnection.on`. The SignalR client buffers `on` registrations
   * regardless of connection state, so callers may register before the connection starts.
   * State management (appending to a player list) is the responsibility of the caller.
   *
   * @param handler - Callback receiving the {@link Player} that joined.
   */
  onPlayerJoined(handler: (player: Player) => void): void {
    this.#connection.on('PlayerJoined', handler);
  }

  /**
   * Invokes the `LeaveJam` hub method, removing the caller from their current Jam.
   *
   * @remarks
   * Thin delegation to the underlying {@link HubConnection}. All lobby-level state management
   * (isLeaving, resetting jamCode and players) is the responsibility of the calling component.
   *
   * @returns A promise that resolves when the server confirms the departure, or rejects
   * with the error code string when the server sends a {@link HubException}.
   */
  leaveJam(): Promise<void> {
    return this.#connection.invoke<void>('LeaveJam');
  }

  /**
   * Registers a handler invoked each time the server sends a `PlayerLeft` event.
   *
   * @remarks
   * Thin delegation to `HubConnection.on`. State management (removing from a player list)
   * is the responsibility of the caller.
   *
   * @param handler - Callback receiving the payload containing the `playerId` that left.
   */
  onPlayerLeft(handler: (payload: { playerId: string }) => void): void {
    this.#connection.on('PlayerLeft', handler);
  }

  /**
   * Registers a handler invoked each time the server sends a `HostChanged` event.
   *
   * @remarks
   * Thin delegation to `HubConnection.on`. State management (updating isHost flags)
   * is the responsibility of the caller.
   *
   * @param handler - Callback receiving the {@link HostChangedEvent} payload.
   */
  onHostChanged(handler: (payload: HostChangedEvent) => void): void {
    this.#connection.on('HostChanged', handler);
  }

  /**
   * Returns the SignalR ConnectionId of the current connection, or `null` if not yet connected.
   *
   * @remarks
   * The ConnectionId matches the `Context.ConnectionId` used as `PlayerId` on the server.
   * This value is only available after the connection has been successfully started.
   */
  getConnectionId(): string | null {
    return this.#connection.connectionId;
  }

  /**
   * Invokes the `AdvancePhase` hub method, advancing the Jam to the next phase.
   *
   * @remarks
   * Thin delegation to the underlying {@link HubConnection}. Only the Host may call this.
   * State management (currentPhase) is the responsibility of the calling component via
   * the `onPhaseChanged` event handler.
   *
   * @returns A promise that resolves when the server confirms the advance, or rejects
   * with the error code string when the server sends a {@link HubException}.
   */
  advancePhase(): Promise<void> {
    return this.#connection.invoke<void>('AdvancePhase');
  }

  /**
   * Invokes the `SubmitSong` hub method with the Player's YouTube URL.
   *
   * @remarks
   * Thin delegation to the underlying {@link HubConnection}. State management
   * (isSubmitting, submitted state) is the responsibility of the calling component.
   *
   * @param youtubeUrl - The raw YouTube URL string to submit.
   * @returns A promise that resolves when the server confirms the submission, or rejects
   * with the error code string when the server sends a {@link HubException}.
   */
  submitSong(youtubeUrl: string): Promise<void> {
    return this.#connection.invoke<void>('SubmitSong', youtubeUrl);
  }

  /**
   * Registers a handler invoked each time the server sends a `PhaseChanged` event.
   *
   * @param handler - Callback receiving the payload containing the new phase string.
   */
  onPhaseChanged(handler: (payload: { newPhase: string }) => void): void {
    this.#connection.on('PhaseChanged', handler);
  }

  /**
   * Registers a handler invoked each time the server sends a `SongSubmitted` event.
   *
   * @remarks
   * The payload carries only the `playerId` — the URL is never revealed to peers.
   *
   * @param handler - Callback receiving the payload containing the `playerId` that submitted.
   */
  onSongSubmitted(handler: (payload: { playerId: string }) => void): void {
    this.#connection.on('SongSubmitted', handler);
  }

  /**
   * Registers a handler invoked when the server broadcasts `AllSubmissionsReceived`.
   *
   * @remarks
   * This event carries no payload — the event itself is the signal that every Player
   * in the Jam has submitted their song URL.
   *
   * @param handler - Zero-argument callback invoked when all submissions are in.
   */
  onAllSubmissionsReceived(handler: () => void): void {
    this.#connection.on('AllSubmissionsReceived', handler);
  }

  /**
   * Unregisters a previously registered event handler by event name and reference.
   *
   * @remarks
   * Must be called in `DestroyRef.onDestroy` for any handler registered by a component
   * that can be created and destroyed multiple times, to prevent handler pile-up on
   * the shared long-lived {@link HubConnection}.
   *
   * @param eventName - The SignalR event name passed to {@link HubConnection.on}.
   * @param handler - The exact function reference that was registered.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  offEvent(eventName: string, handler: (...args: any[]) => void): void {
    this.#connection.off(eventName, handler);
  }
}

