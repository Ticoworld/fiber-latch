// Do not execute a potentially stale dist/server.js or start a development watcher.
console.error(
  "The historical FiberLatch HTTP service is retired from network serving: " +
  "payment-to-purchase ownership, amount, asset and resource authorization are incomplete. " +
  "Use the npm packages after host-owned authorization. See docs/legacy-service-status.md.",
);
process.exitCode = 1;
