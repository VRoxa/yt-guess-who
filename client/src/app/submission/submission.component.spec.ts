import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SubmissionComponent } from './submission.component';
import { HubConnectionService } from '../core/hub-connection.service';
import type { Player } from '../core/models/player.model';

const alice: Player = { playerId: 'conn-host', displayName: 'Alice', isHost: true };
const bob: Player = { playerId: 'conn-bob', displayName: 'Bob', isHost: false };

function createMockHubService(
  submitSongImpl?: () => Promise<void>,
  leaveJamImpl?: () => Promise<void>,
) {
  let _songSubmittedHandler: ((payload: { playerId: string }) => void) | undefined;
  let _allSubmissionsReceivedHandler: (() => void) | undefined;

  return {
    submitSong: vi.fn(submitSongImpl ?? (() => Promise.resolve())),
    leaveJam: vi.fn(leaveJamImpl ?? (() => Promise.resolve())),
    onSongSubmitted: vi.fn((h: (payload: { playerId: string }) => void) => { _songSubmittedHandler = h; }),
    onAllSubmissionsReceived: vi.fn((h: () => void) => { _allSubmissionsReceivedHandler = h; }),
    offEvent: vi.fn(),
    triggerSongSubmitted: (p: { playerId: string }): void => { _songSubmittedHandler?.(p); },
    triggerAllSubmissionsReceived: (): void => { _allSubmissionsReceivedHandler?.(); },
  };
}

async function renderInSubmissionPhase(
  mockService: ReturnType<typeof createMockHubService>,
  players: Player[] = [alice, bob],
  myPlayerId = 'conn-host',
) {
  return render(SubmissionComponent, {
    providers: [{ provide: HubConnectionService, useValue: mockService }],
    componentInputs: { jamCode: 'ABCDEF', players, myPlayerId },
  });
}

