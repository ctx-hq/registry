/**
 * E2E test configuration.
 * Values come from environment variables (.env.staging or CI secrets).
 */
export const STAGING = {
  API_URL: process.env.STAGING_API_URL || "",
  ALICE_TOKEN: process.env.E2E_ALICE_TOKEN || "",
  BOB_TOKEN: process.env.E2E_BOB_TOKEN || "",
} as const;

export function requireStaging(): typeof STAGING {
  if (!STAGING.API_URL) {
    throw new Error(
      "STAGING_API_URL not set. Copy e2e/.env.staging.example to e2e/.env.staging and fill in values.",
    );
  }
  if (!STAGING.ALICE_TOKEN || !STAGING.BOB_TOKEN) {
    throw new Error("E2E_ALICE_TOKEN and E2E_BOB_TOKEN must be set.");
  }
  return STAGING;
}
