import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { generateId } from "../utils/response";
import { hashToken } from "../services/auth";
import { authMiddleware } from "../middleware/auth";

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
  return c.json({ message: "Use /login/callback on the web app for OAuth" });
});

// GitHub OAuth — exchange a GitHub OAuth code for a session token.
// The web app redirects to /login/callback which then calls this endpoint
// with the temporary `code` from GitHub.  We exchange it server-side so the
// client never needs to know the client_secret.
app.post("/v1/auth/github", async (c) => {
  let body: { code?: string };
  try {
    body = await c.req.json<{ code?: string }>();
  } catch {
    return c.json({ error: "invalid_request", message: "Invalid JSON body" }, 400);
  }

  if (!body.code) {
    return c.json({ error: "missing code" }, 400);
  }

  // Exchange the code for an access token with GitHub
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code: body.code,
    }),
  });

  const tokenData = await tokenRes.json<{
    access_token?: string;
    error?: string;
    error_description?: string;
  }>();

  if (!tokenData.access_token) {
    return c.json(
      { error: "github_oauth_failed", message: tokenData.error_description ?? tokenData.error ?? "Unknown error" },
      401,
    );
  }

  // Fetch the authenticated user's profile from GitHub
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "ctx-registry",
      Accept: "application/vnd.github+json",
    },
  });

  if (!userRes.ok) {
    return c.json({ error: "github_user_fetch_failed" }, 502);
  }

  const ghUser = await userRes.json<{
    id: number;
    login: string;
    email: string | null;
    avatar_url: string;
  }>();

  const githubId = String(ghUser.id);
  const username = ghUser.login;
  const email = ghUser.email ?? "";
  const avatarUrl = ghUser.avatar_url;

  // Upsert user — create if new, update email/avatar if existing
  let user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE github_id = ?"
  ).bind(githubId).first();

  if (user) {
    // Update profile (email may change, avatar may change)
    await c.env.DB.prepare(
      "UPDATE users SET username = ?, email = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(username, email, avatarUrl, user.id).run();
  } else {
    const userId = generateId();
    await c.env.DB.prepare(
      "INSERT INTO users (id, username, email, avatar_url, github_id) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, username, email, avatarUrl, githubId).run();
    user = { id: userId };

    // Auto-create user scope
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO scopes (name, owner_type, owner_id) VALUES (?, 'user', ?)"
    ).bind(username.toLowerCase(), user.id).run();
  }

  // Generate session token
  const token = `ctx_${generateId()}${generateId()}`;
  const tokenHash = await hashToken(token);

  await c.env.DB.prepare(
    "INSERT INTO api_tokens (id, user_id, token_hash, name) VALUES (?, ?, ?, 'web')"
  ).bind(generateId(), user.id, tokenHash).run();

  return c.json({ token });
});

// Get current user (validate session)
app.get("/v1/me", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    username: user.username,
    email: user.email,
    avatar_url: user.avatar_url,
  });
});

export default app;