describe('SubmissionComponent', () => {

  // ── Initial render ─────────────────────────────────────────

  it('renders the Jam code hero', async () => {
    // Arrange & Act
    await renderInSubmissionPhase(createMockHubService());

    // Assert
    expect(screen.getByText('ABCDEF')).toBeTruthy();
  });

  it('shows the YouTube URL input and Submit button initially', async () => {
    // Arrange & Act
    await renderInSubmissionPhase(createMockHubService());

    // Assert
    expect(screen.getByLabelText(/your youtube url/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^submit$/i })).toBeTruthy();
  });

  it('shows the Leave Jam button', async () => {
    // Arrange & Act
    await renderInSubmissionPhase(createMockHubService());

    // Assert
    expect(screen.getByRole('button', { name: /leave jam/i })).toBeTruthy();
  });

  it('renders a player list with all players', async () => {
    // Arrange & Act
    await renderInSubmissionPhase(createMockHubService());

    // Assert
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  // ── Submit button state ────────────────────────────────────

  it('disables the Submit button when the URL input is empty', async () => {
    // Arrange & Act
    await renderInSubmissionPhase(createMockHubService());

    // Assert
    const button = screen.getByRole('button', { name: /^submit$/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables the Submit button when a URL is entered', async () => {
    // Arrange
    const user = userEvent.setup();
    await renderInSubmissionPhase(createMockHubService());

    // Act
    await user.type(screen.getByLabelText(/your youtube url/i), 'https://youtu.be/abc');

    // Assert
    const button = screen.getByRole('button', { name: /^submit$/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('calls submitSong with the trimmed URL when Submit is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService();
    await renderInSubmissionPhase(mockService);
    await user.type(screen.getByLabelText(/your youtube url/i), '  https://youtu.be/abc  ');

    // Act
    await user.click(screen.getByRole('button', { name: /^submit$/i }));

    // Assert
    expect(mockService.submitSong).toHaveBeenCalledOnce();
    expect(mockService.submitSong).toHaveBeenCalledWith('https://youtu.be/abc');
  });

  it('disables the Submit button while the request is in-flight', async () => {
    // Arrange
    let resolveSubmit!: () => void;
    const pendingPromise = new Promise<void>(resolve => { resolveSubmit = resolve; });
    const mockService = createMockHubService(() => pendingPromise);
    const user = userEvent.setup();
    await renderInSubmissionPhase(mockService);
    await user.type(screen.getByLabelText(/your youtube url/i), 'https://youtu.be/abc');

    // Act — start click but do not await
    const clickPromise = user.click(screen.getByRole('button', { name: /^submit$/i }));

    // Assert
    const button = screen.getByRole('button', { name: /submitting…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveSubmit();
    await clickPromise;
  });

  it('shows an error message when submitSong rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(
      () => Promise.reject(new Error('INVALID_YOUTUBE_URL')),
    );
    await renderInSubmissionPhase(mockService);
    await user.type(screen.getByLabelText(/your youtube url/i), 'https://www.google.com');

    // Act
    await user.click(screen.getByRole('button', { name: /^submit$/i }));

    // Assert
    expect(screen.getByText('INVALID_YOUTUBE_URL')).toBeTruthy();
  });

  // ── SongSubmitted event ────────────────────────────────────

  it('marks a player as submitted when a SongSubmitted event arrives', async () => {
    // Arrange
    const mockService = createMockHubService();
    await renderInSubmissionPhase(mockService);
    expect(screen.getByText('Bob').closest('li')?.textContent).toContain('…');

    // Act
    mockService.triggerSongSubmitted({ playerId: 'conn-bob' });

    // Assert
    expect(await screen.findByText('Bob').then(el => el.closest('li')?.textContent)).toContain('✓');
  });

  it('hides the URL input and shows confirmation when the current player submits', async () => {
    // Arrange
    const mockService = createMockHubService();
    await renderInSubmissionPhase(mockService);

    // Act — server confirms Alice (myPlayerId = 'conn-host') has submitted
    mockService.triggerSongSubmitted({ playerId: 'conn-host' });

    // Assert
    expect(await screen.findByText(/you have submitted your song/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^submit$/i })).toBeNull();
  });

  // ── AllSubmissionsReceived event ───────────────────────────

  it('shows the all-submitted message when AllSubmissionsReceived fires', async () => {
    // Arrange
    const mockService = createMockHubService();
    await renderInSubmissionPhase(mockService);

    // Act
    mockService.triggerAllSubmissionsReceived();

    // Assert
    expect(await screen.findByText(/all songs are in/i)).toBeTruthy();
  });

  it('hides the URL input and Submit button after AllSubmissionsReceived', async () => {
    // Arrange
    const mockService = createMockHubService();
    await renderInSubmissionPhase(mockService);

    // Act
    mockService.triggerAllSubmissionsReceived();

    // Assert
    await screen.findByText(/all songs are in/i);
    expect(screen.queryByLabelText(/your youtube url/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^submit$/i })).toBeNull();
  });

  // ── Leave Jam ──────────────────────────────────────────────

  it('calls leaveJam on the hub service when Leave Jam is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService();
    await renderInSubmissionPhase(mockService);

    // Act
    await user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert
    expect(mockService.leaveJam).toHaveBeenCalledOnce();
  });

  it('disables the Leave Jam button while the request is in-flight', async () => {
    // Arrange
    let resolveLeave!: () => void;
    const pendingPromise = new Promise<void>(resolve => { resolveLeave = resolve; });
    const mockService = createMockHubService(undefined, () => pendingPromise);
    const user = userEvent.setup();
    await renderInSubmissionPhase(mockService);

    // Act — start click but do not await
    const clickPromise = user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert
    const button = screen.getByRole('button', { name: /leaving…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveLeave();
    await clickPromise;
  });

  it('emits the left event after a successful leave', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService();
    const leftHandler = vi.fn();
    const { fixture } = await renderInSubmissionPhase(mockService);
    fixture.componentInstance.left.subscribe(leftHandler);

    // Act
    await user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert
    expect(leftHandler).toHaveBeenCalledOnce();
  });

  it('shows an error message when leaveJam rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(
      undefined,
      () => Promise.reject(new Error('NOT_IN_JAM')),
    );
    await renderInSubmissionPhase(mockService);

    // Act
    await user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert
    expect(screen.getByText('NOT_IN_JAM')).toBeTruthy();
  });

  it('registers onSongSubmitted and onAllSubmissionsReceived on creation', async () => {
    // Arrange & Act
    const mockService = createMockHubService();
    await renderInSubmissionPhase(mockService);

    // Assert
    expect(mockService.onSongSubmitted).toHaveBeenCalledOnce();
    expect(mockService.onAllSubmissionsReceived).toHaveBeenCalledOnce();
  });
});

