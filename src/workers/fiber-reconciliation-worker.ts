import type { FiberLatchService, ReconciliationSummary } from "../services/fiber-latch-service";

export interface FiberReconciliationWorkerOptions {
  service: FiberLatchService;
  pollIntervalMs: number;
}

export class FiberReconciliationWorker {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: FiberReconciliationWorkerOptions) {}

  async runOnce(): Promise<ReconciliationSummary> {
    return this.options.service.reconcileOpenAccessIntents();
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce().catch(() => {
        // Worker errors are handled by the caller or logs in a supervising process.
      });
    }, this.options.pollIntervalMs);

    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }
}
