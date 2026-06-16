import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { HubConnectionService } from '../core/hub-connection.service';
import { JamCodeHeroComponent } from '../shared/jam-code-hero/jam-code-hero.component';
import { PlayerListComponent } from '../shared/player-list/player-list.component';
import type { Player } from '../core/models/player.model';

/**
 * Submission phase screen.
 *
 * @remarks
 * Rendered by {@link LobbyComponent} when the Jam enters the `Submission` phase.
 * Manages its own submission state (URL input, submission progress, all-in indicator)
 * and Leave Jam action. Emits {@link left} when the player has successfully left so
 * the parent can reset shared Jam state.
 *
 * Registers `SongSubmitted` and `AllSubmissionsReceived` hub event handlers on creation
 * and unregisters them on destroy via {@link DestroyRef} to prevent handler pile-up
 * when the component is re-created across multiple Jam sessions.
 */
@Component({
  selector: 'app-submission',
  standalone: true,
  imports: [JamCodeHeroComponent, PlayerListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="submission-view">
      <app-jam-code-hero [jamCode]="jamCode()" />

      <div class="submission-content">
        @if (allSubmissionsReceived()) {
          <p class="all-submitted-message" role="status">All songs are in! 🎉</p>
        } @else {
          @if (!hasSubmitted()) {
            <div class="submission-form" aria-label="Submit your song">
              <label for="youtube-url">Your YouTube URL</label>
              <input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=…"
                autocomplete="off"
                [value]="submissionUrl()"
                (input)="submissionUrl.set($any($event.target).value)"
              />
              <button
                type="button"
                class="btn btn--primary"
                [disabled]="!submissionUrl().trim() || isSubmitting()"
                (click)="onSubmitSong()"
              >
                {{ isSubmitting() ? 'Submitting…' : 'Submit' }}
              </button>
            </div>
          } @else {
            <p class="submitted-confirmation" role="status">You have submitted your song. ✓</p>
          }
        }

        <app-player-list
          [players]="players()"
          [submittedPlayerIds]="submittedPlayerIds()"
        />
      </div>

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
  styleUrl: './submission.component.scss',
})
export class SubmissionComponent {
  private readonly hubService = inject(HubConnectionService);

  /** The current Jam's invite code — displayed in the hero card at the top of the view. */
  readonly jamCode = input.required<string>();

  /** Live player list maintained by the parent. Used to build the submission progress list. */
  readonly players = input.required<ReadonlyArray<Player>>();

  /**
   * The SignalR ConnectionId of the current client.
   * Used to determine whether the current player has already submitted.
   */
  readonly myPlayerId = input<string | null>(null);

  /**
   * Emitted after the player has successfully left the Jam.
   * The parent component should reset all shared Jam state when this fires.
   */
  readonly left = output<void>();

  protected readonly submittedPlayerIds = signal<ReadonlySet<string>>(new Set());
  protected readonly allSubmissionsReceived = signal<boolean>(false);
  protected readonly submissionUrl = signal<string>('');
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isLeaving = signal<boolean>(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);

  /** `true` when the current player's id is already in {@link submittedPlayerIds}. */
  protected readonly hasSubmitted = computed(() =>
    this.submittedPlayerIds().has(this.myPlayerId() ?? ''),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);

    const onSongSubmitted = (payload: { playerId: string }): void => {
      this.submittedPlayerIds.update(ids => new Set([...ids, payload.playerId]));
    };

    const onAllSubmissionsReceived = (): void => {
      this.allSubmissionsReceived.set(true);
    };

    this.hubService.onSongSubmitted(onSongSubmitted);
    this.hubService.onAllSubmissionsReceived(onAllSubmissionsReceived);

    destroyRef.onDestroy(() => {
      this.hubService.offEvent('SongSubmitted', onSongSubmitted);
      this.hubService.offEvent('AllSubmissionsReceived', onAllSubmissionsReceived);
    });
  }

  /**
   * Invokes the SubmitSong hub method with the trimmed URL from the input.
   * Shows an inline error if the call fails.
   */
  protected async onSubmitSong(): Promise<void> {
    this.errorMessage.set(undefined);
    this.isSubmitting.set(true);

    try {
      await this.hubService.submitSong(this.submissionUrl().trim());
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to submit song. Please try again.',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * Invokes the LeaveJam hub method.
   * On success, emits {@link left} so the parent can reset shared Jam state.
   * On failure, shows an inline error message.
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

