import { TestBed } from '@angular/core/testing';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';

import { HUB_CONNECTION, HubConnectionService } from './hub-connection.service';

type MockConnection = {
  state: HubConnectionState;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onclose: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  invoke: ReturnType<typeof vi.fn>;
};

describe('HubConnectionService', () => {
  let service: HubConnectionService;
  let mockConnection: MockConnection;

  beforeEach(() => {
    mockConnection = {
      state: HubConnectionState.Disconnected,
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      onclose: vi.fn(),
      on: vi.fn(),
      invoke: vi.fn().mockResolvedValue('ABCDEF'),
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: HUB_CONNECTION,
          // reason: partial mock — only the four members used by the service are implemented
          useValue: mockConnection as unknown as HubConnection,
        },
      ],
    });

    service = TestBed.inject(HubConnectionService);
  });

  describe('initial state', () => {
    it('reports Disconnected connection state on creation', () => {
      // Arrange — mockConnection.state = Disconnected (set in beforeEach)
      // Act — service created in beforeEach
      // Assert
      expect(service.connectionState()).toBe(HubConnectionState.Disconnected);
    });

    it('reports isConnected as false on creation', () => {
      // Arrange & Act — see beforeEach
      // Assert
      expect(service.isConnected()).toBe(false);
    });

    it('reports isTransitioning as false on creation', () => {
      // Arrange & Act — see beforeEach
      // Assert
      expect(service.isTransitioning()).toBe(false);
    });

    it('reports no error message on creation', () => {
      // Arrange & Act — see beforeEach
      // Assert
      expect(service.errorMessage()).toBeUndefined();
    });

    it('registers an onclose callback on the connection at construction', () => {
      // Arrange & Act — see beforeEach
      // Assert
      expect(mockConnection.onclose).toHaveBeenCalledOnce();
    });
  });

  describe('connect()', () => {
    it('marks isTransitioning as true while the connection attempt is in flight', () => {
      // Arrange
      let resolveStart!: () => void;
      mockConnection.start.mockReturnValue(
        new Promise<void>(resolve => {
          resolveStart = resolve;
        }),
      );

      // Act — do not await; inspect the synchronous in-flight state
      const promise = service.connect();

      // Assert
      expect(service.isTransitioning()).toBe(true);
      expect(service.connectionState()).toBe(HubConnectionState.Connecting);

      // Cleanup
      resolveStart();
      return promise;
    });

    it('sets state to Connected after a successful connection', async () => {
      // Arrange — pre-set the state the mock connection will report after start()
      mockConnection.state = HubConnectionState.Connected;

      // Act
      await service.connect();

      // Assert
      expect(service.connectionState()).toBe(HubConnectionState.Connected);
      expect(service.isConnected()).toBe(true);
      expect(service.isTransitioning()).toBe(false);
    });

    it('clears any previous error message when a new attempt begins', async () => {
      // Arrange — produce an initial error
      mockConnection.start.mockRejectedValueOnce(new Error('first failure'));
      await service.connect();
      expect(service.errorMessage()).not.toBeUndefined();

      // Act — second attempt succeeds
      mockConnection.state = HubConnectionState.Connected;
      mockConnection.start.mockResolvedValue(undefined);
      await service.connect();

      // Assert
      expect(service.errorMessage()).toBeUndefined();
    });

    it('resets state to Disconnected when the connection attempt fails', async () => {
      // Arrange
      mockConnection.start.mockRejectedValue(new Error('ECONNREFUSED'));

      // Act
      await service.connect();

      // Assert
      expect(service.connectionState()).toBe(HubConnectionState.Disconnected);
      expect(service.isConnected()).toBe(false);
    });

    it('sets an error message from the Error when the attempt fails', async () => {
      // Arrange
      mockConnection.start.mockRejectedValue(new Error('Connection refused'));

      // Act
      await service.connect();

      // Assert
      expect(service.errorMessage()).toBe('Connection refused');
    });

    it('sets a generic fallback error message when a non-Error is thrown', async () => {
      // Arrange
      mockConnection.start.mockRejectedValue('unknown string rejection');

      // Act
      await service.connect();

      // Assert
      expect(service.errorMessage()).toBe('Connection failed.');
    });

    it('resolves without throwing when the connection attempt fails', async () => {
      // Arrange
      mockConnection.start.mockRejectedValue(new Error('unreachable'));

      // Act & Assert — must not reject
      await expect(service.connect()).resolves.toBeUndefined();
    });
  });

  describe('disconnect()', () => {
    it('marks isTransitioning as true while the disconnection is in flight', () => {
      // Arrange
      let resolveStop!: () => void;
      mockConnection.stop.mockReturnValue(
        new Promise<void>(resolve => {
          resolveStop = resolve;
        }),
      );

      // Act — do not await; inspect the synchronous in-flight state
      const promise = service.disconnect();

      // Assert
      expect(service.connectionState()).toBe(HubConnectionState.Disconnecting);
      expect(service.isTransitioning()).toBe(true);

      // Cleanup
      resolveStop();
      return promise;
    });

    it('sets state to Disconnected after disconnecting', async () => {
      // Arrange — mockConnection.state stays Disconnected (default)
      // Act
      await service.disconnect();

      // Assert
      expect(service.connectionState()).toBe(HubConnectionState.Disconnected);
      expect(service.isTransitioning()).toBe(false);
    });

    it('calls stop on the underlying connection exactly once', async () => {
      // Arrange & Act
      await service.disconnect();

      // Assert
      expect(mockConnection.stop).toHaveBeenCalledOnce();
    });
  });

  describe('onclose callback', () => {
    it('updates the connectionState signal when the connection closes externally', () => {
      // Arrange — retrieve the callback registered during construction
      const onCloseCallback = mockConnection.onclose.mock.calls[0][0] as () => void;

      // Simulate being connected, then the server drops the connection
      service.connectionState.set(HubConnectionState.Connected);
      mockConnection.state = HubConnectionState.Disconnected;

      // Act — simulate an abrupt external disconnect
      onCloseCallback();

      // Assert
      expect(service.connectionState()).toBe(HubConnectionState.Disconnected);
    });
  });

  describe('createJam()', () => {
    it('invokes CreateJam on the connection with the correct method name and display name', async () => {
      // Arrange
      const displayName = 'Alice';

      // Act
      await service.createJam(displayName);

      // Assert
      expect(mockConnection.invoke).toHaveBeenCalledOnce();
      expect(mockConnection.invoke).toHaveBeenCalledWith('CreateJam', displayName);
    });

    it('returns the Jam code string resolved by the connection', async () => {
      // Arrange
      mockConnection.invoke.mockResolvedValue('WXPGRT');

      // Act
      const result = await service.createJam('Alice');

      // Assert
      expect(result).toBe('WXPGRT');
    });

    it('propagates a rejected promise when the connection invoke rejects', async () => {
      // Arrange
      mockConnection.invoke.mockRejectedValue(new Error('Hub error'));

      // Act & Assert
      await expect(service.createJam('Alice')).rejects.toThrow('Hub error');
    });
  });

  describe('joinJam()', () => {
    it('invokes JoinJam on the connection with the correct method name and both arguments in order', async () => {
      // Arrange
      mockConnection.invoke.mockResolvedValue(undefined);

      // Act
      await service.joinJam('ABCDEF', 'Bob');

      // Assert
      expect(mockConnection.invoke).toHaveBeenCalledOnce();
      expect(mockConnection.invoke).toHaveBeenCalledWith('JoinJam', 'ABCDEF', 'Bob');
    });

    it('resolves when the connection invoke resolves', async () => {
      // Arrange
      mockConnection.invoke.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.joinJam('ABCDEF', 'Bob')).resolves.toBeUndefined();
    });

    it('propagates a rejected promise when the connection invoke rejects', async () => {
      // Arrange
      mockConnection.invoke.mockRejectedValue(new Error('JAM_NOT_FOUND'));

      // Act & Assert
      await expect(service.joinJam('ZZZZZZ', 'Bob')).rejects.toThrow('JAM_NOT_FOUND');
    });
  });

  describe('onPlayerJoined()', () => {
    it('registers a handler on the connection using the PlayerJoined event name', () => {
      // Arrange
      const handler = vi.fn();

      // Act
      service.onPlayerJoined(handler);

      // Assert
      expect(mockConnection.on).toHaveBeenCalledOnce();
      expect(mockConnection.on).toHaveBeenCalledWith('PlayerJoined', handler);
    });

    it('invokes the handler with the player payload when the mock fires a PlayerJoined event', () => {
      // Arrange
      const handler = vi.fn();
      service.onPlayerJoined(handler);

      // Retrieve the handler that was registered on the mock connection
      const registeredHandler = mockConnection.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'PlayerJoined',
      )?.[1] as ((player: unknown) => void) | undefined;

      const payload = { playerId: 'conn-1', displayName: 'Alice', isHost: true };

      // Act — simulate the connection firing the event
      registeredHandler?.(payload);

      // Assert
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  describe('leaveJam()', () => {
    it('invokes LeaveJam on the connection with the correct method name', async () => {
      // Arrange
      mockConnection.invoke.mockResolvedValue(undefined);

      // Act
      await service.leaveJam();

      // Assert
      expect(mockConnection.invoke).toHaveBeenCalledOnce();
      expect(mockConnection.invoke).toHaveBeenCalledWith('LeaveJam');
    });

    it('resolves when the connection invoke resolves', async () => {
      // Arrange
      mockConnection.invoke.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.leaveJam()).resolves.toBeUndefined();
    });

    it('propagates a rejected promise when the connection invoke rejects', async () => {
      // Arrange
      mockConnection.invoke.mockRejectedValue(new Error('NOT_IN_JAM'));

      // Act & Assert
      await expect(service.leaveJam()).rejects.toThrow('NOT_IN_JAM');
    });
  });

  describe('onPlayerLeft()', () => {
    it('registers a handler on the connection using the PlayerLeft event name', () => {
      // Arrange
      const handler = vi.fn();

      // Act
      service.onPlayerLeft(handler);

      // Assert
      expect(mockConnection.on).toHaveBeenCalledOnce();
      expect(mockConnection.on).toHaveBeenCalledWith('PlayerLeft', handler);
    });

    it('invokes the handler with the payload when the mock fires a PlayerLeft event', () => {
      // Arrange
      const handler = vi.fn();
      service.onPlayerLeft(handler);

      const registeredHandler = mockConnection.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'PlayerLeft',
      )?.[1] as ((payload: unknown) => void) | undefined;

      const payload = { playerId: 'conn-1' };

      // Act
      registeredHandler?.(payload);

      // Assert
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  describe('onHostChanged()', () => {
    it('registers a handler on the connection using the HostChanged event name', () => {
      // Arrange
      const handler = vi.fn();

      // Act
      service.onHostChanged(handler);

      // Assert
      expect(mockConnection.on).toHaveBeenCalledOnce();
      expect(mockConnection.on).toHaveBeenCalledWith('HostChanged', handler);
    });

    it('invokes the handler with the payload when the mock fires a HostChanged event', () => {
      // Arrange
      const handler = vi.fn();
      service.onHostChanged(handler);

      const registeredHandler = mockConnection.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'HostChanged',
      )?.[1] as ((payload: unknown) => void) | undefined;

      const payload = { newHostPlayerId: 'conn-2' };

      // Act
      registeredHandler?.(payload);

      // Assert
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(payload);
    });
  });
});

