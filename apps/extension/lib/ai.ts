import { z } from 'zod';
import { browser } from 'wxt/browser';
import { prompts, systemPrompt, type Task } from './prompts';
export const settingsSchema = z.object({
  mode: z.enum(['byok', 'saas']).default('byok'), provider: z.enum(['openai', 'claude', 'gemini', 'deepseek', 'custom']).default('openai'),
  endpoint: z.string().default('https://api.openai.com/v1'), key: z.string().default(''), model: z.string().default('gpt-4o-mini'),
  vision: z.boolean().default(false), imageEndpoint: z.string().default('https://api.openai.com/v1'), imageKey: z.string().default(''), imageModel: z.string().default('gpt-image-1'),
  workerUrl: z.string().default(''), token: z.string().default(''),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaults = settingsSchema.parse({});
export async function loadSettings() { const data = await browser.storage.local.get('settings'); return settingsSchema.parse(data.settings ?? {}); }
export async function storeSettings(settings: Settings) { await browser.storage.local.set({ settings: settingsSchema.parse(settings) }); }
async function requestPermission(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('接口必须使用 HTTPS（本机代理除外）');
  if (!(await browser.permissions.request({ origins: [`${url.origin}/*`] }))) throw new Error('未授予接口访问权限');
}
export async function authorize(settings: Settings, image = false) {
  await requestPermission(settings.mode === 'saas' ? settings.workerUrl : image ? settings.imageEndpoint : settings.endpoint);
}
async function jsonRequest(url: string, headers: Record<string,string>, body: unknown) {
  let response: Response;
  try { response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) }); }
  catch { throw new Error('接口连接失败或超时，请检查网络、跨域策略；可配置用户自有代理。密钥不会转发到开发者服务器。'); }
  if (!response.ok) throw new Error(`接口返回 HTTP ${response.status}，请检查权限、模型、密钥或额度。`);
  return response.json() as Promise<unknown>;
}
const chatSchema = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().min(1) }) })).min(1) });
export async function generate(settings: Settings, task: Task, input: string, images: string[] = []): Promise<string> {
  if (images.length && !settings.vision) throw new Error('请先配置支持视觉输入的模型并启用视觉能力');
  const user = `${prompts[task]}\n用户提供的素材和要求：\n${input}`;
  if (settings.mode === 'saas') {
    const result = z.object({ text: z.string().min(1) }).parse(await jsonRequest(`${settings.workerUrl.replace(/\/$/, '')}/v1/generate`, { Authorization: `Bearer ${settings.token}` }, { task, input, images }));
    return result.text;
  }
  if (!settings.key || !settings.model) throw new Error('请先配置 API Key 和模型');
  const base = settings.endpoint.replace(/\/$/, '');
  if (settings.provider === 'claude') {
    if (images.length) throw new Error('当前 Claude 适配器仅支持文本；视觉分析请使用 OpenAI 兼容视觉模型');
    const result = z.object({ content: z.array(z.object({ type: z.string(), text: z.string().optional() })) }).parse(await jsonRequest(`${base}/messages`, { 'x-api-key': settings.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, { model: settings.model, max_tokens: 8192, system: systemPrompt, messages: [{ role: 'user', content: user }] }));
    const text = result.content.map(c => c.text ?? '').join('\n');
    if (!text) throw new Error('模型未返回文本'); return text;
  }
  if (settings.provider === 'gemini') {
    if (images.length) throw new Error('当前 Gemini 适配器仅支持文本；视觉分析请使用 OpenAI 兼容视觉模型');
    const result = z.object({ candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }) })).min(1) }).parse(await jsonRequest(`${base}/models/${encodeURIComponent(settings.model)}:generateContent`, { 'x-goog-api-key': settings.key }, { system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ parts: [{ text: user }] }] }));
    const text = result.candidates[0]!.content.parts.map(p => p.text ?? '').join('\n');
    if (!text) throw new Error('模型未返回文本'); return text;
  }
  const result = chatSchema.parse(await jsonRequest(`${base}/chat/completions`, { Authorization: `Bearer ${settings.key}` }, { model: settings.model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: images.length ? [{ type: 'text', text: user }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))] : user }] }));
  return result.choices[0]!.message.content;
}
export async function generateImage(settings: Settings, prompt: string): Promise<string> {
  if (settings.mode === 'saas') throw new Error('SaaS 图片服务尚未配置，请使用图片 BYOK');
  if (!settings.imageKey) throw new Error('请配置图片 API Key');
  const result = z.object({ data: z.array(z.object({ url: z.string().url().optional(), b64_json: z.string().optional() })).min(1) }).parse(await jsonRequest(`${settings.imageEndpoint.replace(/\/$/, '')}/images/generations`, { Authorization: `Bearer ${settings.imageKey}` }, { model: settings.imageModel, prompt: `生成原创封面或配图，不复制参考作品。${prompt}`, n: 1, size: '1024x1024' }));
  const image = result.data[0]!;
  if (image.b64_json) return `data:image/png;base64,${image.b64_json}`;
  if (image.url?.startsWith('https://')) return image.url;
  throw new Error('图片接口没有返回可用图片');
}
