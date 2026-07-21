import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
const normalizedCss = css.replace(/\s+/g, '').toLowerCase()

describe('desktop app layout', () => {
  it('uses a fixed sidebar grid without offsetting a full-width main panel', () => {
    expect(normalizedCss).toContain('grid-template-columns:250pxminmax(0,1fr)')
    expect(normalizedCss).toContain('grid-column:2')
    expect(normalizedCss).toContain('margin-left:0')
  })

  it('keeps dashboard content aligned to the prototype container width', () => {
    expect(normalizedCss).toContain('max-width:1500px')
    expect(normalizedCss).toContain('grid-template-columns:minmax(0,1.45fr)minmax(340px,.9fr)')
  })

  it('provides a safe-area-aware six-destination mobile navigation', () => {
    expect(normalizedCss).toContain('.mobile-nav{')
    expect(normalizedCss).toContain('grid-template-columns:repeat(6,minmax(0,1fr))')
    expect(normalizedCss).toContain('env(safe-area-inset-bottom)')
    expect(normalizedCss).toContain('.mobile-nav{display:none}')
    expect(normalizedCss).toContain('.mobile-fab{display:none}')
  })
})
