import type { Bindings } from "../bindings";

// Unified category taxonomy for the ctx registry.
const CATEGORIES: Array<{ slug: string; name: string; description: string }> = [
  { slug: "programming", name: "Programming", description: "General programming and software development" },
  { slug: "web-development", name: "Web Development", description: "Frontend and fullstack web development" },
  { slug: "mobile", name: "Mobile", description: "iOS, Android, and cross-platform mobile development" },
  { slug: "devops", name: "DevOps & Cloud", description: "CI/CD, containers, infrastructure, and cloud services" },
  { slug: "database", name: "Database", description: "Database management, queries, and data modeling" },
  { slug: "testing", name: "Testing", description: "Test automation, QA, and code quality" },
  { slug: "security", name: "Security", description: "Application security, authentication, and encryption" },
  { slug: "ai-ml", name: "AI & ML", description: "Artificial intelligence, machine learning, and data science" },
  { slug: "data-analysis", name: "Data Analysis", description: "Data processing, visualization, and analytics" },
  { slug: "automation", name: "Automation", description: "Task automation, scripting, and workflow orchestration" },
  { slug: "productivity", name: "Productivity", description: "Time management, organization, and personal productivity" },
  { slug: "writing", name: "Writing", description: "Content creation, copywriting, and technical writing" },
  { slug: "translation", name: "Translation", description: "Language translation and localization" },
  { slug: "education", name: "Education", description: "Teaching, learning, and tutoring" },
  { slug: "design", name: "Design", description: "UI/UX design, graphic design, and creative tools" },
  { slug: "communication", name: "Communication", description: "Chat, email, and messaging tools" },
  { slug: "search", name: "Search & Research", description: "Web search, information retrieval, and research" },
  { slug: "finance", name: "Finance", description: "Financial analysis, trading, and accounting" },
  { slug: "marketing", name: "Marketing", description: "SEO, analytics, social media, and growth" },
  { slug: "legal", name: "Legal", description: "Legal research, contracts, and compliance" },
  { slug: "healthcare", name: "Healthcare", description: "Medical information and health tools" },
  { slug: "science", name: "Science", description: "Scientific research and academic tools" },
  { slug: "media", name: "Media", description: "Audio, video, and image processing" },
  { slug: "gaming", name: "Gaming", description: "Game development and entertainment" },
  { slug: "files", name: "Files & Documents", description: "File management, PDF, and document processing" },
  { slug: "api-integration", name: "API Integration", description: "API clients, webhooks, and service connectors" },
  { slug: "cli-tools", name: "CLI Tools", description: "Command-line utilities and terminal tools" },
  { slug: "git-github", name: "Git & GitHub", description: "Version control and GitHub workflow tools" },
  { slug: "browser", name: "Browser", description: "Browser automation and web scraping" },
  { slug: "smart-home", name: "Smart Home & IoT", description: "Home automation and IoT device control" },
  { slug: "career", name: "Career", description: "Resume building, interview prep, and career advice" },
  { slug: "customer-support", name: "Customer Support", description: "Help desk, ticketing, and support tools" },
  { slug: "project-management", name: "Project Management", description: "Task tracking, planning, and team coordination" },
  { slug: "other", name: "Other", description: "Miscellaneous tools and utilities" },
];

