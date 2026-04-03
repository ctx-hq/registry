import type { Bindings } from "../bindings";
import type { EnrichmentMessage } from "../models/types";
import { generateId } from "../utils/response";

// Process a batch of enrichment messages from the queue.
export async function processEnrichmentBatch(
  batch: MessageBatch<EnrichmentMessage>,
  env: Bindings
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const { type, packageId } = msg.body;

      const pkg = await env.DB.prepare(
        "SELECT id, full_name, description, summary, keywords, capabilities, content_hash FROM packages WHERE id = ?"
      ).bind(packageId).first();

      if (!pkg) {
        console.warn(`Package not found: ${packageId}`);
        msg.ack();
        continue;
      }

      if (type === "source_sync") {
        // Source-linked package changed upstream — re-enrich and re-vectorize
        console.log(`Source sync: re-enriching ${pkg.full_name}`);
        await enrichPackage(env, pkg);
        const freshPkg = await env.DB.prepare(
          "SELECT id, full_name, description, summary, keywords, capabilities, content_hash FROM packages WHERE id = ?"
        ).bind(packageId).first();
        await vectorizePackage(env, freshPkg ?? pkg);
        msg.ack();
        continue;
      }

      if (type === "enrich" || type === "vectorize_and_enrich") {
        await enrichPackage(env, pkg);
      }

      if (type === "vectorize" || type === "vectorize_and_enrich") {
        // Re-read so vectorize sees the enriched summary/capabilities/keywords
        const freshPkg = await env.DB.prepare(
          "SELECT id, full_name, description, summary, keywords, capabilities, content_hash FROM packages WHERE id = ?"
        ).bind(packageId).first();
        await vectorizePackage(env, freshPkg ?? pkg);
      }

      msg.ack();
    } catch (err) {
      console.error(`Enrichment failed for message:`, err);
      // Exponential backoff: 30s → 60s → 120s → 240s (capped)
      // CF Queue msg.attempts is 1-based (1 on first delivery)
      const delay = Math.min(30 * Math.pow(2, msg.attempts - 1), 240);
      msg.retry({ delaySeconds: delay });
    }
  }
}

// Use CF AI to generate summary, categories, capabilities, keywords.
async function enrichPackage(
  env: Bindings,
  pkg: Record<string, unknown>
): Promise<void> {
  const description = (pkg.description as string) || "";
  const fullName = pkg.full_name as string;

  // Load valid category slugs
  const cats = await env.DB.prepare("SELECT slug FROM categories").all();
  const validSlugs = (cats.results ?? []).map((r) => r.slug as string);

  const prompt = `Given this package:
Name: ${fullName}
Description: ${description}

Generate a JSON object with:
1. "summary": A one-sentence summary (max 120 characters)
2. "capabilities": Array of 3-5 action phrases (e.g., "review-code", "generate-tests")
3. "categories": Array of 1-3 category slugs from this list: ${validSlugs.join(", ")}
4. "keywords": Array of 5-8 relevant keywords

Return ONLY valid JSON, no other text.`;

  const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
    messages: [{ role: "user", content: prompt }],
  }) as { response?: string };

  if (!response.response) {
    throw new Error("Empty AI response");
  }

  let parsed: {
    summary?: string;
    capabilities?: string[];
    categories?: string[];
    keywords?: string[];
  };
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error(`Failed to parse AI response for ${fullName}:`, response.response);
    await env.DB.prepare(
      "UPDATE packages SET enrichment_status = 'failed' WHERE id = ?"
    ).bind(pkg.id).run();
    return;
  }

  const summary = (parsed.summary ?? "").slice(0, 120);
  const capabilities = JSON.stringify(parsed.capabilities ?? []);
  const keywords = JSON.stringify(parsed.keywords ?? []);

  // Filter categories to valid slugs only
  const validCategories = (parsed.categories ?? []).filter((s) =>
    validSlugs.includes(s)
  );

  await env.DB.prepare(
    `UPDATE packages SET summary = ?, capabilities = ?, keywords = ?,
     enrichment_status = 'enriched', enriched_at = datetime('now')
     WHERE id = ?`
  ).bind(summary, capabilities, keywords, pkg.id).run();

  // Upsert category associations (batched)
  if (validCategories.length > 0) {
    const placeholders = validCategories.map(() => "?").join(",");
    const catRows = await env.DB.prepare(
      `SELECT id, slug FROM categories WHERE slug IN (${placeholders})`
    ).bind(...validCategories).all();

    const catStmts = (catRows.results ?? []).map((cat) =>
      env.DB.prepare(
        "INSERT OR IGNORE INTO package_categories (package_id, category_id, source) VALUES (?, ?, 'enrichment')"
      ).bind(pkg.id, cat.id)
    );
    if (catStmts.length > 0) {
      await env.DB.batch(catStmts);
    }
  }
}

