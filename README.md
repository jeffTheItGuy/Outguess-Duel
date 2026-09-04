# Outguess Duel

> **The Game** — Two players stake, secretly commit a number and a guess, then reveal. Whoever guesses closer to the opponent’s secret number wins the pot.

> **The Stack** — Solidity + Hardhat on a local chain, with a React + Vite frontend. No external database required.

> **The Dev Loop** — Run Docker Compose to start Hardhat, auto-redeploy contracts on change, and hot-reload the frontend.

> **The Reset** — Stop the node and start it again. New chain, new accounts, new state — no cleanup needed.

---

## 1. What Is Outguess Duel?

Outguess Duel is a 1v1 commit-reveal game.

Each player:

1. Stakes tokens.
2. Commits a hidden bundle containing:
   - their own secret number
   - their guess of the opponent’s secret number
   - a random salt
3. Reveals the original values later.
4. Wins if their guess is closer to the opponent’s real secret number.

The contract enforces fairness:

- Commitments hide moves on-chain.
- Reveals are validated against the original commit hash.
- A no-show loses.
- A tie splits the pot.
- If both players ghost, the pot goes to the treasury/burn address.

---

## 2. How the Game Works

### Game Phases

```text
Waiting for Stakes
        ↓
Both players stake
        ↓
Commit Phase
        ↓
Commit timer ends
        ↓
Reveal Phase
        ↓
Reveal timer ends
        ↓
Winner paid / pot split / forfeit
        ↓
Contract resets for another round