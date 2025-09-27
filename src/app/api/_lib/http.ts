export function j(data: unknown, status = 200, headers: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      ...headers,
    },
  });
}
export const ok  = (data: object = {}) => j({ ok: true, ...data }, 200);
export const err = (msg = 'Bad Request', status = 400) => j({ ok: false, error: msg }, status);
export const OPTIONS = () => j({}, 204);
