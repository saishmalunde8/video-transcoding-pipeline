import Fastify from "fastify";

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

await app.listen({ port: 3000, host: "127.0.0.1" });
console.log("listening on http://127.0.0.1:3000");
