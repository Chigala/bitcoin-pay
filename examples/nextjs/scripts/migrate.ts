import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { runMigrations } from "@bitcoin-pay/core/adapters/drizzle-adapter/migrations";

async function migrate() {
	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		console.error("Error: DATABASE_URL environment variable is not set");
		console.log("\nPlease set DATABASE_URL in your .env.local file:");
		console.log("  DATABASE_URL=postgresql://user:password@localhost:5432/bitcoin_pay");
		process.exit(1);
	}

	console.log("Running Bitcoin Pay database migrations...\n");

	const client = postgres(connectionString);
	const db = drizzle(client);

	try {
		await runMigrations(db, { provider: "pg" });
		console.log("\n✓ Migrations completed successfully!");
	} catch (error) {
		console.error("\n✗ Migration failed:");
		console.error(error);
		process.exit(1);
	} finally {
		await client.end();
	}
}

migrate();
