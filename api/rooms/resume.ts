import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleResumeRoom } from '../../lib/roomApiHandlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleResumeRoom(req, res)
}
