import { afterEach, expect, it, vi } from 'vitest';
vi.mock('wxt/browser', () => ({ browser: {} }));
import { defaults, generate, generateImage } from './ai';
afterEach(() => vi.unstubAllGlobals());
it('OpenAI 兼容请求直接发送到用户地址并校验回复', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '结果' } }] }));
  vi.stubGlobal('fetch', fetcher);
  expect(await generate({ ...defaults, key: 'local-test-key', endpoint: 'https://own-proxy.example/v1' }, 'analyze', '素材')).toBe('结果');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://own-proxy.example/v1/chat/completions');
  expect(fetcher.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer local-test-key');
});
it('拒绝无文本的模型响应', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ choices: [] })));
  await expect(generate({ ...defaults, key: 'test' }, 'rewrite', '素材')).rejects.toThrow();
});
it('Claude 使用专用消息协议与浏览器访问头', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ content: [{ type: 'text', text: 'Claude回复' }] })); vi.stubGlobal('fetch', fetcher);
  expect(await generate({ ...defaults, provider: 'claude', key: 'test', endpoint: 'https://api.anthropic.com/v1' }, 'rewrite', '素材')).toBe('Claude回复');
  expect(fetcher.mock.calls[0]?.[1].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
});
it('Gemini 使用 generateContent 且密钥不进 URL', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: '回复' }] } }] })); vi.stubGlobal('fetch', fetcher);
  expect(await generate({ ...defaults, provider: 'gemini', key: 'secret', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'model' }, 'analyze', '素材')).toBe('回复');
  expect(fetcher.mock.calls[0]?.[0]).not.toContain('secret');
});
it('SaaS 不上传 BYOK 密钥', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ text: '结果' })); vi.stubGlobal('fetch', fetcher);
  await generate({ ...defaults, mode: 'saas', key: 'never-upload', token: 'saas-token', workerUrl: 'https://worker.example' }, 'research', '素材');
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain('never-upload');
});
it('图片调用接受 base64，不伪造生成结果', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: [{ b64_json: 'abc' }] })));
  expect(await generateImage({ ...defaults, imageKey: 'test' }, '原创封面')).toBe('data:image/png;base64,abc');
});
