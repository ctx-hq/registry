import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { getLatestVersion } from "../services/package";

const app = new Hono<AppEnv>();

// Agent-readable endpoint: GET /:fullName.ctx
// Returns plain text install instructions that an agent can understand
app.get("/:fullName{.+\\.ctx$}", async (c) => {
  const path = c.req.param("fullName");
  const fullName = path.replace(/\.ctx$/, "");

  const pkg = await c.env.DB.prepare(
    "SELECT * FROM packages WHERE full_name = ?"
  ).bind(fullName).first();

  if (!pkg) {
    return c.text(`Package ${fullName} not found`, 404);
  }

  const ver = await getLatestVersion(c.env.DB, pkg.id as string);

  const version = (ver?.version as string) ?? "unknown";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manifest: any = {};
  try {
    manifest = ver?.manifest ? JSON.parse(ver.manifest as string) : {};
  } catch {
    // invalid manifest JSON, use empty object
  }

  let instructions = `## ${fullName}@${version}\n\n`;
  instructions += `${pkg.description}\n\n`;
  instructions += `### Install\n\n`;
  instructions += `Run: ctx install ${fullName}\n\n`;
  instructions += `If ctx is not installed:\n`;
  instructions += `  curl -fsSL https://getctx.org/install.sh | sh\n\n`;

  if (pkg.type === "mcp" && manifest.mcp) {
    instructions += `### MCP Configuration\n\n`;
    instructions += `Transport: ${manifest.mcp.transport}\n`;
    if (manifest.mcp.command) {
      instructions += `Command: ${manifest.mcp.command} ${(manifest.mcp.args ?? []).join(" ")}\n`;
    }
    if (manifest.mcp.env?.length) {
      instructions += `\nRequired environment variables:\n`;
      for (const env of manifest.mcp.env) {
        instructions += `  - ${env.name}: ${env.description ?? ""}\n`;
      }
    }
  }

  instructions += `\nType: ${pkg.type}\n`;
  instructions += `License: ${pkg.license || "unspecified"}\n`;
  instructions += `Supports: Claude Code, Cursor, Windsurf\n`;

  c.header("Content-Type", "text/plain; charset=utf-8");
  return c.text(instructions);
});

export default app;
