import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * Renders the Jam code as a prominent hero card with a one-click copy button.
 *
 * @remarks
 * Self-contained: owns the copy-to-clipboard logic and the `copied` feedback state.
 * No external dependencies — safe to import in any feature component.
 */
@Component({
  selector: 'app-jam-code-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="jam-code-section">
      <div class="jam-created__container">
        <p class="jam-label">Your Jam code</p>
        <p class="jam-code">{{ jamCode() }}</p>
        <p class="jam-hint">Share this code with your friends so they can join.</p>
      </div>
      <button
        type="button"
        class="btn btn--ghost copy-button"
        (click)="onCopy()"
      >
        {{ copied() ? 'Copied!' : 'Copy Jam code' }}
      </button>
    </div>
  `,
  styleUrl: './jam-code-hero.component.scss',
})
export class JamCodeHeroComponent {
  /** The Jam invite code to display and copy. */
  readonly jamCode = input.required<string>();

  /** `true` for 2 seconds after a successful clipboard write, to show "Copied!" feedback. */
  protected readonly copied = signal<boolean>(false);

  /**
   * Writes the Jam code to the clipboard and shows brief "Copied!" feedback.
   * Fails silently if the Clipboard API is unavailable (e.g., HTTP context or denied permission).
   */
  protected async onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.jamCode());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Intentional no-op — user can still select and copy the code manually.
    }
  }
}

