import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleCreateRoom } from '../../lib/roomApiHandlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleCreateRoom(req, res)
}