// Seed all categories into D1. Idempotent (INSERT OR IGNORE).
export async function seedCategories(db: D1Database): Promise<number> {
  let seeded = 0;
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    // Deterministic ID from slug
    const data = new TextEncoder().encode(`category:${cat.slug}`);
    const hash = await crypto.subtle.digest("SHA-256", data);
    const id = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);

    const result = await db.prepare(
      `INSERT OR IGNORE INTO categories (id, slug, name, description, display_order)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, cat.slug, cat.name, cat.description, i).run();

    if (result.meta.changes > 0) seeded++;
  }
  return seeded;
}

// Get all categories (optionally with package counts).
export async function listCategories(
  db: D1Database,
  withCounts = false
): Promise<Array<Record<string, unknown>>> {
  if (withCounts) {
    const result = await db.prepare(
      `SELECT c.slug, c.name, c.description, c.display_order,
              COUNT(pc.package_id) as package_count
       FROM categories c
       LEFT JOIN package_categories pc ON c.id = pc.category_id
       GROUP BY c.id
       ORDER BY c.display_order`
    ).all();
    return result.results ?? [];
  }

  const result = await db.prepare(
    "SELECT slug, name, description, display_order FROM categories ORDER BY display_order"
  ).all();
  return result.results ?? [];
}

// Keyword → category mapping for MCP server auto-classification.
// Each entry maps keywords (lowercased, checked against package keywords + description)
// to a category slug from the CATEGORIES list above.
const MCP_KEYWORD_MAP: Array<{ keywords: string[]; slug: string }> = [
  { keywords: ["database", "sql", "postgres", "mysql", "sqlite", "mongo", "redis", "supabase", "prisma", "drizzle"], slug: "database" },
  { keywords: ["git", "github", "gitlab", "bitbucket", "version control", "commit", "pull request"], slug: "git-github" },
  { keywords: ["browser", "puppeteer", "playwright", "selenium", "scraping", "web scraping", "crawl"], slug: "browser" },
  { keywords: ["search", "google", "brave", "bing", "tavily", "exa", "serp", "web search"], slug: "search" },
  { keywords: ["ai", "llm", "openai", "anthropic", "embedding", "vector", "rag", "machine learning"], slug: "ai-ml" },
  { keywords: ["cloud", "aws", "gcp", "azure", "kubernetes", "docker", "terraform", "infrastructure", "deploy"], slug: "devops" },
  { keywords: ["file", "filesystem", "pdf", "document", "csv", "excel", "s3", "storage"], slug: "files" },
  { keywords: ["slack", "discord", "email", "gmail", "telegram", "notification", "chat", "messaging"], slug: "communication" },
  { keywords: ["api", "rest", "graphql", "webhook", "http", "fetch", "request", "integration"], slug: "api-integration" },
  { keywords: ["test", "testing", "jest", "vitest", "pytest", "ci", "quality"], slug: "testing" },
  { keywords: ["security", "auth", "oauth", "vault", "secret", "encrypt", "certificate"], slug: "security" },
  { keywords: ["data", "analytics", "chart", "visualization", "pandas", "notebook", "jupyter"], slug: "data-analysis" },
  { keywords: ["automation", "workflow", "cron", "schedule", "script", "task"], slug: "automation" },
  { keywords: ["productivity", "calendar", "todo", "notion", "obsidian", "note", "trello", "jira"], slug: "productivity" },
  { keywords: ["finance", "stock", "trading", "payment", "stripe", "crypto", "accounting"], slug: "finance" },
  { keywords: ["media", "image", "video", "audio", "music", "photo", "ffmpeg"], slug: "media" },
  { keywords: ["code", "linter", "formatter", "ide", "editor", "debug", "compiler", "programming"], slug: "programming" },
  { keywords: ["web", "react", "vue", "angular", "nextjs", "frontend", "css", "html"], slug: "web-development" },
  { keywords: ["cli", "terminal", "shell", "command", "bash", "zsh"], slug: "cli-tools" },
  { keywords: ["marketing", "seo", "social media", "analytics", "campaign"], slug: "marketing" },
  { keywords: ["smart home", "iot", "home assistant", "homekit"], slug: "smart-home" },
  { keywords: ["translate", "translation", "i18n", "localization", "language"], slug: "translation" },
  { keywords: ["education", "learn", "tutor", "course", "quiz"], slug: "education" },
  { keywords: ["design", "figma", "sketch", "ui", "ux"], slug: "design" },
  { keywords: ["write", "writing", "content", "blog", "copywriting", "markdown"], slug: "writing" },
  { keywords: ["health", "medical", "fitness", "wellness"], slug: "healthcare" },
  { keywords: ["science", "research", "arxiv", "paper", "academic"], slug: "science" },
  { keywords: ["game", "gaming", "unity", "godot"], slug: "gaming" },
  { keywords: ["project", "management", "planning", "agile", "kanban"], slug: "project-management" },
  { keywords: ["customer", "support", "helpdesk", "ticket", "zendesk", "intercom"], slug: "customer-support" },
  { keywords: ["mobile", "ios", "android", "react native", "flutter"], slug: "mobile" },
  { keywords: ["legal", "contract", "compliance", "regulation"], slug: "legal" },
  { keywords: ["career", "resume", "interview", "job"], slug: "career" },
];

/**
 * Maps an MCP package to one of the predefined categories based on its
 * keywords and description. Returns the best-matching category slug,
 * or "other" if no match is found.
 */
export function mapToMCPCategory(keywords: string[], description: string): string {
  const text = [...keywords, description].join(" ").toLowerCase();

  let bestSlug = "other";
  let bestScore = 0;

  for (const entry of MCP_KEYWORD_MAP) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (new RegExp(`\\b${kw}\\b`).test(text)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = entry.slug;
    }
  }

  return bestSlug;
}

export { CATEGORIES };
