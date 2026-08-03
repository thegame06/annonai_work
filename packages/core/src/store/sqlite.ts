import { DatabaseSync } from 'node:sqlite';
import type { Detail, EdgeKind, NodeId } from '../api.ts';
import type { KnowledgeStore, SearchOpts, StoredEdge, StoredNode } from './store.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL,
  owner TEXT, created TEXT, source TEXT NOT NULL, tags TEXT NOT NULL,
  summary TEXT, body TEXT, bytes INTEGER NOT NULL, subject TEXT
);
CREATE INDEX IF NOT EXISTS idx_nodes_kind_status ON nodes(kind, status);
CREATE TABLE IF NOT EXISTS edges (
  src TEXT NOT NULL, dst TEXT NOT NULL, kind TEXT NOT NULL,
  PRIMARY KEY (src, dst, kind)
);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges(dst, kind);
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(id UNINDEXED, text, tokenize='porter unicode61');
CREATE TABLE IF NOT EXISTS build_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

const row = (r: Record<string, unknown>, detail: Detail): StoredNode => ({
  id: r['id'] as string,
  kind: r['kind'] as string,
  title: r['title'] as string,
  status: r['status'] as string,
  owner: (r['owner'] as string) ?? undefined,
  created: (r['created'] as string) ?? undefined,
  source: r['source'] as string,
  tags: JSON.parse((r['tags'] as string) || '[]') as string[],
  summary: detail === 'title' ? undefined : ((r['summary'] as string) ?? undefined),
  body: detail === 'full' ? ((r['body'] as string) ?? undefined) : undefined,
  bytes: Number(r['bytes']),
  subject: (r['subject'] as string) ?? undefined,
});

export class SqliteStore implements KnowledgeStore {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    // WAL needs shared memory the filesystem may not provide (network shares,
    // FUSE mounts). Observed, not hypothetical: fall back rather than fail.
    try { this.#db.exec('PRAGMA journal_mode = WAL;'); } catch { /* rollback journal */ }
    this.#db.exec(SCHEMA);
  }

  put(nodes: readonly StoredNode[], edges: readonly StoredEdge[]): void {
    const db = this.#db;
    db.exec('BEGIN');
    try {
      db.exec('DELETE FROM nodes; DELETE FROM edges; DELETE FROM nodes_fts;');
      const n = db.prepare(
        `INSERT INTO nodes (id,kind,title,status,owner,created,source,tags,summary,body,bytes,subject)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      );
      const f = db.prepare('INSERT INTO nodes_fts (id, text) VALUES (?, ?)');
      for (const x of nodes) {
        n.run(x.id, x.kind, x.title, x.status, x.owner ?? null, x.created ?? null, x.source,
          JSON.stringify(x.tags), x.summary ?? null, x.body ?? null, x.bytes, x.subject ?? null);
        f.run(x.id, [x.title, x.summary ?? '', x.body ?? ''].join(' '));
      }
      const e = db.prepare('INSERT OR IGNORE INTO edges (src,dst,kind) VALUES (?,?,?)');
      for (const x of edges) e.run(x.src, x.dst, x.kind);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  get(ids: readonly NodeId[], detail: Detail): StoredNode[] {
    if (ids.length === 0) return [];
    const q = this.#db.prepare(`SELECT * FROM nodes WHERE id IN (${ids.map(() => '?').join(',')})`);
    return (q.all(...ids) as Record<string, unknown>[]).map((r) => row(r, detail));
  }

  list(kind: string): StoredNode[] {
    const q = this.#db.prepare('SELECT * FROM nodes WHERE kind = ? ORDER BY id');
    return (q.all(kind) as Record<string, unknown>[]).map((r) => row(r, 'summary'));
  }

  neighbors(id: NodeId, kind?: EdgeKind): StoredEdge[] {
    const q = kind
      ? this.#db.prepare('SELECT src,dst,kind FROM edges WHERE (src = ? OR dst = ?) AND kind = ? ORDER BY src,kind,dst')
      : this.#db.prepare('SELECT src,dst,kind FROM edges WHERE src = ? OR dst = ? ORDER BY src,kind,dst');
    const rows = kind ? q.all(id, id, kind) : q.all(id, id);
    return rows as unknown as StoredEdge[];
  }

  search(query: string, opts: SearchOpts): NodeId[] {
    const safe = query.replaceAll('"', '');
    if (safe.trim() === '') return [];
    const q = this.#db.prepare(
      `SELECT f.id AS id FROM nodes_fts f JOIN nodes n ON n.id = f.id
       WHERE nodes_fts MATCH ? ${opts.kinds?.length ? `AND n.kind IN (${opts.kinds.map(() => '?').join(',')})` : ''}
       ORDER BY rank, f.id LIMIT ?`,
    );
    const args = [`"${safe}"*`, ...(opts.kinds ?? []), opts.limit];
    return (q.all(...args) as { id: string }[]).map((r) => r.id);
  }

  meta(key: string): string | undefined {
    const r = this.#db.prepare('SELECT value FROM build_meta WHERE key = ?').get(key) as { value: string } | undefined;
    return r?.value;
  }

  setMeta(key: string, value: string): void {
    this.#db.prepare('INSERT INTO build_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = ?')
      .run(key, value, value);
  }

  close(): void { this.#db.close(); }
}
