import type { ToolResult } from '../types.js';

export async function webFetch(args: { url: string; method?: string; headers?: Record<string, string> }): Promise<ToolResult> {
  try {
    const url = args.url;
    if (!/^https?:\/\//i.test(url)) {
      return {
        id: '',
        name: 'web_fetch',
        result: `Invalid URL: ${url}. Must start with http:// or https://`,
        success: false,
        error: 'Invalid URL',
      };
    }

    const res = await fetch(url, {
      method: args.method ?? 'GET',
      headers: {
        'User-Agent': 'OmniLLM/1.0',
        ...(args.headers ?? {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = res.headers.get('content-type') ?? '';
    const isText = contentType.includes('text') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('javascript');

    if (!isText) {
      return {
        id: '',
        name: 'web_fetch',
        result: `Fetched ${url} (${res.status}): ${contentType} — ${res.headers.get('content-length') ?? 'unknown'} bytes`,
        success: true,
      };
    }

    const text = await res.text();
    const trimmed = text.slice(0, 50000);
    const truncated = text.length > 50000 ? `\n\n[...truncated ${text.length - 50000} more bytes]` : '';

    return {
      id: '',
      name: 'web_fetch',
      result: `URL: ${url} (${res.status})\n\n${trimmed}${truncated}`,
      success: true,
    };
  } catch (err: any) {
    return {
      id: '',
      name: 'web_fetch',
      result: `Fetch failed: ${err.message}`,
      success: false,
      error: err.message,
    };
  }
}
