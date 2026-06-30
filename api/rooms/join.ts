import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleJoinRoom } from '../../lib/roomApiHandlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await handleJoinRoom(req, res)
}
