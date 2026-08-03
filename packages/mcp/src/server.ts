import { Workspace, type Result } from '@annona/core';

/**
 * MCP adapter. The Core does not know MCP exists (REQ-0004, ADR-0002): this
 * package depends only on the public Workspace API.
 *
 * MCP is JSON-RPC 2.0 over stdio. Implementing the three methods we need
 * directly avoids taking an SDK dependency on a protocol that will change
 * faster than the knowledge format.
 */

type Json = Record<string, unknown>;
type Tool = { name: string; description: string; inputSchema: Json; run: (args: Json, w: Workspace) => unknown };

const text = (value: unknown): Json => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

const unwrap = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`[${r.error.code}] ${r.error.message}${r.error.resolveWith ? ` — ${r.error.resolveWith}` : ''}`);
  return r.value;
};

const str = (args: Json, key: string): string => {
  const v = args[key];
  if (typeof v !== 'string' || v === '') throw new Error(`missing required argument: ${key}`);
  return v;
};

/** Seven tools. Every tool is permanent token cost in every agent session (REQ-0003). */
export const TOOLS: readonly Tool[] = [
  {
    name: 'context',
    description: 'Compile the minimum complete engineering context for a task. Start here before writing code. Returns a verdict of COMPLETE or MISSING_CONTEXT; never proceed on assumptions when knowledge is missing.',
    inputSchema: { type: 'object', properties: { task: { type: 'string' }, budget: { type: 'number' } }, required: ['task'] },
    run: (a, w) => unwrap(w.context(str(a, 'task'), typeof a['budget'] === 'number' ? a['budget'] : 8000)),
  },
  {
    name: 'get_task',
    description: 'Read one task by id, including what it implements and the components it touches.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (a, w) => unwrap(w.knowledge().get([str(a, 'id')], 'full'))[0] ?? null,
  },
  {
    name: 'get_feature',
    description: 'Read one feature by id with its intent and summary.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: (a, w) => unwrap(w.knowledge().get([str(a, 'id')], 'full'))[0] ?? null,
  },
  {
    name: 'search',
    description: 'Full-text search across project knowledge. Returns ids and summaries, not full bodies.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
    run: (a, w) => unwrap(w.knowledge().search(str(a, 'query'), typeof a['limit'] === 'number' ? a['limit'] : 20)),
  },
  {
    name: 'compile',
    description: 'Rebuild the runtime from versioned knowledge. Safe to run at any time; the runtime is disposable.',
    inputSchema: { type: 'object', properties: {} },
    run: (_a, w) => unwrap(w.compile()),
  },
  {
    name: 'check',
    description: 'Validate project knowledge against the five invariants. Errors block; warnings advise.',
    inputSchema: { type: 'object', properties: { strict: { type: 'boolean' } }, required: [] },
    run: (a, w) => unwrap(w.check(a['strict'] === true)),
  },
  {
    name: 'review',
    description: 'Report knowledge health: orphans, dead rules and decisions, missing relationships. Read-only.',
    inputSchema: { type: 'object', properties: {} },
    run: (_a, w) => unwrap(w.doctor()),
  },
];

const send = (msg: Json): void => { process.stdout.write(`${JSON.stringify(msg)}\n`); };

const handle = (req: Json, w: Workspace): Json | null => {
  const id = req['id'] as number | string | undefined;
  const method = req['method'] as string;

  if (method === 'initialize') {
    // The caller names itself in the handshake. This is the evidence that an
    // agent, not a human at a terminal, consulted Annona (REQ-0010).
    const info = ((req['params'] ?? {}) as Json)['clientInfo'] as Json | undefined;
    const name = typeof info?.['name'] === 'string' ? (info['name'] as string) : 'unknown-agent';
    w.attribute(name);
    w.trace({ command: 'mcp.initialize', durationMs: 0, ok: true, detail: name });
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'annona', version: '0.1.0' } } };
  }

  if (method === 'notifications/initialized') return null;

  if (method === 'tools/list')
    return { jsonrpc: '2.0', id, result: { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } };

  if (method === 'tools/call') {
    const params = (req['params'] ?? {}) as Json;
    const tool = TOOLS.find((t) => t.name === params['name']);
    if (!tool) return { jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool: ${String(params['name'])}` } };
    const args = (params['arguments'] ?? {}) as Json;
    const task = typeof args['task'] === 'string' ? (args['task'] as string) : undefined;
    const started = Date.now();
    try {
      const value = tool.run(args, w);
      const shape = value as { nodes?: number; used?: number } | null;
      w.trace({
        command: `mcp.${tool.name}`, durationMs: Date.now() - started, ok: true,
        ...(task ? { task } : {}),
        ...(typeof shape?.nodes === 'number' ? { nodes: shape.nodes } : {}),
        ...(typeof shape?.used === 'number' ? { tokens: shape.used } : {}),
      });
      return { jsonrpc: '2.0', id, result: value as Json };
    } catch (e) {
      w.trace({
        command: `mcp.${tool.name}`, durationMs: Date.now() - started, ok: false,
        ...(task ? { task } : {}), detail: (e as Error).message.slice(0, 120),
      });
      return { jsonrpc: '2.0', id, result: { ...text((e as Error).message), isError: true } };
    }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `unknown method: ${method}` } };
};

/** Exported for tests: one request in, one response out, no transport. */
export const handleRequest = (req: Json, w: Workspace): Json | null => {
  const res = handle(req, w);
  if (res && 'result' in res && res['result'] !== undefined && !(res['result'] as Json)['tools'] && !(res['result'] as Json)['protocolVersion'] && !(res['result'] as Json)['content'])
    return { ...res, result: text((res as Json)['result'] as unknown) };
  return res;
};

export const serve = (root: string): void => {
  const ws = Workspace.load(root);
  if (!ws.ok) { process.stderr.write(`${ws.error.message}\n`); process.exit(1); }
  const w = ws.value;
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buffer += chunk;
    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line !== '') {
        try {
          const res = handleRequest(JSON.parse(line) as Json, w);
          if (res) send(res);
        } catch (e) {
          send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: (e as Error).message } });
        }
      }
      nl = buffer.indexOf('\n');
    }
  });
  process.stdin.on('end', () => { w.close(); });
};
