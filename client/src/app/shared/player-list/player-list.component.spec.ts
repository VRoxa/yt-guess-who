import { render, screen } from '@testing-library/angular';

import { PlayerListComponent } from './player-list.component';
import type { Player } from '../../core/models/player.model';

const alice: Player = { playerId: 'conn-1', displayName: 'Alice', isHost: true };
const bob: Player = { playerId: 'conn-2', displayName: 'Bob', isHost: false };

describe('PlayerListComponent', () => {

  // ── Empty state ────────────────────────────────────────────

  it('renders nothing when the players list is empty', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: { players: [] },
    });

    // Assert
    expect(screen.queryByRole('list')).toBeNull();
  });

  // ── Lobby mode (submittedPlayerIds = null) ─────────────────

  it('renders a list item for each player in lobby mode', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: { players: [alice, bob] },
    });

    // Assert
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows the Host badge only for the player with isHost true', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: { players: [alice, bob] },
    });

    // Assert
    const badges = screen.getAllByText('Host');
    expect(badges).toHaveLength(1);
    expect(badges[0].closest('li')?.textContent).toContain('Alice');
  });

  it('does not show a Host badge for a non-host player', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: { players: [bob] },
    });

    // Assert
    expect(screen.queryByText('Host')).toBeNull();
  });

  it('uses "Players in this Jam" as the accessible list label in lobby mode', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: { players: [alice] },
    });

    // Assert
    expect(screen.getByRole('list', { name: /players in this jam/i })).toBeTruthy();
  });

  // ── Submission mode (submittedPlayerIds is a Set) ──────────

  it('shows ✓ for a player whose id is in submittedPlayerIds', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: {
        players: [alice, bob],
        submittedPlayerIds: new Set(['conn-1']),
      },
    });

    // Assert
    const aliceItem = screen.getByText('Alice').closest('li');
    expect(aliceItem?.textContent).toContain('✓');
  });

  it('shows … for a player whose id is not in submittedPlayerIds', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: {
        players: [alice, bob],
        submittedPlayerIds: new Set(['conn-1']),
      },
    });

    // Assert
    const bobItem = screen.getByText('Bob').closest('li');
    expect(bobItem?.textContent).toContain('…');
  });

  it('does not show Host badges in submission mode', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: {
        players: [alice, bob],
        submittedPlayerIds: new Set<string>(),
      },
    });

    // Assert
    expect(screen.queryByText('Host')).toBeNull();
  });

  it('uses "Submission progress" as the accessible list label in submission mode', async () => {
    // Arrange & Act
    await render(PlayerListComponent, {
      componentInputs: {
        players: [alice],
        submittedPlayerIds: new Set<string>(),
      },
    });

    // Assert
    expect(screen.getByRole('list', { name: /submission progress/i })).toBeTruthy();
  });
});

