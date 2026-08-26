import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { StatementMarkdown } from './statement-markdown'

function render(text: string): string {
  return renderToStaticMarkup(<StatementMarkdown text={text} />)
}

describe('StatementMarkdown', () => {
  test('renders a heading as a heading element, not literal punctuation', () => {
    const html = render('## Input')

    expect(html).toContain('Input</h3>')
    expect(html).not.toContain('##')
  })

  test('renders a fenced code block as a code element with its language kept', () => {
    const html = render('```cpp\nint press(std::string p);\n```')

    expect(html).toContain('<pre')
    expect(html).toContain('<code>int press(std::string p);\n</code>')
    expect(html).toContain('cpp')
    expect(html).not.toContain('```')
  })

  test('renders a list as list items, not dashes', () => {
    const html = render('- first\n- second')

    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('first')
    expect(html).toContain('second')
    expect(html).not.toContain('- first')
  })

  test('renders emphasis as an emphasis element, not asterisks', () => {
    const html = render('this is *important*')

    expect(html).toContain('<em>important</em>')
    expect(html).not.toContain('*important*')
  })

  test('renders inline maths through KaTeX', () => {
    const html = render('the area is $x^2$')

    expect(html).toContain('katex')
    expect(html).not.toContain('$x^2$')
  })

  test('keeps a dollar sign inside a fenced code block literal', () => {
    const html = render('```text\ncost is $5\n```')

    expect(html).toContain('cost is $5')
  })

  test('does not read an underscore inside maths as italics', () => {
    const html = render('$a_b$')

    expect(html).not.toContain('<em>')
    expect(html).toContain('katex')
  })

  test('renders a statement with no Markdown as a readable paragraph', () => {
    const html = render('Pete and Billy bought a watermelon weighing w kilos.')

    expect(html).toContain('<p')
    expect(html).toContain('Pete and Billy bought a watermelon weighing w kilos.')
  })
})