// Generate embeddings and upsert into Vectorize.
async function vectorizePackage(
  env: Bindings,
  pkg: Record<string, unknown>
): Promise<void> {
  const packageId = pkg.id as string;
  const fullName = pkg.full_name as string;
  const description = (pkg.description as string) || "";
  const summary = (pkg.summary as string) || "";
  const capabilities = (pkg.capabilities as string) || "[]";
  const keywords = (pkg.keywords as string) || "[]";

  // Build chunks
  const chunks: string[] = [];

  // Chunk 0: Title + summary
  chunks.push(`${fullName}: ${summary || description.slice(0, 120)}`);

  // Chunk 1: Full description
  if (description) {
    chunks.push(description.slice(0, 2000));
  }

  // Chunk 2: Capabilities
  try {
    const caps = JSON.parse(capabilities) as string[];
    if (caps.length > 0) {
      chunks.push(`Capabilities: ${caps.join(", ")}`);
    }
  } catch { /* skip */ }

  // Chunk 3: Keywords
  try {
    const kws = JSON.parse(keywords) as string[];
    if (kws.length > 0) {
      chunks.push(`Keywords: ${kws.join(", ")}`);
    }
  } catch { /* skip */ }

  if (chunks.length === 0) return;

  // Compute content hash
  const allText = chunks.join("\n");
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(allText)
  );
  const newHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Skip if content unchanged
  if (pkg.content_hash === newHash) return;

  // Generate embeddings via CF AI
  const embeddingResult = await env.AI.run("@cf/baai/bge-small-en-v1.5", {
    text: chunks,
  }) as { data?: number[][] };

  if (!embeddingResult.data || embeddingResult.data.length !== chunks.length) {
    throw new Error(`Embedding generation failed for ${fullName}`);
  }

  // Delete old chunks from Vectorize
  const oldChunks = await env.DB.prepare(
    "SELECT id FROM vector_chunks WHERE package_id = ?"
  ).bind(packageId).all();

  const oldIds = (oldChunks.results ?? []).map((r) => r.id as string);
  if (oldIds.length > 0) {
    await env.VECTORIZE.deleteByIds(oldIds);
  }

  // Delete old chunk records from D1
  await env.DB.prepare(
    "DELETE FROM vector_chunks WHERE package_id = ?"
  ).bind(packageId).run();

  // Upsert new chunks (batched)
  const vectors: VectorizeVector[] = [];
  const chunkStmts: D1PreparedStatement[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = generateId();
    const chunkHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(chunks[i]))
      )
    ).map((b) => b.toString(16).padStart(2, "0")).join("");

    chunkStmts.push(
      env.DB.prepare(
        `INSERT INTO vector_chunks (id, package_id, chunk_index, chunk_text, content_hash)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(chunkId, packageId, i, chunks[i], chunkHash)
    );

    vectors.push({
      id: chunkId,
      values: embeddingResult.data[i],
      metadata: {
        package_id: packageId,
        full_name: fullName,
        chunk_index: i,
      },
    });
  }

  await env.DB.batch(chunkStmts);
  await env.VECTORIZE.upsert(vectors);

  // Update package tracking
  await env.DB.prepare(
    "UPDATE packages SET vectorized_at = datetime('now'), content_hash = ? WHERE id = ?"
  ).bind(newHash, packageId).run();
}

// Enqueue a package for enrichment + vectorization.
export async function enqueueEnrichment(
  queue: Queue,
  packageId: string,
  type: EnrichmentMessage["type"] = "vectorize_and_enrich"
): Promise<void> {
  await queue.send({ type, packageId } satisfies EnrichmentMessage);
}
