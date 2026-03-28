import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { badRequest } from "../utils/errors";
import { searchPackages, type SearchMode } from "../services/search";

const app = new Hono<AppEnv>();

app.get("/v1/search", async (c) => {
  const query = c.req.query("q")?.trim();
  const type_ = c.req.query("type");
  const mode = (c.req.query("mode") ?? "hybrid") as SearchMode;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20") || 20, 100);

  if (!query) {
    throw badRequest("Query parameter 'q' is required");
  }

  if (!["fts", "vector", "hybrid"].includes(mode)) {
    throw badRequest("Invalid mode. Use: fts, vector, or hybrid");
  }

  const result = await searchPackages(c.env, { query, mode, type: type_, limit });
  return c.json(result);
});

export default app;
