/**
 * CLI: npm run db:migrate -w web
 * Also runs automatically on web server start via ensureMigrated().
 */
import { migrate, ensureMigrated, pool } from "./index";

async function main() {
  console.log("[migrate] starting…");
  await migrate();
  console.log("[migrate] done");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
