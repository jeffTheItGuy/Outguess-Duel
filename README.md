# Outguess Duel

> *"Outguess Duel is a game of cryptography and psychology. Pick a secret number, guess your opponent's, and hide your intentions behind a cryptographic commit."*

Outguess Duel is a fully on-chain, trustless Player-vs-Player (PVP) numbers guessing game. Players stake ETH, commit to a secret number and a guess using a salted hash, and then reveal their choices. The smart contract calculates the absolute distance between guesses and secrets to determine the winner, splitting the pot in the event of a tie.

---

> *"Built on a robust Web3 stack: Solidity smart contracts for trustless escrow, a React/Vite frontend for seamless wallet integration, and a Node.js backend powering an automated on-chain bot."*

## 🏗️ Architecture

*   **Smart Contracts (`contracts/`):** Written in Solidity (`^0.8.20`). Handles the state machine (`Idle` -> `Commit` -> `Reveal` -> `Finished`), escrow logic, and commit-reveal verification using `keccak256(abi.encodePacked(secret, guess, salt))`.
*   **Frontend (`frontend/`):** A React + TypeScript SPA built with Vite. Uses `ethers.js` (v6) for MetaMask wallet connections, contract interactions, a built-in local Hardhat faucet, and a Match Details modal for post-game analysis.
*   **Backend (`backend/`):** A Node.js/Express server that acts as an autonomous on-chain agent. It polls the blockchain via `gameWatcher.ts`, generates moves with `botLogic.ts`, and exposes an API to start matches.

---

> *"The match lifecycle is strictly enforced: Stake your ETH, lock in your commit hash, reveal your salt and secrets, and let the contract calculate the absolute distance to crown a winner."*

## 🎮 Gameplay Loop

1.  **Stake:** Both players deposit the required ETH into the contract. The first stake sets the `requiredStake` for the duel.
2.  **Commit Phase (300s):** Players submit a `keccak256` hash of their `secret`, `guess`, and `salt`. Neither player can see the other's numbers.
3.  **Reveal Phase (300s):** Players submit their raw `secret`, `guess`, and `salt`. The contract verifies the hash matches the original commit.
4.  **Resolution:**
    *   The contract calculates `|Player1.guess - Player2.secret|` and `|Player2.guess - Player1.secret|`.
    *   The smaller distance wins the entire pot.
    *   Equal distances result in a tie and the pot is split.
5.  **Timeouts:** If a player fails to commit or reveal within the window, the other player can call `claimTimeout()` to win by default, advance the phase, or trigger a full refund and reset.

---

> *"Never wait for an opponent. The integrated backend Game Watcher allows you to play against an autonomous on-chain bot that stakes, commits, and reveals in real-time."*

## 🤖 Play vs Human or Bot

The frontend features a dedicated matchmaking menu:

*   **Play vs Human:** Stakes your ETH and waits for another wallet to join the lobby. You can unstake at any time while the match is still idle.
*   **Play vs Bot:** Pings the backend API (`POST /api/bot/start-match`), waking up the `gameWatcher`. The bot automatically stakes, generates a random move, and plays out the match against you on-chain.
*   **Match Details Modal:** After any result (win, lose, or tie), inspect the full on-chain breakdown: player addresses (tagged `you` / `bot`), commit hashes, revealed secrets/guesses, and the exact distance calculation used by the contract.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   MetaMask (or another Web3 wallet)
*   Docker (for the containerized `chain`, `bot`, and frontend services) OR a local Hardhat node.

### 1. Local Blockchain & Deployment
Start your local Hardhat node and deploy the contracts. The deploy script writes the address to `.deploy-address` and generates `frontend/src/generated/contract.ts`.

### 2. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory:
```env
RPC_URL=http://127.0.0.1:8545
BOT_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
CONTRACT_ADDRESS=auto
POLL_INTERVAL_MS=3000
STAKE_AMOUNT_ETH=0.01
BOT_AUTO_RESTART=true
RESULT_VIEW_MS=15000
```
Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The Vite dev server starts on `http://localhost:5173` and proxies:
*   `/api/bot` -> `http://bot:4000` (backend bot API)
*   `/hardhat` -> `http://chain:8545` (local RPC node / faucet)

### 4. Connect & Play
1.  Open `http://localhost:5173` in your browser.
2.  Connect MetaMask to your Localhost network (Chain ID `31337`).
3.  Use the **🚰 Local Hardhat Faucet** panel to request test ETH.
4.  Choose **Play vs Bot** or **Play vs Human** and start guessing!


## ⚠️ Notes & Gotchas

*   **Address Casing:** MetaMask returns lowercase addresses while ethers.js contract reads return checksummed addresses. All comparisons in the frontend are done in lowercase.
*   **Commit Storage:** Your `secret`, `guess`, and `salt` are saved to `localStorage` after committing so the reveal form can prefill automatically. They are cleared once the match finishes.
*   **Bot Auto-Restart:** With `BOT_AUTO_RESTART=true`, the bot waits `RESULT_VIEW_MS` after a finished match before staking into a new duel. Set it to `false` to make the bot wait for an explicit `/api/bot/start-match` request.
*   **Local Development Only:** The built-in faucet signs transactions from a known Hardhat rich account. Never expose this setup to a public network.