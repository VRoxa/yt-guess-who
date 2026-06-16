import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { PreJoinFormComponent, type JoinedEvent } from './pre-join-form.component';
import { HubConnectionService } from '../../core/hub-connection.service';

function createMockHubService(
  isConnected = false,
  createJamImpl?: () => Promise<string>,
  joinJamImpl?: () => Promise<void>,
) {
  return {
    isConnected: signal(isConnected),
    isTransitioning: signal(false),
    errorMessage: signal<string | undefined>(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    createJam: vi.fn(createJamImpl ?? (() => Promise.resolve('ABCDEF'))),
    joinJam: vi.fn(joinJamImpl ?? (() => Promise.resolve())),
    getConnectionId: vi.fn(() => 'conn-host'),
  };
}

async function typeNameAndOpenJoinStep(
  user: ReturnType<typeof userEvent.setup>,
  name = 'Alice',
): Promise<void> {
  await user.type(screen.getByLabelText(/your name/i), name);
  await user.click(screen.getByRole('button', { name: /join a jam/i }));
}

describe('PreJoinFormComponent', () => {

  // ── Initial render ─────────────────────────────────────────

  it('shows only the name input on initial render', async () => {
    // Arrange & Act
    await render(PreJoinFormComponent, {
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
    await render(PreJoinFormComponent, {
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
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Act
    await user.type(screen.getByLabelText(/your name/i), '   ');

    // Assert
    expect(screen.queryByRole('button', { name: /create a jam/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /join a jam/i })).toBeNull();
  });

  // ── Join step ──────────────────────────────────────────────

  it('shows the Jam code input and Join button when Join a Jam is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(PreJoinFormComponent, {
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
    await render(PreJoinFormComponent, {
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
    await render(PreJoinFormComponent, {
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
    await render(PreJoinFormComponent, {
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

  it('clears the Jam code input when Back is clicked and the step is re-entered', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await typeNameAndOpenJoinStep(user);
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Act
    await user.click(screen.getByRole('button', { name: /back/i }));
    await user.click(screen.getByRole('button', { name: /join a jam/i }));

    // Assert
    expect((screen.getByLabelText(/jam code/i) as HTMLInputElement).value).toBe('');
  });

  it('disables the Join button when the Jam code is empty', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await typeNameAndOpenJoinStep(user);

    // Assert — no code entered yet
    const button = screen.getByRole('button', { name: /^join$/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  // ── Create Jam flow ────────────────────────────────────────

  it('calls createJam with the trimmed display name when Create a Jam is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), '  Alice  ');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(mockService.createJam).toHaveBeenCalledOnce();
    expect(mockService.createJam).toHaveBeenCalledWith('Alice');
  });

  it('emits joined with isHost true, correct jamCode and myPlayerId after a successful create', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true, () => Promise.resolve('WXPGRT'));
    const joinedHandler = vi.fn();
    const { fixture } = await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    fixture.componentInstance.joined.subscribe(joinedHandler);
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(joinedHandler).toHaveBeenCalledOnce();
    const event: JoinedEvent = joinedHandler.mock.calls[0][0];
    expect(event.jamCode).toBe('WXPGRT');
    expect(event.isHost).toBe(true);
    expect(event.myPlayerId).toBe('conn-host');
  });

  it('disables the Create a Jam button while the request is in-flight', async () => {
    // Arrange
    let resolveCreate!: (code: string) => void;
    const pendingPromise = new Promise<string>(resolve => { resolveCreate = resolve; });
    const mockService = createMockHubService(true, () => pendingPromise);
    const user = userEvent.setup();
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act — do not await
    const clickPromise = user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    const button = screen.getByRole('button', { name: /creating…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveCreate('ABCDEF');
    await clickPromise;
  });

  it('shows an error message when createJam rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(
      true,
      () => Promise.reject(new Error('Server unavailable')),
    );
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create a jam/i }));

    // Assert
    expect(screen.getByText('Server unavailable')).toBeTruthy();
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
      getConnectionId: vi.fn(() => 'conn-host'),
    };
    await render(PreJoinFormComponent, {
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
      getConnectionId: vi.fn(() => null),
    };
    await render(PreJoinFormComponent, {
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
    // Arrange
    const mockService = createMockHubService(false);
    mockService.errorMessage.set('Failed to reach server');

    // Act
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });

    // Assert
    expect(screen.getByText('Failed to reach server')).toBeTruthy();
  });

  // ── Join Jam flow ──────────────────────────────────────────

  it('calls joinJam with the correct Jam code and trimmed display name', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, '  Bob  ');
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Act
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    expect(mockService.joinJam).toHaveBeenCalledOnce();
    expect(mockService.joinJam).toHaveBeenCalledWith('ABCDEF', 'Bob');
  });

  it('emits joined with isHost false and the correct jamCode after a successful join', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    const joinedHandler = vi.fn();
    const { fixture } = await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    fixture.componentInstance.joined.subscribe(joinedHandler);
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'WXPGRT');

    // Act
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    expect(joinedHandler).toHaveBeenCalledOnce();
    const event: JoinedEvent = joinedHandler.mock.calls[0][0];
    expect(event.jamCode).toBe('WXPGRT');
    expect(event.isHost).toBe(false);
  });

  it('disables the Join button while the request is in-flight', async () => {
    // Arrange
    let resolveJoin!: () => void;
    const pendingPromise = new Promise<void>(resolve => { resolveJoin = resolve; });
    const mockService = createMockHubService(true, undefined, () => pendingPromise);
    const user = userEvent.setup();
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Act — do not await
    const clickPromise = user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    const button = screen.getByRole('button', { name: /joining…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveJoin();
    await clickPromise;
  });

  it('shows an error message when joinJam rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(
      true,
      undefined,
      () => Promise.reject(new Error('JAM_NOT_FOUND')),
    );
    await render(PreJoinFormComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await typeNameAndOpenJoinStep(user, 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'XXXXXX');

    // Act
    await user.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert
    expect(screen.getByText('JAM_NOT_FOUND')).toBeTruthy();
  });
});

