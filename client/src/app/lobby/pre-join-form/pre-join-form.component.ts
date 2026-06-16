import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { HubConnectionService } from '../../core/hub-connection.service';

/**
 * Payload emitted when the player successfully creates or joins a Jam.
 */
export interface JoinedEvent {
  readonly jamCode: string;
  readonly myPlayerId: string;
  readonly isHost: boolean;
}

/**
 * Pre-join form component.
 *
 * @remarks
 * Owns the entire "get into a Jam" user journey: entering a display name,
 * choosing to create or join, entering a Jam code, and handling in-flight
 * and error states. When a Jam is successfully created or joined, emits
 * {@link joined} so the parent can transition to the in-jam view.
 *
 * Design spec: `docs/design/components/lobby.md §2 — Getting into a Jam`
 */
@Component({
  selector: 'app-pre-join-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lobby-container">

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
  `,
  styleUrl: './pre-join-form.component.scss',
})
export class PreJoinFormComponent {
  protected readonly hubService = inject(HubConnectionService);

  private readonly jamCodeInput = viewChild<ElementRef<HTMLInputElement>>('jamCodeInput');

  protected readonly displayName = signal<string>('');
  protected readonly enteredJamCode = signal<string>('');
  protected readonly isCreating = signal<boolean>(false);
  protected readonly isJoining = signal<boolean>(false);
  protected readonly showJoinInput = signal<boolean>(false);
  protected readonly errorMessage = signal<string | undefined>(undefined);

  protected readonly showActionStep = computed(
    () => this.displayName().trim().length > 0 && !this.showJoinInput(),
  );

  /** Emitted after the player successfully creates or joins a Jam. */
  readonly joined = output<JoinedEvent>();

  constructor() {
    effect(() => {
      if (this.showJoinInput()) {
        setTimeout(() => this.jamCodeInput()?.nativeElement.focus(), 0);
      }
    });
  }

  protected onShowJoinStep(): void {
    this.errorMessage.set(undefined);
    this.showJoinInput.set(true);
  }

  protected onBack(): void {
    this.showJoinInput.set(false);
    this.enteredJamCode.set('');
    this.errorMessage.set(undefined);
  }

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
      // reason: getConnectionId() is non-null after a successful createJam() call — the connection
      // must be active for the hub method to have resolved.
      const myPlayerId = this.hubService.getConnectionId()!;
      this.joined.emit({ jamCode: code, myPlayerId, isHost: true });
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to create Jam. Please try again.',
      );
    } finally {
      this.isCreating.set(false);
    }
  }

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
      // reason: getConnectionId() is non-null after a successful joinJam() call — the connection
      // must be active for the hub method to have resolved.
      const myPlayerId = this.hubService.getConnectionId()!;
      this.joined.emit({ jamCode: code, myPlayerId, isHost: false });
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Failed to join Jam. Please try again.',
      );
    } finally {
      this.isJoining.set(false);
    }
  }
}

