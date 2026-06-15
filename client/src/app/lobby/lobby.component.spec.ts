import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { LobbyComponent } from './lobby.component';
import { HubConnectionService } from '../core/hub-connection.service';

/**
 * Creates a minimal mock of {@link HubConnectionService} with configurable
 * reactive signals so the component's template bindings track correctly.
 * The `isConnected` signal and `errorMessage` signal are writable so individual
 * tests can mutate them to simulate state transitions.
 */
function createMockHubService(
  isConnected = false,
  createJamImpl?: () => Promise<string>,
  joinJamImpl?: () => Promise<void>,
) {
  const connect = vi.fn().mockResolvedValue(undefined);
  const createJam = vi.fn(createJamImpl ?? (() => Promise.resolve('ABCDEF')));
  const joinJam = vi.fn(joinJamImpl ?? (() => Promise.resolve()));

  return {
    isConnected: signal(isConnected),
    isTransitioning: signal(false),
    errorMessage: signal<string | undefined>(undefined),
    connect,
    createJam,
    joinJam,
  };
}

describe('LobbyComponent', () => {
  it('disables the Create Jam button when the display name is empty', async () => {
    // Arrange & Act
    await render(LobbyComponent, {
      providers: [
        { provide: HubConnectionService, useValue: createMockHubService(true) },
      ],
    });

    // Assert — no text typed, input is empty
    const button = screen.getByRole('button', { name: /create jam/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('disables the Create Jam button when the display name is whitespace only', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [
        { provide: HubConnectionService, useValue: createMockHubService(true) },
      ],
    });

    // Act
    await user.type(screen.getByLabelText(/your display name/i), '   ');

    // Assert
    const button = screen.getByRole('button', { name: /create jam/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables the Create Jam button when a non-empty display name is entered even if disconnected', async () => {
    // Arrange — disconnected state; button must still become enabled once a name is typed
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [
        { provide: HubConnectionService, useValue: createMockHubService(false) },
      ],
    });

    // Act
    await user.type(screen.getByLabelText(/your display name/i), 'Alice');

    // Assert
    const button = screen.getByRole('button', { name: /create jam/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('calls createJam with the trimmed display name when the button is clicked and already connected', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), '  Alice  ');

    // Act
    await user.click(screen.getByRole('button', { name: /create jam/i }));

    // Assert — no connect call needed; goes straight to createJam
    expect(mockService.connect).not.toHaveBeenCalled();
    expect(mockService.createJam).toHaveBeenCalledOnce();
    expect(mockService.createJam).toHaveBeenCalledWith('Alice');
  });

  it('connects first and then creates the jam when the button is clicked while disconnected', async () => {
    // Arrange
    const user = userEvent.setup();
    const isConnected = signal(false);
    const mockService = {
      isConnected,
      isTransitioning: signal(false),
      errorMessage: signal<string | undefined>(undefined),
      connect: vi.fn().mockImplementation(() => {
        // Simulate a successful connection
        isConnected.set(true);
        return Promise.resolve();
      }),
      createJam: vi.fn().mockResolvedValue('ABCDEF'),
    };
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create jam/i }));

    // Assert
    expect(mockService.connect).toHaveBeenCalledOnce();
    expect(mockService.createJam).toHaveBeenCalledOnce();
    expect(mockService.createJam).toHaveBeenCalledWith('Alice');
  });

  it('shows a connection error and does not call createJam when connect fails during button click', async () => {
    // Arrange
    const user = userEvent.setup();
    const errorMessage = signal<string | undefined>(undefined);
    const mockService = {
      isConnected: signal(false),
      isTransitioning: signal(false),
      errorMessage,
      connect: vi.fn().mockImplementation(() => {
        // Simulate a failed connection — connect() never rejects, it sets errorMessage instead
        errorMessage.set('Connection refused');
        return Promise.resolve();
      }),
      createJam: vi.fn(),
    };
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create jam/i }));

    // Assert
    expect(mockService.connect).toHaveBeenCalledOnce();
    expect(mockService.createJam).not.toHaveBeenCalled();
    expect(screen.getByText('Connection refused')).toBeTruthy();
  });

  it('shows a connection error from the hub service when auto-connect fails on initial render', async () => {
    // Arrange — simulate the service arriving already in a failed-connect state
    const mockService = createMockHubService(false);
    mockService.errorMessage.set('Failed to reach server');

    // Act
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });

    // Assert
    expect(screen.getByText('Failed to reach server')).toBeTruthy();
  });

  it('disables the Create Jam button while the request is in-flight', async () => {
    // Arrange
    let resolveCreate!: (code: string) => void;
    const pendingPromise = new Promise<string>(resolve => {
      resolveCreate = resolve;
    });
    const mockService = createMockHubService(true, () => pendingPromise);
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Alice');

    // Act — click but do not await the in-flight call
    const clickPromise = user.click(screen.getByRole('button', { name: /create jam/i }));

    // Assert — button is disabled while in-flight
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
    await user.type(screen.getByLabelText(/your display name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create jam/i }));

    // Assert
    expect(screen.getByText('WXPGRT')).toBeTruthy();
  });

  it('hides the form after a successful create', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true, () => Promise.resolve('WXPGRT'));
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create jam/i }));

    // Assert
    expect(screen.queryByRole('button', { name: /create jam/i })).toBeNull();
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
    await user.type(screen.getByLabelText(/your display name/i), 'Alice');

    // Act
    await user.click(screen.getByRole('button', { name: /create jam/i }));

    // Assert
    expect(screen.getByText('Server unavailable')).toBeTruthy();
  });

  // ── Join Jam flow ──────────────────────────────────────────────────────────

  it('disables the Join Jam button when the display name is empty', async () => {
    // Arrange & Act
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await userEvent.setup().type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Assert
    const button = screen.getByRole('button', { name: /join jam/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('disables the Join Jam button when the jam code is empty', async () => {
    // Arrange & Act
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });
    await userEvent.setup().type(screen.getByLabelText(/your display name/i), 'Bob');

    // Assert — jam code input is empty
    const button = screen.getByRole('button', { name: /join jam/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('enables the Join Jam button when both display name and jam code are non-empty', async () => {
    // Arrange
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: createMockHubService(true) }],
    });

    // Act
    await user.type(screen.getByLabelText(/your display name/i), 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Assert
    const button = screen.getByRole('button', { name: /join jam/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  it('calls joinJam with the trimmed jam code and display name when clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), '  Bob  ');
    await user.type(screen.getByLabelText(/jam code/i), '  ABCDEF  ');

    // Act
    await user.click(screen.getByRole('button', { name: /join jam/i }));

    // Assert
    expect(mockService.joinJam).toHaveBeenCalledOnce();
    expect(mockService.joinJam).toHaveBeenCalledWith('ABCDEF', 'Bob');
  });

  it('disables the Join Jam button while the request is in-flight', async () => {
    // Arrange
    let resolveJoin!: () => void;
    const pendingPromise = new Promise<void>(resolve => {
      resolveJoin = resolve;
    });
    const mockService = createMockHubService(true, undefined, () => pendingPromise);
    const user = userEvent.setup();
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'ABCDEF');

    // Act — click but do not await the in-flight call
    const clickPromise = user.click(screen.getByRole('button', { name: /join jam/i }));

    // Assert — button is disabled while in-flight
    const button = screen.getByRole('button', { name: /joining…/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Cleanup
    resolveJoin();
    await clickPromise;
  });

  it('renders the jam code prominently after a successful join', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'WXPGRT');

    // Act
    await user.click(screen.getByRole('button', { name: /join jam/i }));

    // Assert
    expect(screen.getByText('WXPGRT')).toBeTruthy();
  });

  it('hides the form after a successful join', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(true);
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'WXPGRT');

    // Act
    await user.click(screen.getByRole('button', { name: /join jam/i }));

    // Assert
    expect(screen.queryByRole('button', { name: /join jam/i })).toBeNull();
  });

  it('renders an error message when joinJam rejects', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(
      true,
      undefined,
      () => Promise.reject(new Error('JAM_NOT_FOUND')),
    );
    await render(LobbyComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });
    await user.type(screen.getByLabelText(/your display name/i), 'Bob');
    await user.type(screen.getByLabelText(/jam code/i), 'ZZZZZZ');

    // Act
    await user.click(screen.getByRole('button', { name: /join jam/i }));

    // Assert
    expect(screen.getByText('JAM_NOT_FOUND')).toBeTruthy();
  });
});

