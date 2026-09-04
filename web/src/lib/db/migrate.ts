/**
 * CLI: npm run db:migrate -w web
 * Also runs automatically on web server start via ensureMigrated().
 *
 * With SEED_DEMO=1 / CLEAR_DEMO=1 the demo seed also runs.
 */
import { migrate, pool } from "./index";

async function main() {
  console.log("[migrate] starting…");
  await migrate();
  if (process.env.SEED_DEMO === "1" || process.env.CLEAR_DEMO === "1") {
    const { runDemoSeedFromEnv } = await import("./seed-demo");
    await runDemoSeedFromEnv();
  }
  console.log("[migrate] done");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
