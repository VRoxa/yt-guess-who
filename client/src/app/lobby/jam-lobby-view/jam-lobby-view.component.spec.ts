import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { JamLobbyViewComponent } from './jam-lobby-view.component';
import { HubConnectionService } from '../../core/hub-connection.service';
import type { Player } from '../../core/models/player.model';

const alice: Player = { playerId: 'conn-host', displayName: 'Alice', isHost: true };
const bob: Player = { playerId: 'conn-bob', displayName: 'Bob', isHost: false };

function createMockHubService(
  advancePhaseImpl?: () => Promise<void>,
  leaveJamImpl?: () => Promise<void>,
) {
  return {
    advancePhase: vi.fn(advancePhaseImpl ?? (() => Promise.resolve())),
    leaveJam: vi.fn(leaveJamImpl ?? (() => Promise.resolve())),
  };
}

async function renderComponent(
  mockService: ReturnType<typeof createMockHubService>,
  options: { jamCode?: string; players?: Player[]; isHost?: boolean } = {},
) {
  return render(JamLobbyViewComponent, {
    providers: [{ provide: HubConnectionService, useValue: mockService }],
    componentInputs: {
      jamCode: options.jamCode ?? 'ABCDEF',
      players: options.players ?? [alice],
      isHost: options.isHost ?? false,
    },
  });
}

describe('JamLobbyViewComponent', () => {

  // ── Initial render ─────────────────────────────────────────

  it('renders the Jam code hero', async () => {
    // Arrange & Act
    await renderComponent(createMockHubService(), { jamCode: 'WXPGRT' });

    // Assert
    expect(screen.getByText('WXPGRT')).toBeTruthy();
  });

  it('renders the player list', async () => {
    // Arrange & Act
    await renderComponent(createMockHubService(), { players: [alice, bob] });

    // Assert
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows a Leave Jam button', async () => {
    // Arrange & Act
    await renderComponent(createMockHubService());

    // Assert
    expect(screen.getByRole('button', { name: /leave jam/i })).toBeTruthy();
  });

  // ── Start Submissions button ───────────────────────────────

  it('shows the Start Submissions button when isHost is true', async () => {
    // Arrange & Act
    await renderComponent(createMockHubService(), { isHost: true });

    // Assert
    expect(screen.getByRole('button', { name: /start submissions/i })).toBeTruthy();
  });

  it('does not show the Start Submissions button when isHost is false', async () => {
    // Arrange & Act
    await renderComponent(createMockHubService(), { isHost: false });

    // Assert
    expect(screen.queryByRole('button', { name: /start submissions/i })).toBeNull();
  });

  it('calls advancePhase on the hub service when Start Submissions is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService();
    await renderComponent(mockService, { isHost: true });

    // Act
    await user.click(screen.getByRole('button', { name: /start submissions/i }));

    // Assert
    expect(mockService.advancePhase).toHaveBeenCalledOnce();
  });

  it('disables the Start Submissions button while the request is in-flight', async () => {
    // Arrange
    let resolveAdvance!: () => void;
    const pendingPromise = new Promise<void>(resolve => { resolveAdvance = resolve; });
    const mockService = createMockHubService(() => pendingPromise);
    const user = userEvent.setup();
    await renderComponent(mockService, { isHost: true });

    // Act — do not await
    const clickPromise = user.click(screen.getByRole('button', { name: /start submissions/i }));

    // Assert
    const button = screen.getByRole('button', { name: /starting…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveAdvance();
    await clickPromise;
  });

  it('shows an error message when advancePhase rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(
      () => Promise.reject(new Error('UNAUTHORIZED')),
    );
    await renderComponent(mockService, { isHost: true });

    // Act
    await user.click(screen.getByRole('button', { name: /start submissions/i }));

    // Assert
    expect(screen.getByText('UNAUTHORIZED')).toBeTruthy();
  });

  // ── Leave Jam ──────────────────────────────────────────────

  it('calls leaveJam on the hub service when Leave Jam is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService();
    await renderComponent(mockService);

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
    await renderComponent(mockService);

    // Act — do not await
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
    const { fixture } = await renderComponent(mockService);
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
    await renderComponent(mockService);

    // Act
    await user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert
    expect(screen.getByText('NOT_IN_JAM')).toBeTruthy();
  });
});

