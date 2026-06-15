import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { HubConnectionService } from '../core/hub-connection.service';

/**
 * Lobby screen component.
 *
 * @remarks
 * Renders the lobby form where a user can either create a new Jam or join an existing one.
 * Once either action succeeds, hides the form and displays the confirmed Jam code prominently.
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
        <div class="form-field">
          <label for="display-name">Your display name</label>
          <input
            id="display-name"
            type="text"
            placeholder="Enter your name"
            [value]="displayName()"
            (input)="displayName.set($any($event.target).value)"
          />
        </div>

        <div class="form-field">
          <label for="jam-code">Jam code</label>
          <input
            id="jam-code"
            type="text"
            placeholder="Enter a Jam code to join"
            [value]="enteredJamCode()"
            (input)="enteredJamCode.set($any($event.target).value)"
          />
        </div>

        <div class="button-row">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="!displayName().trim() || isCreating() || isJoining() || hubService.isTransitioning()"
            (click)="onCreateJam()"
          >
            {{ isCreating() ? 'Creating…' : 'Create Jam' }}
          </button>

          <button
            type="button"
            class="btn btn--secondary"
            [disabled]="!displayName().trim() || !enteredJamCode().trim() || isJoining() || isCreating() || hubService.isTransitioning()"
            (click)="onJoinJam()"
          >
            {{ isJoining() ? 'Joining…' : 'Join Jam' }}
          </button>
        </div>

        @if (errorMessage() !== undefined || hubService.errorMessage() !== undefined) {
          <p class="form-error">{{ errorMessage() ?? hubService.errorMessage() }}</p>
        }
      </div>
    } @else {
      <div class="jam-created">
        <div class="jam-created__container">
          <p class="jam-label">Your Jam code</p>
          <p class="jam-code">{{ jamCode() }}</p>
          <p class="jam-hint">Share this code with your friends so they can join.</p>
        </div>
      </div>
    }
  `,
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent {
  protected readonly hubService = inject(HubConnectionService);

  /** Display name entered by the user. Shared between the create and join flows. */
  protected readonly displayName = signal<string>('');

  /** Jam code typed by the user when they want to join an existing Jam. */
  protected readonly enteredJamCode = signal<string>('');

  /** The confirmed Jam code shown after a successful create or join. `null` before either action. */
  protected readonly jamCode = signal<string | null>(null);

  /** `true` while the CreateJam hub call is in-flight. */
  protected readonly isCreating = signal<boolean>(false);

  /** `true` while the JoinJam hub call is in-flight. */
  protected readonly isJoining = signal<boolean>(false);

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

  /**
   * Invokes the JoinJam hub method. If not yet connected, attempts to establish
   * the connection first. Shows an error if either step fails.
   */
  protected async onJoinJam(): Promise<void> {
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

    this.isJoining.set(true);

    try {
      const code = this.enteredJamCode().trim();
      await this.hubService.joinJam(code, this.displayName().trim());
      this.jamCode.set(code);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to join Jam. Please try again.',
      );
    } finally {
      this.isJoining.set(false);
    }
  }
}
