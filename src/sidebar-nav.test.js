import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./sidebar-nav.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8')

describe('prototype sidebar navigation', () => {
  it('loads the dedicated sidebar stylesheet', () => {
    expect(main).toContain("import './sidebar-nav.css'")
  })

  it('matches the prototype row sizing and active treatment', () => {
    expect(css).toContain('height: 48px')
    expect(css).toContain('border-radius: 16px')
    expect(css).toContain('background: rgba(255, 255, 255, 0.13)')
    expect(css).toContain('font-weight: 600')
  })

  it('uses the prototype labels, icons, indicator, and badge sizing', () => {
    expect(css).toContain('content: "Overview"')
    expect(css).toContain('mask-image: url(')
    expect(css).toContain('height: 24px')
    expect(css).toContain('font-size: 10px')
  })
})
