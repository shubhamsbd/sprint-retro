import type { VercelRequest, VercelResponse } from '@vercel/node'

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader('Allow', allowed.join(', '))
  res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export async function readJsonBody<T>(req: VercelRequest): Promise<T | null> {
  if (!req.body) return null
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T
    } catch {
      return null
    }
  }
  return req.body as T
}
