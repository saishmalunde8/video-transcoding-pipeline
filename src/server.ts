import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify, { LogController } from "fastify";
import { loadConfigOrExit } from "./config.js";

const config = loadConfigOrExit(process.env);

const app = Fastify({
  logger: {
    level: config.logLevel,
    ...(config.nodeEnv === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
          },
        }
      : {}),
  },
  genReqId: () => randomUUID(),
  requestIdHeader: "x-request-id",
  logController: new LogController({
    disableRequestLogging: (request) => request.url.split("?")[0] === "/health",
  }),
});

app.get("/health", async () => {
  return { status: "ok", uptimeSeconds: Math.round(process.uptime()) };
});

app.get("/", async (request) => {
  request.log.info("handling the index route");
  return { message: "hello from fastify" };
});

interface JobParams {
  id: string;
}

interface JobsQuery {
  status?: string;
}

app.get<{ Params: JobParams }>("/jobs/:id", async (request) => {
  return { id: request.params.id };
});

app.get("/jobs/recent", async () => {
  return { recent: true };
});

app.get<{ Querystring: JobsQuery }>("/jobs", async (request) => {
  return { status: request.query.status ?? "all" };
});

await app.listen({ port: config.port, host: config.host });
app.log.info(`listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
