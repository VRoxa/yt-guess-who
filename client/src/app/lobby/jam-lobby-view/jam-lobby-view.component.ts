import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { HubConnectionService } from '../../core/hub-connection.service';
import { JamCodeHeroComponent } from '../../shared/jam-code-hero/jam-code-hero.component';
import { PlayerListComponent } from '../../shared/player-list/player-list.component';
import type { Player } from '../../core/models/player.model';

/**
 * In-jam Lobby waiting room component.
 *
 * @remarks
 * Rendered by {@link LobbyComponent} when the player is inside a Jam in the
 * `Lobby` phase. Displays the Jam code hero, live player list, and — for the
 * Host — a **Start Submissions** button. Manages its own advance-phase and
 * leave-Jam in-flight state and error messages. Emits {@link left} when the
 * player has successfully left so the parent can reset shared Jam state.
 *
 * Design spec: `docs/design/components/lobby.md §2 — Inside the Jam`
 */
@Component({
  selector: 'app-jam-lobby-view',
  standalone: true,
  imports: [JamCodeHeroComponent, PlayerListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jam-view">
      <app-jam-code-hero [jamCode]="jamCode()" />

      <div class="waiting-section">
        <app-player-list [players]="players()" />
        <p class="waiting-text">
          Waiting for other players to join<span class="waiting-dots" aria-hidden="true"
            ><span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></span>
        </p>
      </div>

      @if (isHost()) {
        <div class="start-section">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="isAdvancingPhase()"
            (click)="onAdvancePhase()"
          >
            {{ isAdvancingPhase() ? 'Starting…' : 'Start Submissions' }}
          </button>
        </div>
      }

      @if (errorMessage() !== undefined) {
        <p class="form-error" role="alert">{{ errorMessage() }}</p>
      }

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
  `,
  styleUrl: './jam-lobby-view.component.scss',
})
export class JamLobbyViewComponent {
  private readonly hubService = inject(HubConnectionService);

  /** The current Jam's invite code — displayed in the hero card. */
  readonly jamCode = input.required<string>();

  /** Live player list maintained by the parent coordinator. */
  readonly players = input.required<ReadonlyArray<Player>>();

  /** Whether the current player holds the Host role in this Jam. */
  readonly isHost = input.required<boolean>();

  /**
   * Emitted after the player has successfully left the Jam.
   * The parent component should reset all shared Jam state when this fires.
   */
  readonly left = output<void>();

  protected readonly isAdvancingPhase = signal<boolean>(false);
  protected readonly isLeaving = signal<boolean>(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);

  /**
   * Invokes the `AdvancePhase` hub method to move the Jam to the Submission phase.
   * Only rendered and callable when the current player is the Host.
   */
  protected async onAdvancePhase(): Promise<void> {
    this.errorMessage.set(undefined);
    this.isAdvancingPhase.set(true);

    try {
      await this.hubService.advancePhase();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to start submissions. Please try again.',
      );
    } finally {
      this.isAdvancingPhase.set(false);
    }
  }

  /**
   * Invokes the `LeaveJam` hub method.
   * On success, emits {@link left} so the parent can reset shared Jam state.
   */
  protected async onLeaveJam(): Promise<void> {
    this.isLeaving.set(true);

    try {
      await this.hubService.leaveJam();
      this.left.emit();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to leave Jam. Please try again.',
      );
    } finally {
      this.isLeaving.set(false);
    }
  }
}

