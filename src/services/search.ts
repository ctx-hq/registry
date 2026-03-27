import type { Bindings } from "../bindings";

export interface SearchOptions {
  query: string;
  type?: string;
  platform?: string;
  limit: number;
}

export async function searchPackages(db: D1Database, opts: SearchOptions) {
  let sql = `
    SELECT p.full_name, p.type, p.description, p.downloads, p.repository
    FROM packages_fts f
    JOIN packages p ON p.rowid = f.rowid
    WHERE packages_fts MATCH ?
  `;
  const sanitized = '"' + opts.query.replace(/"/g, '""') + '"';
  const params: unknown[] = [sanitized];

  if (opts.type) {
    sql += " AND p.type = ?";
    params.push(opts.type);
  }

  sql += " ORDER BY rank LIMIT ?";
  params.push(opts.limit);

  return db.prepare(sql).bind(...params).all();
}
