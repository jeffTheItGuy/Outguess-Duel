// scripts/fund-bot.mjs
//
// Sends ETH from a well-funded local Hardhat account to the bot's wallet so
// it can pay gas and post its stake as soon as the chain starts.
//
// Run via the `fund-bot` service in docker-compose.dev.yml. Reads:
//   RPC_URL         - URL of the local Hardhat node (default http://127.0.0.1:8545)
//   BOT_PRIVATE_KEY - the bot's private key (should match the backend/bot service)
//   FUND_AMOUNT_ETH - how much ETH to send (default "10")

import { JsonRpcProvider, Wallet, parseEther, formatEther } from "ethers";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const FUND_AMOUNT_ETH = process.env.FUND_AMOUNT_ETH ?? "10";

// Hardhat's default Account #0. Always funded with 10,000 ETH on a fresh node.
const RICH_ACCOUNT_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Falls back to the same key hardcoded for the `bot` service in
// docker-compose.dev.yml, since the `fund-bot` service currently doesn't
// pass BOT_PRIVATE_KEY through. See note below.
const BOT_PRIVATE_KEY =
  process.env.BOT_PRIVATE_KEY ??
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

async function waitForRpc(provider, retries = 30, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      console.log(`[fund-bot] waiting for RPC at ${RPC_URL}...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`RPC never became available at ${RPC_URL}`);
}

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);

  await waitForRpc(provider);

  const richWallet = new Wallet(RICH_ACCOUNT_PRIVATE_KEY, provider);
  const botWallet = new Wallet(BOT_PRIVATE_KEY, provider);

  const botAddress = await botWallet.getAddress();
  const existingBalance = await provider.getBalance(botAddress);

  console.log(`[fund-bot] bot address: ${botAddress}`);
  console.log(
    `[fund-bot] current balance: ${formatEther(existingBalance)} ETH`
  );

  const amount = parseEther(FUND_AMOUNT_ETH);

  if (existingBalance >= amount) {
    console.log(
      `[fund-bot] bot already has at least ${FUND_AMOUNT_ETH} ETH, skipping`
    );
    return;
  }

  console.log(`[fund-bot] sending ${FUND_AMOUNT_ETH} ETH to bot wallet...`);

  const tx = await richWallet.sendTransaction({
    to: botAddress,
    value: amount,
  });

  await tx.wait();

  const newBalance = await provider.getBalance(botAddress);

  console.log(`[fund-bot] done. new balance: ${formatEther(newBalance)} ETH`);
}

main().catch((error) => {
  console.error("[fund-bot] failed:", error);
  process.exitCode = 1;
});