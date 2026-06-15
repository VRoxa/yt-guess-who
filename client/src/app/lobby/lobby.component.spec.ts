import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { LobbyComponent } from './lobby.component';
import { HubConnectionService } from '../core/hub-connection.service';
import type { Player } from '../core/models/player.model';
import type { HostChangedEvent } from '../core/models/host-changed.model';

/**
 * Creates a minimal mock of {@link HubConnectionService}.
 * Returns trigger helpers to simulate server events from tests.
 */
function createMockHubService(
  isConnected = false,
  createJamImpl?: () => Promise<string>,
  joinJamImpl?: () => Promise<void>,
  leaveJamImpl?: () => Promise<void>,
) {
  let _playerJoinedHandler: ((player: Player) => void) | undefined;
  let _playerLeftHandler: ((payload: { playerId: string }) => void) | undefined;
  let _hostChangedHandler: ((payload: HostChangedEvent) => void) | undefined;

  const onPlayerJoined = vi.fn((handler: (player: Player) => void) => {
    _playerJoinedHandler = handler;
  });

  const onPlayerLeft = vi.fn((handler: (payload: { playerId: string }) => void) => {
    _playerLeftHandler = handler;
  });

  const onHostChanged = vi.fn((handler: (payload: HostChangedEvent) => void) => {
    _hostChangedHandler = handler;
  });

  const triggerPlayerJoined = (player: Player): void => { _playerJoinedHandler?.(player); };
  const triggerPlayerLeft = (payload: { playerId: string }): void => { _playerLeftHandler?.(payload); };
  const triggerHostChanged = (payload: HostChangedEvent): void => { _hostChangedHandler?.(payload); };

  return {
    isConnected: signal(isConnected),
    isTransitioning: signal(false),
    errorMessage: signal<string | undefined>(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    createJam: vi.fn(createJamImpl ?? (() => Promise.resolve('ABCDEF'))),
    joinJam: vi.fn(joinJamImpl ?? (() => Promise.resolve())),
    leaveJam: vi.fn(leaveJamImpl ?? (() => Promise.resolve())),
    onPlayerJoined,
    onPlayerLeft,
    onHostChanged,
    triggerPlayerJoined,
    triggerPlayerLeft,
    triggerHostChanged,
  };
}

// Helpers for navigating to the join step
async function typeNameAndOpenJoinStep(user: ReturnType<typeof userEvent.setup>, name = 'Alice') {
  await user.type(screen.getByLabelText(/your name/i), name);
  await user.click(screen.getByRole('button', { name: /join a jam/i }));
}

describe('LobbyComponent', () => {

  // ── Progressive disclosure ─────────────────────────────────

  it('shows only the name input on initial render', async () => {
    // Arrange & Act
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Assert
    expect(screen.getByLabelText(/your name/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /create a jam/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /join a jam/i })).toBeNull();
  });

  it('shows Create a Jam and Join a Jam buttons after a name is entered', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Act
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Assert
    expect(screen.getByRole('button', { name: /create a jam/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /join a jam/i })).toBeTruthy();
  });

  it('does not show the action buttons when the name is whitespace only', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Act
    await user.type(screen.getByLabelText(/your name/i), '   ');

    // Assert
    expect(screen.queryByRole('button', { name: /create a jam/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /join a jam/i })).toBeNull();
  });

  it('shows the Jam code input and Join button when Join a Jam is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Act
    await typeNameAndOpenJoinStep(user);

    // Assert
    expect(screen.getByLabelText(/jam code/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^join$/i })).toBeTruthy();
  });

  it('hides the action buttons when the join step is open', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Act
    await typeNameAndOpenJoinStep(user);

    // Assert
    expect(screen.queryByRole('button', { name: /create a jam/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /join a jam/i })).toBeNull();
  });

  it('shows a Back button in the join step', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Act
    await typeNameAndOpenJoinStep(user);

    // Assert
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy();
  });

  it('returns to the action buttons when Back is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await typeNameAndOpenJoinStep(user);

    // Act
    await user.click(screen.getByRole('button', { name: /back/i }));

    // Assert
    expect(screen.getByRole('button', { name: /create a jam/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /join a jam/i })).toBeTruthy();
    expect(screen.queryByLabelText(/jam code/i)).toBeNull();
  });

  it('clears the Jam code input when Back is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await typeNameAndOpenJoinStep(user);
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Act — go back and re-enter the join step
    await user.click(screen.getByRole('button', { name: /back/i }));
    await user.click(screen.getByRole('button', { name: /join a jam/i }));

    // Assert — input is empty on re-entry
    expect((screen.getByLabelText(/jam code/i) as HTMLInputElement).value).toBe('');
  });

  // ── Create Jam flow ────────────────────────────────────────

  it('calls createJam with the trimmed display name when Create a Jam is clicked while connected', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), '  Alice  ');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(mockService.connect).not.toHaveBeenCalled();
    expect(mockService.createJam).toHaveBeenCalledOnce();
    expect(mockService.createJam).toHaveBeenCalledWith('Alice');
  });

  it('connects first then creates the Jam when Create a Jam is clicked while disconnected', async () => {
    // Arrange
    const user = userEvent.setup();
    const isConnected = signal(false);
    const mockService = {
      isConnected,
      isTransitioning: signal(false),
      errorMessage: signal<string | undefined>(undefined),
      connect: vi.fn().mockImplementation(() => {
        isConnected.set(true);
        return Promise.resolve();
      }),
      createJam: vi.fn().mockResolvedValue('ABCDEF'),
      joinJam: vi.fn().mockResolvedValue(undefined),
      leaveJam: vi.fn().mockResolvedValue(undefined),
      onPlayerJoined: vi.fn(),
      onPlayerLeft: vi.fn(),
      onHostChanged: vi.fn(),
    };
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(mockService.connect).toHaveBeenCalledOnce();
    expect(mockService.createJam).toHaveBeenCalledWith('Alice');
  });

  it('shows a connection error and does not call createJam when connect fails', async () => {
    // Arrange
    const user = userEvent.setup();
    const errorMessage = signal<string | undefined>(undefined);
    const mockService = {
      isConnected: signal(false),
      isTransitioning: signal(false),
      errorMessage,
      connect: vi.fn().mockImplementation(() => {
        errorMessage.set('Connection refused');
        return Promise.resolve();
      }),
      createJam: vi.fn(),
      joinJam: vi.fn(),
      leaveJam: vi.fn(),
      onPlayerJoined: vi.fn(),
      onPlayerLeft: vi.fn(),
      onHostChanged: vi.fn(),
    };
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(mockService.createJam).not.toHaveBeenCalled();
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('shows a hub service error on render when auto-connect has already failed', async () => {
    // Arrange — simulate the service arriving with a pre-existing error
    const mockService = createMockHubService(false);
    mockService.errorMessage.set('Failed to reach server');

    // Act
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });

    // Assert
    expect(screen.getByText('Failed to reach server')).toBeTruthy();
  });

  it('disables the Create a Jam button while the request is in-flight', async () => {
    // Arrange
    let resolveCreate!: (code: string) => void;
    const pendingPromise = new Promise<string>(resolve => { resolveCreate = resolve; });
    const mockService = createMockHubService(true, () => pendingPromise);
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act — start the click but do not await it
    const clickPromise = user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert — button label and disabled state while in-flight
    const button = screen.getByRole('button', { name: /creating…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveCreate('ABCDEF');
    await clickPromise;
  });

  it('renders the Jam code prominently after a successful create', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true, () => Promise.resolve('WXPGRT'));
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(screen.getByText('WXPGRT')).toBeTruthy();
  });

  it('hides the pre-join form after a successful create', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true, () => Promise.resolve('WXPGRT'));
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(screen.queryByRole('button', { name: /create a jam/i })).toBeNull();
  });

  it('renders an error message when createJam rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true, () =>
      Promise.reject(new Error('Server unavailable')),
    );
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(screen.getByText('Server unavailable')).toBeTruthy();
  });

  // ── Join Jam flow ──────────────────────────────────────────

  it('disables the Join button when the Jam code is empty', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');

    // Assert — no code entered yet
    const button = screen.getByRole('button', { name: /^join$/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('disables the Join button when the Jam code is whitespace only', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');

    // Act
    await user.type(screen.getByLabelText(/jam code/i), '   ');

    // Assert
    const button = screen.getByRole('button', { name: /^join$/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables the Join button when the Jam code is non-empty', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');

    // Act
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Assert
    const button = screen.getByRole('button', { name: /^join$/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('calls joinJam with the trimmed code and display name when Join is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, '  Bob  ');

    // Act
    await user.type(screen.getByLabelText(/jam code/i), '  ABCDEF  ');
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    expect(mockService.joinJam).toHaveBeenCalledOnce();
    expect(mockService.joinJam).toHaveBeenCalledWith('ABCDEF', 'Bob');
  });

  it('disables the Join button while the request is in-flight', async () => {
    // Arrange
    let resolveJoin!: () => void;
    const pendingPromise = new Promise<void>(resolve => { resolveJoin = resolve; });
    const mockService = createMockHubService(true, undefined, () => pendingPromise);
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Act — start the click but do not await it
    const clickPromise = user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert — button label and disabled state while in-flight
    const button = screen.getByRole('button', { name: /joining…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveJoin();
    await clickPromise;
  });

  it('renders the Jam code prominently after a successful join', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'WXPGRT');

    // Act
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    expect(screen.getByText('WXPGRT')).toBeTruthy();
  });

  it('hides the pre-join form after a successful join', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'WXPGRT');

    // Act
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    expect(screen.queryByRole('button', { name: /join a jam/i })).toBeNull();
  });

  it('renders an error message when joinJam rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true, undefined, () =>
      Promise.reject(new Error('JAM_NOT_FOUND')),
    );
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'ZZZZZZ');

    // Act
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    expect(screen.getByText('JAM_NOT_FOUND')).toBeTruthy();
  });

  // ── In-jam phase: Copy button ──────────────────────────────

  it('shows a Copy Jam code button after entering a Jam', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(screen.getByRole('button', { name: /copy jam code/i })).toBeTruthy();
  });

  it('changes the copy button label to Copied! after a successful clipboard write', async () => {
    // Arrange — mock the Clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const user = userEvent.setup();
    const mockService = createMockHubService(true, () => Promise.resolve('ABCDEF'));
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act
    await user.click(screen.getByRole('button', { name: /copy jam code/i }));

    // Assert — label changes to "Copied!" after the async clipboard write
    expect(await screen.findByRole('button', { name: /copied!/i })).toBeTruthy();
  });

  // ── In-jam phase: Waiting indicator ───────────────────────

  it('shows the waiting message after entering a Jam', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(screen.getByText(/waiting for other players to join/i)).toBeTruthy();
  });

  it('does not show the player list before entering a Jam', async () => {
    // Arrange & Act
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Assert
    expect(screen.queryByRole('list', { name: /players in this jam/i })).toBeNull();
  });

  // ── Player list ────────────────────────────────────────────

  it('appends a player to the list when a PlayerJoined event arrives', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act
    mockService.triggerPlayerJoined({ playerId: 'conn-1', displayName: 'Alice', isHost: true });

    // Assert
    expect(await screen.findByText('Alice')).toBeTruthy();
  });

  it('appends multiple players in order when several PlayerJoined events arrive', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act
    mockService.triggerPlayerJoined({ playerId: 'conn-1', displayName: 'Alice', isHost: true });
    mockService.triggerPlayerJoined({ playerId: 'conn-2', displayName: 'Bob', isHost: false });

    // Assert
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Alice');
    expect(items[1].textContent).toContain('Bob');
  });

  it('shows the Host badge only for the host entry', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act
    mockService.triggerPlayerJoined({ playerId: 'conn-1', displayName: 'Alice', isHost: true });
    mockService.triggerPlayerJoined({ playerId: 'conn-2', displayName: 'Bob', isHost: false });

    // Assert — exactly one badge
    const hostBadges = await screen.findAllByText('Host');
    expect(hostBadges).toHaveLength(1);
  });

  it('shows the full player list after joining a Jam', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Act — server sends the full snapshot to the joiner
    mockService.triggerPlayerJoined({ playerId: 'conn-host', displayName: 'Alice', isHost: true });
    mockService.triggerPlayerJoined({ playerId: 'conn-bob', displayName: 'Bob', isHost: false });

    // Assert
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Alice');
    expect(items[1].textContent).toContain('Bob');
  });

  // ── Leave Jam flow ─────────────────────────────────────────

  it('shows a Leave Jam button when the player is in a Jam', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(screen.getByRole('button', { name: /leave jam/i })).toBeTruthy();
  });

  it('does not show the Leave Jam button on the pre-join form', async () => {
    // Arrange & Act
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Assert
    expect(screen.queryByRole('button', { name: /leave jam/i })).toBeNull();
  });

  it('disables the Leave Jam button while the request is in-flight', async () => {
    // Arrange
    let resolveLeave!: () => void;
    const pendingPromise = new Promise<void>(resolve => { resolveLeave = resolve; });
    const mockService = createMockHubService(true, undefined, undefined, () => pendingPromise);
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act — start click but do not await
    const clickPromise = user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert — button is disabled and label changes while in-flight
    const button = screen.getByRole('button', { name: /leaving…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveLeave();
    await clickPromise;
  });

  it('calls leaveJam on the hub service when Leave Jam is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act
    await user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert
    expect(mockService.leaveJam).toHaveBeenCalledOnce();
  });

  it('resets to the pre-join form after a successful leave', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act
    await user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert — pre-join form is visible, jam view is gone
    expect(screen.getByLabelText(/your name/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /leave jam/i })).toBeNull();
  });

  it('shows an error message when leaveJam rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(
      true,
      undefined,
      undefined,
      () => Promise.reject(new Error('NOT_IN_JAM')),
    );
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Act
    await user.click(screen.getByRole('button', { name: /leave jam/i }));

    // Assert
    expect(screen.getByText('NOT_IN_JAM')).toBeTruthy();
  });

  // ── PlayerLeft event ───────────────────────────────────────

  it('removes a player from the list when a PlayerLeft event arrives', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));
    mockService.triggerPlayerJoined({ playerId: 'conn-1', displayName: 'Alice', isHost: true });
    mockService.triggerPlayerJoined({ playerId: 'conn-2', displayName: 'Bob', isHost: false });
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);

    // Act
    mockService.triggerPlayerLeft({ playerId: 'conn-2' });

    // Assert
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain('Alice');
    expect(items[0].textContent).not.toContain('Bob');
  });

  // ── HostChanged event ──────────────────────────────────────

  it('updates the host indicator when a HostChanged event arrives', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));
    mockService.triggerPlayerJoined({ playerId: 'conn-1', displayName: 'Alice', isHost: true });
    mockService.triggerPlayerJoined({ playerId: 'conn-2', displayName: 'Bob', isHost: false });
    expect(await screen.findAllByText('Host')).toHaveLength(1);

    // Act — Alice leaves, Bob becomes host
    mockService.triggerPlayerLeft({ playerId: 'conn-1' });
    mockService.triggerHostChanged({ newHostPlayerId: 'conn-2' });

    // Assert — exactly one Host badge remains and it belongs to Bob
    const hostBadges = await screen.findAllByText('Host');
    expect(hostBadges).toHaveLength(1);
    const bobItem = screen.getByText('Bob').closest('li');
    expect(bobItem?.textContent).toContain('Host');
  });

  it('sets isHost to false for all other players when HostChanged arrives', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');
    await user.click(screen.getByRole('button', { name: /create a jam/i }));
    mockService.triggerPlayerJoined({ playerId: 'conn-1', displayName: 'Alice', isHost: true });
    mockService.triggerPlayerJoined({ playerId: 'conn-2', displayName: 'Bob', isHost: false });
    mockService.triggerPlayerJoined({ playerId: 'conn-3', displayName: 'Carol', isHost: false });

    // Act
    mockService.triggerHostChanged({ newHostPlayerId: 'conn-2' });

    // Assert — only Bob carries the Host badge
    const hostBadges = await screen.findAllByText('Host');
    expect(hostBadges).toHaveLength(1);
    const bobItem = screen.getByText('Bob').closest('li');
    expect(bobItem?.textContent).toContain('Host');
  });
});

