import { DEFAULT_COLUMNS, type ClientRoomState } from '../types'

export function getRetroDisplayTitle(state: ClientRoomState): string {
  const trimmed = state.title?.trim()
  return trimmed || 'Team board'
}

export function getExportHeaderTitle(state: ClientRoomState): string {
  const display = getRetroDisplayTitle(state)
  if (display === 'Team board') {
    return `Sprint Retrospective — ${state.roomId}`
  }
  return display
}

function formatReactions(reactions: Record<string, string[]> | undefined): string {
  if (!reactions || Object.keys(reactions).length === 0) return ''
  return Object.entries(reactions)
    .map(([emoji, ids]) => `${emoji}${ids.length}`)
    .join(' ')
}

function formatCommentSummary(state: ClientRoomState, cardId: string): string {
  const card = state.cards.find((c) => c.id === cardId)
  if (!card?.comments?.length) return ''

  const participantsById = new Map(state.participants.map((p) => [p.id, p.name]))
  const topLevel = card.comments.filter((c) => !c.parentId)
  return topLevel
    .map((comment) => {
      const author = participantsById.get(comment.authorId) ?? 'Unknown'
      return `${author}: ${comment.text.replace(/\n/g, ' ')}`
    })
    .join(' | ')
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function formatExportSummary(state: ClientRoomState): string {
  const lines: string[] = [`# ${getExportHeaderTitle(state)}`, '']
  if (state.title?.trim()) {
    lines.push(`Room code: \`${state.roomId}\``, '')
  }
  const columns = state.columns?.length ? state.columns : DEFAULT_COLUMNS

  for (const column of columns) {
    lines.push(`## ${column.label}`)
    const cards = state.cards.filter((c) => c.columnId === column.id)
    if (cards.length === 0) {
      lines.push('- _(none)_')
    } else {
      for (const card of cards) {
        const prefix = column.isActionItems ? '- [ ] ' : '- '
        const emojiPrefix = card.emoji ? `${card.emoji} ` : ''
        const voteNote =
          card.votes.length > 0 ? ` _(${card.votes.length} vote${card.votes.length === 1 ? '' : 's'})_` : ''
        const reactionNote =
          card.reactions && Object.keys(card.reactions).length > 0
            ? ` _(${formatReactions(card.reactions)})_`
            : ''
        lines.push(`${prefix}${emojiPrefix}${card.text.replace(/\n/g, ' ')}${voteNote}${reactionNote}`)

        const commentSummary = formatCommentSummary(state, card.id)
        if (commentSummary) {
          lines.push(`  - 💬 ${commentSummary}`)
        }
      }
    }
    lines.push('')
  }

  lines.push(`_${state.participants.length} participants · phase: ${state.phase}_`)
  return lines.join('\n')
}

export function formatExportCsv(state: ClientRoomState): string {
  const lines: string[] = []
  lines.push(`Field,Value`)
  lines.push(`${csvEscape('Retro title')},${csvEscape(getExportHeaderTitle(state))}`)
  lines.push(`${csvEscape('Room code')},${csvEscape(state.roomId)}`)
  lines.push(`${csvEscape('Phase')},${csvEscape(state.phase)}`)
  lines.push(`${csvEscape('Participants')},${csvEscape(String(state.participants.length))}`)
  lines.push('')

  const columns = state.columns?.length ? state.columns : DEFAULT_COLUMNS
  lines.push(
    [
      'Column',
      'Card',
      'Emoji',
      'Votes',
      'Reactions',
      'Comments',
      'Action item',
    ].join(','),
  )

  for (const column of columns) {
    const cards = state.cards.filter((c) => c.columnId === column.id)
    if (cards.length === 0) {
      lines.push(
        [
          csvEscape(column.label),
          csvEscape(''),
          csvEscape(''),
          csvEscape('0'),
          csvEscape(''),
          csvEscape(''),
          csvEscape(column.isActionItems ? 'Yes' : 'No'),
        ].join(','),
      )
      continue
    }

    for (const card of cards) {
      lines.push(
        [
          csvEscape(column.label),
          csvEscape(card.text.replace(/\n/g, ' ')),
          csvEscape(card.emoji ?? ''),
          csvEscape(String(card.votes.length)),
          csvEscape(formatReactions(card.reactions)),
          csvEscape(formatCommentSummary(state, card.id)),
          csvEscape(column.isActionItems ? 'Yes' : 'No'),
        ].join(','),
      )
    }
  }

  return lines.join('\n')
}

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  return cleaned || 'retro-export'
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadMarkdownExport(state: ClientRoomState) {
  const title = sanitizeFilename(getExportHeaderTitle(state))
  downloadTextFile(formatExportSummary(state), `${title}.md`, 'text/markdown;charset=utf-8')
}

export function downloadCsvExport(state: ClientRoomState) {
  const title = sanitizeFilename(getExportHeaderTitle(state))
  downloadTextFile(`\uFEFF${formatExportCsv(state)}`, `${title}.csv`, 'text/csv;charset=utf-8')
}
