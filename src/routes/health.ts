import { Hono } from "hono";
import type { AppEnv } from "../bindings";

const app = new Hono<AppEnv>();

app.get("/v1/health", (c) => {
  return c.json({
    status: "ok",
    version: c.env.API_VERSION,
    timestamp: new Date().toISOString(),
  });
});

export default app;
