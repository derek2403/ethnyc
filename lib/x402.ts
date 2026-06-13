// SERVER-ONLY: loads the agent's private key + Circle Gateway / x402 config.
// Never import this from a client component (it reads the private key).
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "hardhat/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Circle Gateway hosted facilitator (testnet). No API key needed.
export const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";

export const NETWORK = "eip155:5042002"; // Arc Testnet
export const USDC_ASSET = "0x3600000000000000000000000000000000000000"; // USDC on Arc
export const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"; // verifyingContract for EIP-712

// The skill's seller / treasury. MUST differ from the agent buyer (else Gateway
// rejects it as a self_transfer). Hardhat account #1 — a well-known distinct
// address; the per-use fee lands in its Gateway balance. Swap for the real
// developer/auditor payout address in production.
export const SKILL_SELLER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export const PRICE_DISPLAY = "0.01"; // USDC per use
export const PRICE_BASE_UNITS = "10000"; // 0.01 * 1e6

export function getAgentKey(): `0x${string}` {
  let pk = process.env.ARC_PRIVATE_KEY?.trim();
  if (!pk) throw new Error("ARC_PRIVATE_KEY not found (looked in hardhat/.env, .env.local)");
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  return pk as `0x${string}`;
}

// The single x402 payment option the seller accepts (Circle Gateway batched, USDC on Arc).
export function skillRequirement() {
  return {
    scheme: "exact",
    network: NETWORK,
    asset: USDC_ASSET,
    amount: PRICE_BASE_UNITS,
    payTo: SKILL_SELLER,
    maxTimeoutSeconds: 604900, // ~7 days + buffer (Gateway minimum is 7 days)
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: GATEWAY_WALLET,
    },
  };
}
