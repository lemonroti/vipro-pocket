import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

describe('desktop app layout', () => {
  it('uses a fixed sidebar grid without offsetting a full-width main panel', () => {
    expect(css).toContain('grid-template-columns: 250px minmax(0,1fr)')
    expect(css).toContain('grid-column: 2')
    expect(css).toContain('margin-left: 0')
  })

  it('keeps dashboard content aligned to the prototype container width', () => {
    expect(css).toContain('max-width: 1500px')
    expect(css).toContain('grid-template-columns: minmax(0,1.45fr) minmax(340px,.9fr)')
  })
})
