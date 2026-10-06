import type { FastifyInstance } from "fastify";

export function installGracefulShutdown(app: FastifyInstance, timeoutMs: number): void {
  let shuttingDown = false;

  // A keep-alive connection that has just finished its last response would
  // otherwise stay open (Fastify's keep-alive timeout is 72 s) and keep
  // app.close() waiting for it. "Connection: close" makes the client hang up.
  app.addHook("onSend", async (_request, reply, payload) => {
    if (shuttingDown) {
      reply.header("connection", "close");
    }
    return payload;
  });

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      app.log.warn({ signal }, "shutdown already in progress, ignoring signal");
      return;
    }
    shuttingDown = true;
    app.log.info({ signal }, "shutdown requested, draining in-flight requests");

    // unref(): this timer alone must not keep the process alive after a clean close.
    setTimeout(() => {
      app.log.error({ timeoutMs }, "graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, timeoutMs).unref();

    try {
      await app.close();
      app.log.info("shutdown complete");
    } catch (e) {
      app.log.error({ err: e }, "error during shutdown");
      process.exitCode = 1;
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
