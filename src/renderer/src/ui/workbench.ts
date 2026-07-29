export interface WorkbenchChoice {
  id: string
  label: string
  value: string
}

export type WorkbenchKind = 'report' | 'choices' | 'long-answer' | null

export interface WorkbenchDocument {
  kind: WorkbenchKind
  title: string
  markdown: string
  choices: WorkbenchChoice[]
  shouldOpen: boolean
}

const BLOCK_PATTERN = /:::([a-zA-Z-]+)\s*\n([\s\S]*?)\n:::/g
const CHOICE_INTRO_PATTERN = /(请选择|选择一个|选一个|做个选择|你想|是否|确认|哪种|哪个|哪一个|方案选择|可选方案|选项)/

export function parseWorkbenchContent(content: string): WorkbenchDocument {
  const source = content.trim()
  if (!source) {
    return emptyWorkbenchDocument()
  }

  const blocks = Array.from(source.matchAll(BLOCK_PATTERN))
  const reportBlocks = blocks.filter((block) => block[1].toLowerCase() === 'report').map((block) => block[2].trim())
  const choiceBlocks = blocks.filter((block) => block[1].toLowerCase() === 'choices').map((block) => block[2])
  let choices = choiceBlocks.flatMap(parseChoiceBlock)
  const withoutBlocks = source.replace(BLOCK_PATTERN, '').trim()
  let markdown = reportBlocks.length > 0 ? reportBlocks.join('\n\n') : withoutBlocks
  if (choices.length === 0) {
    const inferred = inferTrailingChoices(markdown)
    markdown = inferred.markdown
    choices = inferred.choices
  }
  const structured = looksLikeStructuredMarkdown(markdown)
  const kind: WorkbenchKind = reportBlocks.length > 0 ? 'report' : choices.length > 0 ? 'choices' : structured ? 'long-answer' : null

  return {
    kind,
    title: extractTitle(markdown, choices.length > 0 ? '选择' : '工作台'),
    markdown,
    choices,
    shouldOpen: kind !== null
  }
}

export function createOpenWorkbenchDocument(content: string, fallbackTitle = '回应'): WorkbenchDocument {
  const document = parseWorkbenchContent(content)
  if (document.shouldOpen) {
    return document
  }

  return {
    ...document,
    kind: 'long-answer',
    title: document.title === '工作台' ? fallbackTitle : document.title,
    markdown: document.markdown || stripWorkbenchMarkup(content),
    shouldOpen: true
  }
}

export function stripWorkbenchMarkup(content: string): string {
  return content
    .replace(/:::choices\s*\n[\s\S]*?(?:\n:::|$)/gi, '')
    .replace(/:::report\s*\n([\s\S]*?)(?:\n:::|$)/gi, '$1')
    .trim()
}

function inferTrailingChoices(markdown: string): { markdown: string; choices: WorkbenchChoice[] } {
  const lines = markdown.split(/\r?\n/)
  let end = lines.length - 1
  while (end >= 0 && !lines[end].trim()) {
    end -= 1
  }

  let start = end
  while (start >= 0 && isChoiceListLine(lines[start])) {
    start -= 1
  }

  const choiceLines = lines.slice(start + 1, end + 1)
  if (choiceLines.length < 2 || choiceLines.length > 6) {
    return { markdown, choices: [] }
  }

  const intro = lines.slice(Math.max(0, start - 2), start + 1).join('\n')
  if (!CHOICE_INTRO_PATTERN.test(intro)) {
    return { markdown, choices: [] }
  }

  const choices = choiceLines
    .map((line, index) => parseChoiceLine(line.replace(/^\s*(?:[-*]\s+|\d+[.)、]\s+|[a-zA-Z][.)、]\s+)/, ''), index))
    .filter((choice): choice is WorkbenchChoice => choice !== null)

  if (choices.length !== choiceLines.length) {
    return { markdown, choices: [] }
  }

  return {
    markdown: lines.slice(0, start + 1).join('\n').trim(),
    choices
  }
}

function isChoiceListLine(line: string): boolean {
  return /^\s*(?:[-*]\s+|\d+[.)、]\s+|[a-zA-Z][.)、]\s+)\S+/.test(line)
}

function emptyWorkbenchDocument(): WorkbenchDocument {
  return {
    kind: null,
    title: '工作台',
    markdown: '',
    choices: [],
    shouldOpen: false
  }
}

function parseChoiceBlock(block: string): WorkbenchChoice[] {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseChoiceLine(line, index))
    .filter((choice): choice is WorkbenchChoice => choice !== null)
}

function parseChoiceLine(line: string, index: number): WorkbenchChoice | null {
  const bare = line.replace(/^[-*]\s+/, '').trim()
  if (!bare) {
    return null
  }

  const explicit = bare.match(/^\[([^\]]+)\]\s*(.+)$/)
  const idSeed = explicit?.[1]?.trim() || `choice-${index + 1}`
  const body = (explicit?.[2] || bare).trim()
  const [labelPart, valuePart] = body.split(/\s+\|\s+/, 2)
  const label = labelPart.trim()
  if (!label) {
    return null
  }

  return {
    id: slugify(idSeed, index),
    label,
    value: (valuePart || label).trim()
  }
}

function looksLikeStructuredMarkdown(markdown: string): boolean {
  if (markdown.length >= 420) {
    return true
  }

  return /(^|\n)(#{1,3}\s+|[-*]\s+|\|.+\||```)/.test(markdown)
}

function extractTitle(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#{1,3}\s+(.+)$/m)
  if (heading?.[1]) {
    return heading[1].trim().slice(0, 48)
  }
  return fallback
}

function slugify(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || `choice-${index + 1}`
}
