import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { generateId } from "../utils/response";
import { hashToken } from "../services/auth";

const app = new Hono<AppEnv>();

// Start device flow (mock for development)
app.post("/v1/auth/device", async (c) => {
  const deviceCode = generateId();
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const userCode = Array.from(bytes).map(b => b.toString(36)).join("").slice(0, 8).toUpperCase();

  // Store device code in KV with 15 min TTL
  await c.env.CACHE.put(
    `device:${deviceCode}`,
    JSON.stringify({ user_code: userCode, status: "pending" }),
    { expirationTtl: 900 }
  );

  return c.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: "https://getctx.org/login/device",
    expires_in: 900,
    interval: 5,
  });
});

// Poll for token
app.post("/v1/auth/token", async (c) => {
  const formData = await c.req.parseBody();
  const deviceCode = formData["device_code"] as string;

  if (!deviceCode) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const stored = await c.env.CACHE.get(`device:${deviceCode}`);
  if (!stored) {
    return c.json({ error: "expired_token" }, 400);
  }

  const data = JSON.parse(stored);
  if (data.status === "pending") {
    return c.json({ error: "authorization_pending" });
  }

  if (data.status === "authorized") {
    // Generate API token
    const token = `ctx_${generateId()}${generateId()}`;
    const tokenHash = await hashToken(token);

    // Ensure user exists
    let user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE github_id = ?"
    ).bind(data.github_id).first();

    if (!user) {
      const userId = generateId();
      await c.env.DB.prepare(
        "INSERT INTO users (id, username, email, github_id) VALUES (?, ?, ?, ?)"
      ).bind(userId, data.username, data.email ?? "", data.github_id).run();
      user = { id: userId };
    }

    // Create API token
    await c.env.DB.prepare(
      "INSERT INTO api_tokens (id, user_id, token_hash, name) VALUES (?, ?, ?, 'cli')"
    ).bind(generateId(), user.id, tokenHash).run();

    // Clean up device code
    await c.env.CACHE.delete(`device:${deviceCode}`);

    return c.json({
      access_token: token,
      token_type: "bearer",
      scope: "read write",
    });
  }

  return c.json({ error: "authorization_pending" });
});

// GitHub OAuth callback (completes device flow)
app.get("/v1/auth/callback", async (c) => {
  // In production: exchange GitHub code for user info, update device code status
  // For now, this is a placeholder
  return c.json({ message: "OAuth callback — implement with GitHub OAuth" });
});

export default app;
