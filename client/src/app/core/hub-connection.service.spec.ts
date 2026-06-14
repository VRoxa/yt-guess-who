import { TestBed } from '@angular/core/testing';
import { HubConnectionState, type HubConnection } from '@microsoft/signalr';

import { HUB_CONNECTION, HubConnectionService } from './hub-connection.service';

type MockConnection = {
  state: HubConnectionState;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onclose: ReturnType<typeof vi.fn>;
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
});

