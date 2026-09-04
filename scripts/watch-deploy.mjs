import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const WATCH_TARGETS = ["contracts", "scripts", "hardhat.config.ts"];
const EXTENSIONS = new Set([".sol", ".ts", ".js", ".mjs", ".json"]);

const POLL_MS = Number(process.env.POLL_MS || 2000);
const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS || 1000);

const RPC_URL =
  process.env.RPC_URL ||
  process.env.LOCAL_RPC_URL ||
  "http://127.0.0.1:8545";

const HARDHAT_NETWORK = process.env.HARDHAT_NETWORK || "localhost";
const READY_FILE = process.env.READY_FILE || "/tmp/deploy-ready";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "cache",
  "artifacts",
  "dist",
  "coverage",
  "frontend",
]);

let snapshot = new Map();
let timer = null;
let running = false;
let queued = false;

const log = (message) => console.log(`[watch-deploy] ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) {
      continue;
    }

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(full))) {
      yield full;
    }
  }
}

async function collectFiles() {
  const files = new Map();

  for (const target of WATCH_TARGETS) {
    const full = path.resolve(root, target);

    if (!(await exists(full))) {
      continue;
    }

    const stat = await fs.stat(full);

    if (stat.isFile()) {
      if (EXTENSIONS.has(path.extname(full))) {
        files.set(full, stat.mtimeMs);
      }
      continue;
    }

    if (stat.isDirectory()) {
      for await (const file of walk(full)) {
        const fileStat = await fs.stat(file);
        files.set(file, fileStat.mtimeMs);
      }
    }
  }

  return files;
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    log(`${command} ${args.join(" ")}`);

    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    child.on("error", (error) => {
      log(error.message);
      resolve(1);
    });

    child.on("close", (code) => resolve(code ?? 0));
  });
}

async function deploy() {
  if (running) {
    queued = true;
    return;
  }

  running = true;

  const compileCode = await runCommand("npx", ["hardhat", "compile"]);

  if (compileCode !== 0) {
    log("Compilation failed. Waiting for next change...");
    running = false;

    if (queued) {
      queued = false;
      scheduleDeploy(500);
    }

    return;
  }

  const deployCode = await runCommand("npx", [
    "hardhat",
    "run",
    "scripts/deploy-local.ts",
    "--network",
    HARDHAT_NETWORK,
  ]);

  if (deployCode === 0) {
    log("Deployment succeeded.");
    await fs.writeFile(READY_FILE, new Date().toISOString());
  } else {
    log("Deployment failed. Waiting for next change...");
  }

  running = false;

  if (queued) {
    queued = false;
    scheduleDeploy(500);
  }
}

function scheduleDeploy(ms = DEBOUNCE_MS) {
  clearTimeout(timer);

  timer = setTimeout(() => {
    deploy().catch((error) => console.error(error));
  }, ms);
}

function hasChanged(previous, current) {
  const keys = new Set([...previous.keys(), ...current.keys()]);

  for (const key of keys) {
    if (previous.get(key) !== current.get(key)) {
      return true;
    }
  }

  return false;
}

async function waitForRpc() {
  while (true) {
    try {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        }),
      });

      if (response.ok) {
        const body = await response.json().catch(() => null);

        if (body?.result) {
          log(`RPC ready at ${RPC_URL}`);
          return;
        }
      }
    } catch {
      // retry
    }

    log(`Waiting for RPC at ${RPC_URL}...`);
    await sleep(2000);
  }
}

async function main() {
  await waitForRpc();

  snapshot = await collectFiles();

  log("Watching contracts/scripts. Initial deploy starting...");

  await deploy();

  setInterval(async () => {
    try {
      const current = await collectFiles();

      if (hasChanged(snapshot, current)) {
        snapshot = current;
        scheduleDeploy();
      }
    } catch (error) {
      console.error(error);
    }
  }, POLL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});