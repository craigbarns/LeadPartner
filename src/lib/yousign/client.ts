export class YousignError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message)
  }
}

function getApiKey(): string {
  const key = process.env.YOUSIGN_API_KEY
  if (!key) throw new Error('YOUSIGN_API_KEY is not configured')
  return key
}

function getApiBase(): string {
  return process.env.YOUSIGN_API_BASE ?? 'https://api-sandbox.yousign.app/v3'
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  init: { json?: unknown; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getApiKey()}`,
  }
  let body: BodyInit | undefined
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  } else if (init.form) {
    body = init.form
  }

  const res = await fetch(`${getApiBase()}${path}`, { method, headers, body })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new YousignError(res.status, data, `Yousign ${method} ${path} failed: ${res.status}`)
  }
  return data as T
}

export const yousign = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, json: unknown) => request<T>('POST', path, { json }),
  postForm: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
