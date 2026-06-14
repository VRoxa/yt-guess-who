# YtGuessWho — Server Architecture & Project Overview

---

## What is YtGuessWho?

**YtGuessWho** is an online multiplayer guessing game built around YouTube music videos. Players join a shared session, each submits a song they like, and then try to guess which song belongs to which player.

This repository contains the **game server**, which is the authoritative orchestrator of all game state and real-time communication. A separate web client (out of scope for this repository) connects to this server over WebSockets.

---

## How the Game Works

| Phase | Name | Description |
|-------|------|-------------|
| 0 | **Lobby** | A player creates a **Jam** and shares an invite code. Other players join by entering the code. |
| 1 | **Submission** | Each connected player submits a YouTube URL of a song they want the group to guess. |
| 2 | **Playback & Guessing** | Songs are played one at a time in **anonymous mode** (no attribution visible). Players submit their guess of who submitted each song. |
| 3 | **Results** | Scores are revealed — points are awarded for correct guesses and for fooling other players. |

---

## Core Constraints

- The server is **stateful in-memory** for V1 (no database persistence required initially).
- All communication is **real-time, bidirectional, and event-based** via SignalR over WebSockets.
- The server is the **single source of truth** for all game state transitions.
- The web client is developed and deployed **independently**; the server exposes a clean, versioned contract.

---

## Ubiquitous Language

These terms have precise meanings within this domain and must be used consistently across the codebase, documentation, and conversations.

| Term | Definition |
|------|-----------|
| **Jam** | A single game session. Has a unique short invite code and progresses through ordered phases. |
| **Player** | A human participant connected to a Jam via a persistent WebSocket connection. |
| **Host** | The Player who created the Jam. Has extra privileges (e.g., advancing phases). |
| **Submission** | A YouTube URL provided by a Player during the Submission phase, tied to their identity server-side but hidden from peers. |
| **Round** | One iteration of the Playback & Guessing phase — one anonymous song is played and all players submit guesses. |
| **Guess** | A Player's answer attributing the currently playing song to a specific other Player. |
| **Score** | A numeric tally accumulated across all Rounds by a Player within a Jam. |
| **Event** | A named, server-dispatched or client-dispatched message that drives state transitions (e.g., `PlayerJoined`, `PhaseChanged`, `SongSubmitted`). |

---

## Domain Model

```
Jam
 ├── JamId (string, short code)
 ├── Phase (enum: Lobby | Submission | Playback | Results)
 ├── Players (List<Player>)
 │    ├── PlayerId (ConnectionId or assigned GUID)
 │    ├── DisplayName (string)
 │    ├── IsHost (bool)
 │    ├── Score (int)
 │    └── Submission (YouTubeUrl | null)
 ├── Rounds (List<Round>)
 │    ├── RoundIndex (int)
 │    ├── AnonymousSubmission (YouTubeUrl)
 │    ├── Guesses (Dictionary<PlayerId, PlayerId>)
 │    └── IsComplete (bool)
 └── CurrentRoundIndex (int)
```

---

## Real-Time Communication Contract (SignalR)

### Server → Client Events

| Event Name | Payload | When |
|------------|---------|------|
| `PlayerJoined` | `{ playerId, displayName, isHost }` | A new player joins the Jam |
| `PlayerLeft` | `{ playerId }` | A player disconnects |
| `PhaseChanged` | `{ newPhase }` | The Jam transitions to a new phase |
| `AllSubmissionsReceived` | — | All players have submitted a URL |
| `RoundStarted` | `{ roundIndex, youtubeUrl }` | A new anonymous round begins |
| `GuessSubmitted` | `{ playerId }` | A player has submitted a guess (no content revealed yet) |
| `RoundEnded` | `{ roundIndex, correctOwnerId, guesses, scoresDelta }` | Round resolves; truth is revealed |
| `GameEnded` | `{ finalScores[] }` | All rounds complete; final leaderboard |
| `Error` | `{ code, message }` | Server-side validation or state error |

### Client → Server Hub Methods

| Method Name | Parameters | Description |
|-------------|-----------|-------------|
| `CreateJam` | `displayName` | Creates a new Jam; caller becomes Host |
| `JoinJam` | `jamCode, displayName` | Joins an existing Jam in Lobby phase |
| `SubmitSong` | `youtubeUrl` | Player submits their song URL |
| `SubmitGuess` | `guessedPlayerId` | Player submits a guess for the current round |
| `AdvancePhase` | — | Host-only; moves the Jam to the next phase |
| `LeaveJam` | — | Graceful disconnect from the current Jam |

---

## Out of Scope

The following concerns are explicitly deferred or belong to a different repository:

- **Web client** (HTML/JS/React/etc.) — shipped in a separate repository.
- **Persistent storage / database** — deferred to a future milestone.
- **Authentication / user accounts** — deferred; V1 uses ephemeral display names only.
- **YouTube playback control** — handled entirely client-side using the YouTube IFrame API.
- **Spectator mode.**
- **Reconnection / session recovery** after disconnect — deferred.

