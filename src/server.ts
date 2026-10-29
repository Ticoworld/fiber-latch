import { LEGACY_SERVER_RETIRED_MESSAGE } from "./legacy-retirement";

// Refuse before loading application configuration, signing keys, Prisma or RPC.
console.error(LEGACY_SERVER_RETIRED_MESSAGE);
process.exitCode = 1;
