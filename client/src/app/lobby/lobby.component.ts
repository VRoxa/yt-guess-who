import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { HubConnectionService } from '../core/hub-connection.service';
import { PreJoinFormComponent, type JoinedEvent } from './pre-join-form/pre-join-form.component';
import { JamLobbyViewComponent } from './jam-lobby-view/jam-lobby-view.component';
import { SubmissionComponent } from '../submission/submission.component';
import type { Player } from '../core/models/player.model';

/**
 * Lobby screen root component.
 *
 * @remarks
 * Thin coordinator responsible for:
 * - Maintaining shared Jam state (jamCode, players, myPlayerId, isHost, currentPhase).
 * - Routing between the three view sub-components based on that state.
 * - Keeping shared state in sync with server-sent hub events
 *   (PlayerJoined, PlayerLeft, HostChanged, PhaseChanged).
 *
 * All form logic, loading states, and error messages are owned by the
 * sub-components ({@link PreJoinFormComponent}, {@link JamLobbyViewComponent},
 * {@link SubmissionComponent}).
 *
 * Design spec: `docs/design/components/lobby.md`
 */
@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [PreJoinFormComponent, JamLobbyViewComponent, SubmissionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (jamCode() === null) {
      <app-pre-join-form (joined)="onJoined($event)" />
    } @else if (currentPhase() === 'Submission') {
      <app-submission
        [jamCode]="jamCode()!"
        [players]="players()"
        [myPlayerId]="myPlayerId()"
        (left)="onLeft()"
      />
    } @else {
      <app-jam-lobby-view
        [jamCode]="jamCode()!"
        [players]="players()"
        [isHost]="isHost()"
        (left)="onLeft()"
      />
    }
  `,
  styleUrl: './lobby.component.scss',
})
export class LobbyComponent {
  private readonly hubService = inject(HubConnectionService);

  // ── Shared Jam state ─────────────────────────────────────────
  protected readonly jamCode = signal<string | null>(null);
  protected readonly players = signal<ReadonlyArray<Player>>([]);
  protected readonly myPlayerId = signal<string | null>(null);
  protected readonly isHost = signal<boolean>(false);
  protected readonly currentPhase = signal<string>('Lobby');

  constructor() {
    this.hubService.onPlayerJoined(player => {
      this.players.update(list => [...list, player]);
    });

    this.hubService.onPlayerLeft(payload => {
      this.players.update(list => list.filter(p => p.playerId !== payload.playerId));
    });

    this.hubService.onHostChanged(payload => {
      this.players.update(list =>
        list.map(p => ({ ...p, isHost: p.playerId === payload.newHostPlayerId })),
      );
      this.isHost.set(payload.newHostPlayerId === this.myPlayerId());
    });

    this.hubService.onPhaseChanged(payload => {
      this.currentPhase.set(payload.newPhase);
    });
  }

  /**
   * Called when {@link PreJoinFormComponent} emits its `joined` output after
   * a successful `CreateJam` or `JoinJam` hub call. Initialises shared Jam state.
   */
  protected onJoined(event: unknown): void {
    // reason: output<JoinedEvent>() only ever emits JoinedEvent; Angular's strict template
    // compiler infers $event as DOM Event for typed output() — the cast is always safe here.
    const joined = event as JoinedEvent;
    // Do NOT reset players here. The server sends a full PlayerJoined snapshot to the caller
    // during hub method execution — those events populate the list before this callback fires.
    // Resetting here would wipe the already-received snapshot. The list is guaranteed empty
    // at this point because resetJamState() zeroes it out on every leave.
    this.jamCode.set(joined.jamCode);
    this.myPlayerId.set(joined.myPlayerId);
    this.isHost.set(joined.isHost);
  }

  /**
   * Called when {@link JamLobbyViewComponent} or {@link SubmissionComponent}
   * emits its `left` output after a successful `LeaveJam` hub call.
   * Resets all shared Jam state so the pre-join form is shown again.
   */
  protected onLeft(): void {
    this.resetJamState();
  }

  private resetJamState(): void {
    this.jamCode.set(null);
    this.players.set([]);
    this.myPlayerId.set(null);
    this.isHost.set(false);
    this.currentPhase.set('Lobby');
  }
}
