import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { HubConnectionService } from '../core/hub-connection.service';

/**
 * Lobby screen component.
 *
 * @remarks
 * Renders the "Create Jam" form when the Host has not yet created a Jam.
 * Once a Jam is successfully created, hides the form and displays the Jam code prominently.
 *
 * All state is managed locally via signals. Hub communication is delegated to
 * {@link HubConnectionService} — this component contains no SignalR logic.
 */
@Component({
  selector: 'app-lobby',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (jamCode() === null) {
      <div class="lobby-form">
        <h2>Create a Jam</h2>

        <label for="display-name">Your display name</label>
        <input
          id="display-name"
          type="text"
          placeholder="Enter your name"
          [value]="displayName()"
          (input)="displayName.set($any($event.target).value)"
        />

        <button
          type="button"
          [disabled]="!displayName().trim() || isCreating() || hubService.isTransitioning()"
          (click)="onCreateJam()"
        >
          {{ isCreating() ? 'Creating…' : 'Create Jam' }}
        </button>

        @if (errorMessage() !== undefined || hubService.errorMessage() !== undefined) {
          <p class="error">{{ errorMessage() ?? hubService.errorMessage() }}</p>
        }
      </div>
    } @else {
      <div class="jam-created">
        <p class="jam-label">Your Jam code</p>
        <p class="jam-code">{{ jamCode() }}</p>
        <p class="jam-hint">Share this code with your friends so they can join.</p>
      </div>
    }
  `,
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent {
  protected readonly hubService = inject(HubConnectionService);

  /** Display name entered by the Host. */
  protected readonly displayName = signal<string>('');

  /** The Jam code returned by the server after a successful create. `null` before creation. */
  protected readonly jamCode = signal<string | null>(null);

  /** `true` while the CreateJam hub call is in-flight. */
  protected readonly isCreating = signal<boolean>(false);

  /** Human-readable error from the most recent failed attempt. */
  protected readonly errorMessage = signal<string | undefined>(undefined);

  /**
   * Invokes the CreateJam hub method. If not yet connected, attempts to establish
   * the connection first. Shows an error if either step fails.
   */
  protected async onCreateJam(): Promise<void> {
    this.errorMessage.set(undefined);

    if (!this.hubService.isConnected()) {
      await this.hubService.connect();

      if (!this.hubService.isConnected()) {
        this.errorMessage.set(
          this.hubService.errorMessage() ?? 'Could not connect to the server.',
        );
        return;
      }
    }

    this.isCreating.set(true);

    try {
      const code = await this.hubService.createJam(this.displayName().trim());
      this.jamCode.set(code);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to create Jam. Please try again.',
      );
    } finally {
      this.isCreating.set(false);
    }
  }
}

