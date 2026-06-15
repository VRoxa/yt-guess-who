/**
 * Event payload received from the server when the Host role is transferred
 * because the previous Host left the Jam.
 */
export interface HostChangedEvent {
  readonly newHostPlayerId: string;
}

