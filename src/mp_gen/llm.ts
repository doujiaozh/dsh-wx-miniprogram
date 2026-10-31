/**
 * mp_gen —— LLM 调用层。
 *
 * 零依赖：直接用 node:https POST /chat/completions，兼容 DeepSeek / OpenAI 协议。
 * 默认模型 deepseek-chat（额度充足的通用模型）；可通过环境变量整体覆盖。
 */

import * as https from 'https';

export interface LlmCallOptions {
  /** API Key；默认读 DEEPSEEK_API_KEY / OPENAI_API_KEY / MP_LLM_API_KEY */
  apiKey?: string;
  /** 服务地址，默认 https://api.deepseek.com */
  baseUrl?: string;
  /** 模型名，默认 deepseek-chat（或环境变量 LLM_MODEL） */
  model?: string;
  /** 采样温度，默认 0.7 */
  temperature?: number;
  /** 超时毫秒，默认 120000 */
  timeoutMs?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResult {
  /** 模型回复正文 */
  content: string;
  /** 实际使用的模型名 */
  model: string;
}

/** 解析 base url 为 { host, pathPrefix, port }，兼容带/不带路径与协议 */
function parseBaseUrl(baseUrl: string): { host: string; pathPrefix: string; port: number } {
  let url = baseUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const u = new URL(url);
  return {
    host: u.hostname,
    pathPrefix: u.pathname.replace(/\/+$/, ''),
    port: u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80,
  };
}

/**
 * 调用 chat/completions，返回消息正文。
 * 强制 response_format = json_object，配合 SYSTEM_PROMPT 保证输出严格 JSON。
 */
export function callLLM(messages: ChatMessage[], opts: LlmCallOptions = {}): Promise<LlmResult> {
  const apiKey =
    opts.apiKey ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.MP_LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      '缺少 LLM API Key：请传 apiKey 参数，或设置环境变量 DEEPSEEK_API_KEY / OPENAI_API_KEY / MP_LLM_API_KEY。',
    );
  }

  const baseUrl = (opts.baseUrl || process.env.LLM_BASE_URL || 'https://api.deepseek.com').trim();
  const model = opts.model || process.env.LLM_MODEL || 'deepseek-chat';
  const temperature = opts.temperature ?? 0.7;
  const timeoutMs = opts.timeoutMs ?? 120000;

  const { host, pathPrefix, port } = parseBaseUrl(baseUrl);

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    response_format: { type: 'json_object' },
    stream: false,
  });

  return new Promise<LlmResult>((resolve, reject) => {
    const req = https.request(
      {
        host,
        port,
        path: pathPrefix + '/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            reject(new Error(`LLM 请求失败 HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
            return;
          }
          try {
            const data = JSON.parse(text);
            const content = data?.choices?.[0]?.message?.content;
            if (typeof content !== 'string' || !content.trim()) {
              reject(new Error('LLM 返回为空：' + text.slice(0, 300)));
              return;
            }
            resolve({ content, model: data.model || model });
          } catch (err) {
            reject(new Error(`LLM 响应解析失败: ${(err as Error).message}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`LLM 请求超时（${timeoutMs}ms）`));
    });
    req.write(body);
    req.end();
  });
}
