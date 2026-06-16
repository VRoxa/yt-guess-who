import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { Player } from '../../core/models/player.model';

/**
 * Renders an ordered list of {@link Player} objects.
 *
 * @remarks
 * Supports two display modes controlled by the optional {@link submittedPlayerIds} input:
 *
 * - **Lobby mode** (`submittedPlayerIds` is `null`, the default): shows a `Host` badge
 *   next to the player who holds the Host role.
 * - **Submission mode** (`submittedPlayerIds` is a `Set<string>`): shows a ✓ indicator
 *   for players who have submitted and a `…` indicator for those still pending.
 *
 * Renders nothing when {@link players} is empty.
 */
@Component({
  selector: 'app-player-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (players().length > 0) {
      <ul
        class="player-list"
        [attr.aria-label]="submittedPlayerIds() !== null ? 'Submission progress' : 'Players in this Jam'"
        aria-live="polite"
      >
        @for (player of players(); track player.playerId) {
          @if (submittedPlayerIds() !== null) {
            <li
              class="player-list__item"
              [class.player-list__item--submitted]="submittedPlayerIds()!.has(player.playerId)"
            >
              <span class="player-list__name">{{ player.displayName }}</span>
              <span class="player-list__status" aria-hidden="true">
                {{ submittedPlayerIds()!.has(player.playerId) ? '✓' : '…' }}
              </span>
            </li>
          } @else {
            <li class="player-list__item" [class.player-list__item--host]="player.isHost">
              <span class="player-list__name">{{ player.displayName }}</span>
              @if (player.isHost) {
                <span class="player-list__host-badge">Host</span>
              }
            </li>
          }
        }
      </ul>
    }
  `,
  styleUrl: './player-list.component.scss',
})
export class PlayerListComponent {
  /** The ordered list of players to display. */
  readonly players = input.required<ReadonlyArray<Player>>();

  /**
   * When `null` (default), the component renders in Lobby mode (host badge visible).
   * When a `Set<string>` is provided, the component renders in Submission mode
   * (✓ / … indicator per player based on whether their `playerId` is in the set).
   */
  readonly submittedPlayerIds = input<ReadonlySet<string> | null>(null);
}

