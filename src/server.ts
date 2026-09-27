import Fastify from "fastify";

const app = Fastify();

app.get("/", async () => {
  return { message: "hello from fastify" };
});

await app.listen({ port: 3000, host: "127.0.0.1" });
console.log("listening on http://127.0.0.1:3000");
