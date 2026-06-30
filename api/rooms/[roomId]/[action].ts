import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  handleRoomAction,
  handleRoomInfo,
  handleRoomStream,
} from '../../../lib/roomApiHandlers.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const roomId = req.query.roomId
  const action = req.query.action

  if (typeof roomId !== 'string' || typeof action !== 'string') {
    res.status(404).json({ ok: false, error: 'Not found' })
    return
  }

  if (action === 'info') {
    await handleRoomInfo(req, res, roomId)
    return
  }

  if (action === 'stream') {
    await handleRoomStream(req, res, roomId)
    return
  }

  await handleRoomAction(req, res, roomId, action)
}
