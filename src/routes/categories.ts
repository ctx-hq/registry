import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { authMiddleware, adminMiddleware } from "../middleware/auth";
import { seedCategories, listCategories } from "../services/categories";

const app = new Hono<AppEnv>();

// List all categories with package counts.
app.get("/v1/categories", async (c) => {
  const categories = await listCategories(c.env.DB, true);
  return c.json({ categories });
});

// Admin: seed categories (idempotent).
app.post("/v1/categories/seed", authMiddleware, adminMiddleware, async (c) => {
  const seeded = await seedCategories(c.env.DB);
  return c.json({ seeded });
});

export default app;
