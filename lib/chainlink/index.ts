/**
 * Chainlink Confidential AI Attester client.
 *
 * - types  — REST API shapes + AttesterError
 * - client — transport + low-level inference endpoints
 * - audit  — MARS audit layer (skill / file → attested verdict)
 *
 * Server-only — reads CHAINLINK_ATTESTER_API_KEY from the environment.
 */

export * from "./types";
export * from "./client";
export * from "./audit";
