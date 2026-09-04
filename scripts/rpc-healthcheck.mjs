const url = process.env.RPC_URL || "http://127.0.0.1:8545";

try {
  const response = await fetch(url, {
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

  if (!response.ok) {
    process.exit(1);
  }

  const body = await response.json();

  if (body?.result) {
    process.exit(0);
  }

  process.exit(1);
} catch {
  process.exit(1);
}