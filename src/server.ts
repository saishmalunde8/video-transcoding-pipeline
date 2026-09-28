import "dotenv/config";
import Fastify from "fastify";
import { loadConfigOrExit } from "./config.js";

const config = loadConfigOrExit(process.env);

const app = Fastify();

app.get("/", async () => {
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
console.log(`listening on http://${config.host}:${config.port} (${config.nodeEnv})`);
