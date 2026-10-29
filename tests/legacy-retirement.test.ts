import { spawnSync } from "node:child_process";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadRuntimeConfig } from "../src/config/runtime";
import { LEGACY_SERVER_RETIRED_MESSAGE } from "../src/legacy-retirement";

describe("historical service network retirement", () => {
  it("refuses the dependency-free npm entry point without loading a build", () => {
    const result = spawnSync(process.execPath, [
      path.join(process.cwd(), "scripts", "legacy-server-retired.cjs"),
    ], { encoding: "utf8", timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe(LEGACY_SERVER_RETIRED_MESSAGE);
  });

  it.each([undefined, "fake", "real"])(
    "refuses startup before configuration in mode %s",
    (mode) => {
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        DATABASE_URL: "unsupported://must-not-connect",
        FIBERLATCH_RECEIPT_PRIVATE_JWK: "must-not-parse-this-key",
        FIBER_RPC_URL: "http://127.0.0.1:1/must-not-call",
        FIBER_NETWORK: "must-not-load-configuration",
        HOST: "0.0.0.0",
        PORT: "0",
      };
      if (mode === undefined) delete env.FIBER_CLIENT_MODE;
      else env.FIBER_CLIENT_MODE = mode;

      const result = spawnSync(process.execPath, [
        path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"),
        path.join(process.cwd(), "src", "server.ts"),
      ], { env, encoding: "utf8", timeout: 10_000 });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr.trim()).toBe(LEGACY_SERVER_RETIRED_MESSAGE);
    },
  );

  it.each(["promise", "callback", "raw-server"] as const)(
    "refuses %s listening on the actual historical app",
    async (style) => {
      // Listening and the static health route must not need a database.
      const app = await buildApp({ prisma: {} as PrismaClient, runtimeConfig: loadRuntimeConfig({}) });
      try {
        const options = { host: "127.0.0.1", port: 0 };
        if (style === "promise") {
          await expect(app.listen(options)).rejects.toThrow(LEGACY_SERVER_RETIRED_MESSAGE);
        } else if (style === "callback") {
          await new Promise<void>((resolve, reject) => {
            app.listen(options, (error) => {
              try {
                expect(error?.message).toBe(LEGACY_SERVER_RETIRED_MESSAGE);
                resolve();
              } catch (assertionError) {
                reject(assertionError);
              }
            });
          });
        } else {
          const error = new Promise<Error>((resolve) => app.server.once("error", resolve));
          app.server.listen(options);
          expect((await error).message).toBe(LEGACY_SERVER_RETIRED_MESSAGE);
        }
        expect(app.server.listening).toBe(false);
        expect(app.server.address()).toBeNull();

        // Retiring network serving must not remove the historical injection path.
        const health = await app.inject({ method: "GET", url: "/health" });
        expect(health.statusCode).toBe(200);
      } finally {
        await app.close();
      }
    },
  );
});
