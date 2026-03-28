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

export { CATEGORIES };
