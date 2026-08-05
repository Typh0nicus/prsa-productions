// Shared HTTP transport for the data tools.
// Node's own fetch is blocked outbound on Typhon's Windows box (node.exe times out on
// connect while curl.exe goes straight through), so every request tries fetch first and
// falls back to the system curl. Both paths return plain text; callers parse.
import { execFileSync } from 'node:child_process';

export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const TIMEOUT_MS = 45000;
let fetchWorks = null; // null = untested, false = blocked (skip straight to curl)

const curl = (url, { headers = {}, body = null } = {}) => {
  const args = ['-s', '-S', '--fail-with-body', '--compressed', '--max-time', String(Math.round(TIMEOUT_MS / 1000)), '-A', UA];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (body != null) args.push('-X', 'POST', '--data-binary', '@-');
  args.push(url);
  return execFileSync('curl', args, {
    input: body == null ? undefined : body,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
};

export const request = async (url, { headers = {}, body = null } = {}) => {
  if (fetchWorks !== false) {
    try {
      const res = await fetch(url, {
        method: body == null ? 'GET' : 'POST',
        headers: { 'User-Agent': UA, ...headers },
        body: body ?? undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      fetchWorks = true;
      const text = await res.text();
      if (!res.ok) throw new Error(`${url} -> ${res.status}`);
      return text;
    } catch (err) {
      if (fetchWorks === true) throw err; // fetch works here; this is a real failure
      fetchWorks = false; // first attempt failed outright — this box blocks node sockets
    }
  }
  return curl(url, { headers, body });
};

export const getText = (url, headers) => request(url, { headers });
export const getJson = async (url, headers) => JSON.parse(await request(url, { headers: { Accept: 'application/json', ...headers } }));
export const postJson = async (url, payload, headers) =>
  JSON.parse(await request(url, { headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(payload) }));

export const transport = () => (fetchWorks === false ? 'curl' : fetchWorks === true ? 'fetch' : 'untested');
