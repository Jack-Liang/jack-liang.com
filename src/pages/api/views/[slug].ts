import type { APIContext } from 'astro';
import { env as cfEnv } from 'cloudflare:workers';

// 站点其余部分保持静态预渲染，仅此端点在 Worker 上按需执行
export const prerender = false;

// 与 glob loader 的 id 约束一致：文件名去掉扩展名
const SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/;

// 最小 D1 结构类型，避免为此引入 @cloudflare/workers-types
interface Statement {
    bind(...values: unknown[]): Statement;
    first<T>(): Promise<T | null>;
    run(): Promise<unknown>;
}
interface Env {
    DB: { prepare(query: string): Statement };
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
}

// 访客指纹：IP + UA 的 SHA-256，不落原始 IP；配合 view_visits 实现「同访客同一天同一篇只计一次」
async function visitorHash(request: Request): Promise<string> {
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const ua = request.headers.get('user-agent') ?? '';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}`));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function handler(context: APIContext): Promise<Response> {
    const slug = context.params.slug ?? '';
    if (!SLUG_PATTERN.test(slug)) return json({ error: 'invalid slug' }, 400);

    const env = cfEnv as unknown as Env;
    if (!env?.DB) return json({ error: 'database unavailable' }, 503);

    if (context.request.method === 'GET') {
        const row = await env.DB.prepare('SELECT count FROM page_views WHERE slug = ?1').bind(slug).first<{ count: number }>();
        return json({ views: row?.count ?? 0 });
    }

    // POST：先写去重表，插入成功（当天首次访问）才累加总数，天然防刷新刷量
    const day = new Date().toISOString().slice(0, 10);
    const inserted = await env.DB.prepare('INSERT INTO view_visits (slug, visitor, day) VALUES (?1, ?2, ?3) ON CONFLICT DO NOTHING RETURNING 1')
        .bind(slug, await visitorHash(context.request), day)
        .first();
    if (inserted) {
        await env.DB.prepare('INSERT INTO page_views (slug, count) VALUES (?1, 1) ON CONFLICT (slug) DO UPDATE SET count = count + 1').bind(slug).run();
    }
    const row = await env.DB.prepare('SELECT count FROM page_views WHERE slug = ?1').bind(slug).first<{ count: number }>();
    return json({ views: row?.count ?? 0 });
}

export const GET = handler;
export const POST = handler;
