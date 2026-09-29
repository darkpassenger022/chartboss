const tokenIds = {
  BTC: "btc-bitcoin",
  ETH: "eth-ethereum",
  BNB: "bnb-binance-coin",
  SOL: "sol-solana",
  SUI: "sui-sui",
  PEPE: "pepe-pepe",
  XRP: "xrp-xrp",
  DOGE: "doge-dogecoin",
  ADA: "ada-cardano",
  AVAX: "avax-avalanche",
  LINK: "link-chainlink",
};

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.setHeader("Cache-Control", "no-store");
    return response.status(405).json({ error: "Method not allowed." });
  }

  response.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=30, stale-while-revalidate=60"
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(
      "https://api.coinpaprika.com/v1/tickers?quotes=USD&limit=100",
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );

    if (!upstream.ok) {
      throw new Error("CoinPaprika returned HTTP " + upstream.status);
    }

    const rows = await upstream.json();
    if (!Array.isArray(rows)) {
      throw new Error("CoinPaprika returned an invalid ticker list");
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const prices = {};
    const missing = [];

    for (const [symbol, id] of Object.entries(tokenIds)) {
      const quote = byId.get(id)?.quotes?.USD;
      const price = Number(quote?.price);
      const change24h = Number(quote?.percent_change_24h);

      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(change24h)) {
        missing.push(symbol);
        continue;
      }

      prices[symbol] = { price, change24h };
    }

    if (missing.length) {
      throw new Error("Missing ticker data for " + missing.join(", "));
    }

    return response.status(200).json({
      source: "CoinPaprika",
      updatedAt: new Date().toISOString(),
      prices,
    });
  } catch (error) {
    console.error("Unable to load market prices:", error);
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({
      error: "Market data is temporarily unavailable.",
    });
  } finally {
    clearTimeout(timeout);
  }
};
