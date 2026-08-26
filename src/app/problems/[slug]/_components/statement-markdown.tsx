import { isValidElement, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

type ElementLikeProps = { className?: string; children?: ReactNode }

function readElementProps(node: ReactNode): ElementLikeProps | null {
  return isValidElement<ElementLikeProps>(node) ? node.props : null
}

function textFromChildren(node: ReactNode): string {
  if (typeof node === 'string') {
    return node
  }
  if (typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(textFromChildren).join('')
  }
  const props = readElementProps(node)
  return props ? textFromChildren(props.children) : ''
}

/**
 * A fenced code block. Rendered from the raw text of the `code` element that
 * `react-markdown` would otherwise place inside this `pre` - the language
 * class is read straight off it instead of letting the default `code`
 * component (used for inline spans) render it, so a block never picks up
 * inline-code styling.
 */
function CodeBlock({ children }: { children?: ReactNode }) {
  const codeProps = readElementProps(children)
  const language = /language-(\S+)/.exec(codeProps?.className ?? '')?.[1] ?? null
  const text = textFromChildren(codeProps?.children ?? children)

  return (
    <div className='flex flex-col gap-1'>
      {language !== null ? (
        <span className='font-mono text-muted text-xs uppercase tracking-wide'>{language}</span>
      ) : null}
      <pre className='overflow-x-auto rounded-md border border-border bg-background p-3 text-xs'>
        <code>{text}</code>
      </pre>
    </div>
  )
}

function InlineCode({ children }: { children?: ReactNode }) {
  return (
    <code className='rounded bg-placeholder px-1 py-0.5 font-mono text-[0.85em]'>{children}</code>
  )
}

/**
 * `remark-math` turns a `$$...$$` block into a hast `<div class="math
 * math-display">`, which `rehype-katex` then fills with rendered markup.
 * Only that div needs the overflow box a long formula can need - every other
 * `div` is passed through untouched, though the markdown here never produces
 * one.
 */
function MathAwareDiv({ className, children, ...rest }: ElementLikeProps) {
  if (className?.includes('math-display') === true) {
    return (
      <div className={`${className} overflow-x-auto`} {...rest}>
        {children}
      </div>
    )
  }
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  )
}

const components: Components = {
  h1: ({ children }) => <h2 className='font-semibold text-base'>{children}</h2>,
  h2: ({ children }) => <h3 className='font-semibold text-sm'>{children}</h3>,
  h3: ({ children }) => <h4 className='font-semibold text-sm'>{children}</h4>,
  p: ({ children }) => <p className='text-sm leading-relaxed'>{children}</p>,
  ul: ({ children }) => <ul className='flex flex-col gap-1 pl-5 text-sm'>{children}</ul>,
  ol: ({ children }) => <ol className='flex flex-col gap-1 pl-5 text-sm'>{children}</ol>,
  li: ({ children }) => <li className='list-outside'>{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className='border-border border-l-2 pl-3 text-muted'>{children}</blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target='_blank'
      rel='noreferrer'
      className='text-accent underline underline-offset-2'
    >
      {children}
    </a>
  ),
  pre: CodeBlock,
  code: InlineCode,
  div: MathAwareDiv
}

/**
 * Statement body as Markdown - headings, paragraphs, fenced code blocks,
 * lists, emphasis, links, block quotes - plus `$...$` and `$$...$$` through
 * KaTeX.
 *
 * `remark-math` parses the math delimiters at the same pass as the rest of
 * Markdown, ahead of `remark`'s own emphasis and inline-code tokenisers, so
 * an underscore inside `$...$` is never read as italics and a `$` inside a
 * fenced code block - whose content is never re-tokenised - is never read as
 * maths. No `rehype-raw` is used, so raw HTML in the source stays inert text.
 */
export function StatementMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-3${className !== undefined ? ` ${className}` : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
