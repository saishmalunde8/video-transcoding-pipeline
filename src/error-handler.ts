import { STATUS_CODES } from "node:http";
import type { FastifyInstance } from "fastify";

// Anything can be thrown, so `error` arrives as `unknown`. Only trust a status
// code if the value is a real Error that carries a valid 4xx/5xx number.
function statusCodeOf(error: unknown): number {
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
  ) {
    return error.statusCode;
  }
  return 500;
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method}:${request.url} not found`,
      requestId: request.id,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = statusCodeOf(error);
    const isServerError = statusCode >= 500;
    const message = error instanceof Error ? error.message : String(error);

    if (isServerError) {
      request.log.error({ err: error }, "unhandled error");
    } else {
      request.log.warn(message);
    }

    reply.status(statusCode).send({
      statusCode,
      error: STATUS_CODES[statusCode] ?? "Error",
      message: isServerError ? "An unexpected error occurred" : message,
      requestId: request.id,
    });
  });
}
