import { prompts, systemPrompt } from '../../extension/lib/prompts';
interface Env { DB: D1Database; AI_KEY: string; AI_ENDPOINT: string; AI_MODEL: string }
const json = (body: unknown, status = 200) => Response.json(body, { status });
async function hash(token: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))].map(b => b.toString(16).padStart(2,'0')).join(''); }
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ service: 'ViralLens', status: 'ok' });
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return json({ error: 'unauthorized' }, 401);
    try {
      const user = await env.DB.prepare('SELECT id, credits FROM users WHERE token_hash = ?').bind(await hash(token)).first<{id:string;credits:number}>();
      if (!user) return json({ error: 'unauthorized' }, 401);
      if (url.pathname === '/v1/account' && request.method === 'GET') return json({ id: user.id, credits: user.credits, subscription: await env.DB.prepare('SELECT status,plan,expires_at FROM subscriptions WHERE user_id = ?').bind(user.id).first() });
      if (url.pathname !== '/v1/generate' || request.method !== 'POST') return json({ error: 'not_found' }, 404);
      if (!env.AI_KEY) return json({ error: 'provider_not_configured' }, 503);
      if (Number(request.headers.get('content-length') ?? 0) > 200000) return json({ error: 'payload_too_large' }, 413);
      const raw = await request.text();
      if (raw.length > 200000) return json({ error: 'payload_too_large' }, 413);
      const body: unknown = JSON.parse(raw);
      if (!body || typeof body !== 'object' || !('task' in body) || typeof body.task !== 'string' || !Object.hasOwn(prompts, body.task) || !('input' in body) || typeof body.input !== 'string' || !body.input.trim()) return json({ error: 'invalid_request' }, 400);
      if ('images' in body && Array.isArray(body.images) && body.images.length) return json({ error: 'saas_vision_not_configured' }, 400);
      const task = body.task as keyof typeof prompts;
      const id = crypto.randomUUID();
      // Atomic conditional debit: concurrency cannot spend the same credit twice.
      const debit = await env.DB.prepare("UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0 AND (SELECT COUNT(*) FROM usage_records WHERE user_id = ? AND created_at > datetime('now','-1 minute')) < 10 RETURNING id").bind(user.id,user.id).first();
      if (!debit) return json({ error: 'quota_or_rate_limit' }, 429);
      await env.DB.prepare("INSERT INTO usage_records(id,user_id,task,status) VALUES(?,?,?,'pending')").bind(id,user.id,task).run();
      try {
        const response = await fetch(`${env.AI_ENDPOINT.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_KEY}` }, body: JSON.stringify({ model: env.AI_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `${prompts[task]}\n${body.input}` }] }), signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error('provider_failed');
        const result = await response.json() as { choices?: {message?:{content?:unknown}}[] };
        const text = result.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error('invalid_provider_response');
        await env.DB.prepare("UPDATE usage_records SET status = 'success' WHERE id = ?").bind(id).run();
        return json({ text, usageId: id });
      } catch {
        await env.DB.batch([env.DB.prepare('UPDATE users SET credits = credits + 1 WHERE id = ?').bind(user.id), env.DB.prepare("UPDATE usage_records SET status = 'failed_refunded' WHERE id = ?").bind(id)]);
        return json({ error: 'provider_failed_refunded' }, 502);
      }
    } catch { return json({ error: 'invalid_request_or_service_unavailable' }, 400); }
  },
} satisfies ExportedHandler<Env>;
