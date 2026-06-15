import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { HubConnectionService } from '../core/hub-connection.service';
import type { Player } from '../core/models/player.model';

/**
 * Lobby screen component.
 *
 * @remarks
 * Covers two distinct moments of the user journey:
 * 1. Pre-join — the user chooses their name and decides to create or join a Jam.
 *    Uses progressive disclosure: name step is always visible; action step appears
 *    once a name is entered; join step replaces the action step when "Join a Jam" is clicked.
 * 2. In-jam — the Jam code is the visual hero. The player list fills in live via
 *    `PlayerJoined` events. A waiting indicator is shown until the game advances.
 *
 * All state is managed locally via signals. Hub communication is delegated to
 * {@link HubConnectionService} — this component contains no SignalR logic.
 *
 * Design spec: `docs/design/components/lobby.md`
 */
@Component({
  selector: 'app-lobby',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (jamCode() === null) {
      <div class="lobby-container">

        <!-- Step 1: Name — always visible in the pre-join phase -->
        <div class="step step--name">
          <label for="display-name">Your name</label>
          <input
            id="display-name"
            type="text"
            placeholder="Enter your name"
            autocomplete="name"
            [value]="displayName()"
            (input)="displayName.set($any($event.target).value)"
          />
        </div>

        <!-- Step 2: Action choice — fades in when name is non-empty -->
        @if (showActionStep()) {
          <div class="step step--action">
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="isCreating() || hubService.isTransitioning()"
              (click)="onCreateJam()"
            >
              {{ isCreating() ? 'Creating…' : 'Create a Jam' }}
            </button>
            <button
              type="button"
              class="btn btn--secondary"
              [disabled]="isCreating() || hubService.isTransitioning()"
              (click)="onShowJoinStep()"
            >
              Join a Jam
            </button>
          </div>
        }

        <!-- Step 3: Join mode — replaces action step when "Join a Jam" is clicked -->
        @if (showJoinInput()) {
          <div class="step step--join">
            <label for="jam-code">Jam code</label>
            <input
              #jamCodeInput
              id="jam-code"
              type="text"
              placeholder="Enter Jam code"
              autocomplete="off"
              [value]="enteredJamCode()"
              (input)="enteredJamCode.set($any($event.target).value)"
            />
            <button
              type="button"
              class="btn btn--primary"
              [disabled]="!enteredJamCode().trim() || isJoining() || hubService.isTransitioning()"
              (click)="onJoinJam()"
            >
              {{ isJoining() ? 'Joining…' : 'Join' }}
            </button>
            <button
              type="button"
              class="btn btn--ghost"
              [disabled]="isJoining()"
              (click)="onBack()"
            >
              Back
            </button>
          </div>
        }

        @if (errorMessage() !== undefined || hubService.errorMessage() !== undefined) {
          <p class="form-error" role="alert">{{ errorMessage() ?? hubService.errorMessage() }}</p>
        }
      </div>

    } @else {

      <!-- In-jam phase: Jam code hero + copy button + live player list -->
      <div class="jam-view">
        <div class="jam-code-section">
          <div class="jam-created__container">
            <p class="jam-label">Your Jam code</p>
            <p class="jam-code">{{ jamCode() }}</p>
            <p class="jam-hint">Share this code with your friends so they can join.</p>
          </div>
          <button
            type="button"
            class="btn btn--ghost copy-button"
            (click)="onCopyJamCode()"
          >
            {{ copiedJamCode() ? 'Copied!' : 'Copy Jam code' }}
          </button>
        </div>

        <div class="waiting-section">
          @if (players().length > 0) {
            <ul class="player-list" aria-label="Players in this Jam" aria-live="polite">
              @for (player of players(); track player.playerId) {
                <li class="player-list__item" [class.player-list__item--host]="player.isHost">
                  <span class="player-list__name">{{ player.displayName }}</span>
                  @if (player.isHost) {
                    <span class="player-list__host-badge">Host</span>
                  }
                </li>
              }
            </ul>
          }
          <p class="waiting-text">
            Waiting for other players to join<span class="waiting-dots" aria-hidden="true"
              ><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
          </p>
        </div>

        <div class="leave-section">
          <button
            type="button"
            class="btn btn--danger"
            [disabled]="isLeaving()"
            (click)="onLeaveJam()"
          >
            {{ isLeaving() ? 'Leaving…' : 'Leave Jam' }}
          </button>
        </div>
      </div>
    }
  `,
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent {
  protected readonly hubService = inject(HubConnectionService);

  /** Signal query for the Jam code input in the join step. Used for auto-focus. */
  private readonly jamCodeInput = viewChild<ElementRef<HTMLInputElement>>('jamCodeInput');

  /** Display name entered by the user. Shared across all pre-join steps. */
  protected readonly displayName = signal<string>('');

  /** Jam code typed by the user in the join step. */
  protected readonly enteredJamCode = signal<string>('');

  /** The confirmed Jam code after a successful create or join. `null` while in pre-join phase. */
  protected readonly jamCode = signal<string | null>(null);

  /** `true` while the CreateJam hub call is in-flight. */
  protected readonly isCreating = signal<boolean>(false);

  /** `true` while the JoinJam hub call is in-flight. */
  protected readonly isJoining = signal<boolean>(false);

  /** `true` while the LeaveJam hub call is in-flight. */
  protected readonly isLeaving = signal<boolean>(false);

  /** Human-readable error from the most recent failed attempt. */
  protected readonly errorMessage = signal<string | undefined>(undefined);

  /** Ordered list of Players in the current Jam, populated by `PlayerJoined` events. */
  protected readonly players = signal<Player[]>([]);

  /** `true` when the user has clicked "Join a Jam" and the join step is shown. */
  protected readonly showJoinInput = signal<boolean>(false);

  /** `true` for 2 seconds after a successful clipboard copy, to show "Copied!" feedback. */
  protected readonly copiedJamCode = signal<boolean>(false);

  /**
   * `true` when the action step (Create / Join buttons) should be visible.
   * Requires a non-empty name and the join step to be hidden.
   */
  protected readonly showActionStep = computed(
    () => this.displayName().trim().length > 0 && !this.showJoinInput(),
  );

  constructor() {
    // Append each arriving player to the live list.
    this.hubService.onPlayerJoined(player => {
      this.players.update(list => [...list, player]);
    });

    // Remove a departing player from the live list.
    this.hubService.onPlayerLeft(payload => {
      this.players.update(list => list.filter(p => p.playerId !== payload.playerId));
    });

    // Update host indicators when the Host role is transferred.
    this.hubService.onHostChanged(payload => {
      this.players.update(list =>
        list.map(p => ({ ...p, isHost: p.playerId === payload.newHostPlayerId })),
      );
    });

    // Auto-focus the Jam code input whenever the join step becomes visible.
    // The setTimeout defers the focus call until after Angular has rendered the @if block.
    effect(() => {
      if (this.showJoinInput()) {
        setTimeout(() => this.jamCodeInput()?.nativeElement.focus(), 0);
      }
    });
  }

  /** Shows the join step and clears any lingering error. */
  protected onShowJoinStep(): void {
    this.errorMessage.set(undefined);
    this.showJoinInput.set(true);
  }

  /** Returns to the action step, resetting the code input and clearing errors. */
  protected onBack(): void {
    this.showJoinInput.set(false);
    this.enteredJamCode.set('');
    this.errorMessage.set(undefined);
  }

  /**
   * Copies the current Jam code to the clipboard and shows brief "Copied!" feedback.
   * Fails silently if the Clipboard API is unavailable (e.g., in an insecure context).
   */
  protected async onCopyJamCode(): Promise<void> {
    const code = this.jamCode();
    if (code === null) { return; }

    try {
      await navigator.clipboard.writeText(code);
      this.copiedJamCode.set(true);
      setTimeout(() => this.copiedJamCode.set(false), 2000);
    } catch {
      // Intentional no-op: the Clipboard API is unavailable (HTTP, permissions denied,
      // or unsupported browser). The user can still select and copy the code manually.
    }
  }

  /**
   * Invokes the CreateJam hub method. Connects first if not already connected.
   * Shows an inline error if either step fails.
   */
  protected async onCreateJam(): Promise<void> {
    this.errorMessage.set(undefined);
    this.players.set([]);

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
   * Invokes the JoinJam hub method. Connects first if not already connected.
   * Shows an inline error if either step fails.
   */
  protected async onJoinJam(): Promise<void> {
    this.errorMessage.set(undefined);
    this.players.set([]);

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

  /**
   * Invokes the LeaveJam hub method.
   * On success, resets the in-jam state so the component returns to the pre-join phase.
   * On failure, shows an inline error message.
   */
  protected async onLeaveJam(): Promise<void> {
    this.isLeaving.set(true);

    try {
      await this.hubService.leaveJam();
      this.jamCode.set(null);
      this.players.set([]);
      this.errorMessage.set(undefined);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to leave Jam. Please try again.',
      );
    } finally {
      this.isLeaving.set(false);
    }
  }
}
