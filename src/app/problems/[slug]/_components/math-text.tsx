import katex from 'katex'

type TextPart = { kind: 'text'; value: string }
type MathPart = { kind: 'math'; html: string; display: boolean }
type StatementPart = TextPart | MathPart

// `$$...$$` must be matched before `$...$` so a display block is never read as
// two adjacent inline runs.
const MATH_TOKEN_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g

function renderTex(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      throwOnError: false,
      displayMode: display,
      strict: 'ignore'
    })
  } catch {
    return tex
  }
}

function splitStatement(text: string): StatementPart[] {
  const parts: StatementPart[] = []
  let cursor = 0
  let match: RegExpExecArray | null = MATH_TOKEN_RE.exec(text)

  while (match !== null) {
    if (match.index > cursor) {
      parts.push({ kind: 'text', value: text.slice(cursor, match.index) })
    }

    const token = match[0]
    const display = token.startsWith('$$')
    const tex = display ? token.slice(2, -2) : token.slice(1, -1)
    parts.push({ kind: 'math', html: renderTex(tex, display), display })

    cursor = match.index + token.length
    match = MATH_TOKEN_RE.exec(text)
  }

  if (cursor < text.length) {
    parts.push({ kind: 'text', value: text.slice(cursor) })
  }

  return parts.length > 0 ? parts : [{ kind: 'text', value: text }]
}

/**
 * Statement body as plain text, with `$...$` and `$$...$$` tokenised into
 * KaTeX. No Markdown parsing - the source is never treated as anything but
 * text plus maths delimiters.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = splitStatement(text)

  return (
    <div className={className}>
      {parts.map((part, index) =>
        part.kind === 'text' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are a stable split of static text
          <span key={index} className='whitespace-pre-wrap'>
            {part.value}
          </span>
        ) : (
          // KaTeX's own HTML output - not user-controlled markup.
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: parts are a stable split of static text
            key={index}
            className={part.display ? 'my-2 block overflow-x-auto' : undefined}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX-rendered markup, not user HTML
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        )
      )}
    </div>
  )
}
