import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HubConnectionState } from '@microsoft/signalr';

import { ConnectionStatusComponent } from './connection-status.component';
import { HubConnectionService } from '../../core/hub-connection.service';

/**
 * Creates a minimal mock of {@link HubConnectionService} using real Angular signals
 * so the component's computed signals track reactively.
 */
function createMockHubService(state: HubConnectionState, error?: string) {
  const connect = vi.fn().mockResolvedValue(undefined);
  const disconnect = vi.fn().mockResolvedValue(undefined);

  return {
    connectionState: signal(state),
    isConnected: signal(state === HubConnectionState.Connected),
    isTransitioning: signal(
      state === HubConnectionState.Connecting ||
        state === HubConnectionState.Disconnecting,
    ),
    errorMessage: signal<string | undefined>(error),
    connect,
    disconnect,
  };
}

describe('ConnectionStatusComponent', () => {
  it('shows Disconnected status on initial render', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Disconnected),
        },
      ],
    });

    // Assert
    expect(screen.getByRole('status').textContent?.trim()).toBe('Disconnected');
  });

  it('shows an enabled Connect button when disconnected', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Disconnected),
        },
      ],
    });

    // Assert
    const button = screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);
  });

  it('shows Connected status when the service is connected', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Connected),
        },
      ],
    });

    // Assert
    expect(screen.getByRole('status').textContent?.trim()).toBe('Connected');
  });

  it('shows an enabled Disconnect button when connected', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Connected),
        },
      ],
    });

    // Assert
    const button = screen.getByRole('button', { name: 'Disconnect' }) as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBe(false);
  });

  it('shows Connecting… status and a disabled button while connecting', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Connecting),
        },
      ],
    });

    // Assert
    expect(screen.getByRole('status').textContent?.trim()).toBe('Connecting…');
    const button = screen.getByRole('button', { name: 'Connecting…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('shows Disconnecting… status and a disabled button while disconnecting', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Disconnecting),
        },
      ],
    });

    // Assert
    expect(screen.getByRole('status').textContent?.trim()).toBe('Disconnecting…');
    const button = screen.getByRole('button', { name: 'Disconnecting…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('shows Reconnecting… status when the connection is reconnecting', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Reconnecting),
        },
      ],
    });

    // Assert
    expect(screen.getByRole('status').textContent?.trim()).toBe('Reconnecting…');
  });

  it('displays an error message when the service reports a connection error', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(
            HubConnectionState.Disconnected,
            'Connection refused',
          ),
        },
      ],
    });

    // Assert
    expect(screen.getByRole('alert').textContent?.trim()).toBe('Connection refused');
  });

  it('does not render an error alert when there is no error', async () => {
    // Arrange & Act
    await render(ConnectionStatusComponent, {
      providers: [
        {
          provide: HubConnectionService,
          useValue: createMockHubService(HubConnectionState.Disconnected),
        },
      ],
    });

    // Assert
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('calls connect on the service when the Connect button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(HubConnectionState.Disconnected);

    await render(ConnectionStatusComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });

    // Act
    await user.click(screen.getByRole('button', { name: 'Connect' }));

    // Assert
    expect(mockService.connect).toHaveBeenCalledOnce();
  });

  it('calls disconnect on the service when the Disconnect button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockService = createMockHubService(HubConnectionState.Connected);

    await render(ConnectionStatusComponent, {
      providers: [{ provide: HubConnectionService, useValue: mockService }],
    });

    // Act
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));

    // Assert
    expect(mockService.disconnect).toHaveBeenCalledOnce();
  });
});

