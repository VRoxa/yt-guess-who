import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HubConnectionState } from '@microsoft/signalr';

import { HubConnectionService } from '../../core/hub-connection.service';

/**
 * Maps a {@link HubConnectionState} value to a human-readable status label.
 *
 * @param state - The current SignalR connection state.
 * @returns A display string safe for rendering directly in the template.
 * @throws {Error} When an unhandled {@link HubConnectionState} value is encountered —
 *   this indicates that a new enum member was added to the library without updating this mapping.
 */
function toStatusLabel(state: HubConnectionState): string {
  switch (state) {
    case HubConnectionState.Connected:
      return 'Connected';
    case HubConnectionState.Connecting:
      return 'Connecting…';
    case HubConnectionState.Disconnected:
      return 'Disconnected';
    case HubConnectionState.Disconnecting:
      return 'Disconnecting…';
    case HubConnectionState.Reconnecting:
      return 'Reconnecting…';
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled HubConnectionState: ${_exhaustive}`);
    }
  }
}

/**
 * Displays the current SignalR connection status and provides a button to
 * connect or disconnect from the game hub.
 *
 * @remarks
 * This is a pure presentational component. It reads state from
 * {@link HubConnectionService} and delegates all actions back to it.
 * It has no knowledge of SignalR internals.
 */
@Component({
  selector: 'app-connection-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="connection-status">
      <span role="status" class="status-badge">{{ statusLabel() }}</span>

      @if (errorMessage()) {
        <p class="error-message" role="alert">{{ errorMessage() }}</p>
      }

      <button
        type="button"
        class="action-button"
        [disabled]="isTransitioning()"
        (click)="onButtonClick()"
      >
        {{ buttonLabel() }}
      </button>
    </div>
  `,
  styleUrl: './connection-status.component.scss',
})
export class ConnectionStatusComponent {
  readonly #hub = inject(HubConnectionService);

  /** Proxied from the service so the template can read it without knowing about the service. */
  protected readonly isTransitioning = this.#hub.isTransitioning;

  /** Proxied from the service so the template can render the error alert. */
  protected readonly errorMessage = this.#hub.errorMessage;

  /** Human-readable label derived from the current connection state. */
  protected readonly statusLabel = computed(() =>
    toStatusLabel(this.#hub.connectionState()),
  );

  /**
   * Button label that reflects both the current state and the direction of any
   * in-flight transition.
   */
  protected readonly buttonLabel = computed(() => {
    const state = this.#hub.connectionState();

    if (state === HubConnectionState.Connecting) {
      return 'Connecting…';
    }

    if (state === HubConnectionState.Disconnecting) {
      return 'Disconnecting…';
    }

    return this.#hub.isConnected() ? 'Disconnect' : 'Connect';
  });

  /** Delegates the button action to the service based on the current connection state. */
  protected onButtonClick(): void {
    if (this.#hub.isConnected()) {
      void this.#hub.disconnect();
    } else {
      void this.#hub.connect();
    }
  }
}

