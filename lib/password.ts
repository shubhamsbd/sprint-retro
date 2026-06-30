import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex')
}

export function createPasswordRecord(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex')
  return { salt, hash: hashPassword(password, salt) }
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = hashPassword(password, salt)
  if (candidate.length !== hash.length) return false
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash))
}
