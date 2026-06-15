/**
 * Represents a Player as received from server-sent `PlayerJoined` events.
 */
export interface Player {
  readonly playerId: string;
  readonly displayName: string;
  readonly isHost: boolean;
}

