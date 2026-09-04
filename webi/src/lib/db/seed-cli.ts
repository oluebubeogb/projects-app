/**
 * CLI helper:
 *   npm run db:seed -w web              → seed (if not present)
 *   CLEAR_DEMO=1 npm run db:seed -w web → wipe demo only
 *   SEED_DEMO=1 CLEAR_DEMO=1 npm run db:seed -w web → wipe then seed
 */
import { ensureMigrated, pool } from "./index";
import { runDemoSeedFromEnv } from "./seed-demo";

async function main() {
  await ensureMigrated();

  if (process.env.CLEAR_DEMO !== "1" && process.env.SEED_DEMO !== "1") {
    process.env.SEED_DEMO = "1";
  }

  await runDemoSeedFromEnv();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
