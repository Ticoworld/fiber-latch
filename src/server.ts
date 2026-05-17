import { buildApp } from "./app";

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  const app = await buildApp({ logger: true });

  await app.listen({
    port: Number.isFinite(port) ? port : 3000,
    host,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
