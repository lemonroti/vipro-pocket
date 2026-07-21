import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')
const normalizedCss = css.replace(/\s+/g, '').toLowerCase()

function ruleBodies(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...normalizedCss.matchAll(new RegExp(`${escaped}\\{([^}]*)\\}`, 'g'))].map((match) => match[1])
}

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = hex.match(/[0-9a-f]{2}/g).map((channel) => Number.parseInt(channel, 16) / 255)
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

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
    const navigation = ruleBodies('.mobile-nav').find((rule) => rule.includes('position:fixed'))
    const fab = ruleBodies('.mobile-fab').find((rule) => rule.includes('z-index:45'))
    const toast = ruleBodies('.toast').find((rule) => rule.includes('env(safe-area-inset-bottom)'))

    expect(navigation).toContain('grid-template-columns:repeat(6,minmax(0,1fr))')
    expect(navigation).toContain('env(safe-area-inset-bottom)')
    expect(navigation).toContain('z-index:40')
    expect(fab).toContain('bottom:calc(5.25rem+env(safe-area-inset-bottom))')
    expect(toast).toContain('bottom:calc(9.5rem+env(safe-area-inset-bottom))')
    expect(ruleBodies('.toast').some((rule) => rule.includes('max-width:calc(100vw-2rem)'))).toBe(true)
    expect(ruleBodies('.toast')[0]).toContain('bottom:5.5rem')
    expect(normalizedCss).toMatch(/@media\(max-width:759px\)\{[^}]*\.toast\{bottom:calc\(9\.5rem\+env\(safe-area-inset-bottom\)\)/)
    expect(ruleBodies('.main')[0]).toContain('padding:01rem7rem')
    expect(ruleBodies('.modal-backdrop')[0]).toContain('z-index:50')
    expect(normalizedCss).toContain('.mobile-nav{display:none}')
    expect(normalizedCss).toContain('.mobile-fab{display:none}')
  })

  it('keeps inactive mobile labels above WCAG AA contrast', () => {
    const light = ruleBodies('.mobile-nav-link').find((rule) => rule.includes('min-height:52px'))
    const dark = ruleBodies('.dark.mobile-nav-link')[0]
    const lightColor = light?.match(/color:(#[0-9a-f]{6})/)?.[1] ?? '#ffffff'
    const darkColor = dark?.match(/color:(#[0-9a-f]{6})/)?.[1] ?? '#19221d'

    expect(contrastRatio(lightColor, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(darkColor, '#19221d')).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps all finance form controls legible in dark mode', () => {
    const darkControls = ruleBodies('.darkinput,.darkselect,.darktextarea').at(-1)

    expect(darkControls ?? '').toContain('background:#19221d')
    expect(darkControls ?? '').toContain('color:#eef4ef')
    expect(darkControls ?? '').toContain('border-color:#344139')
    expect(normalizedCss.lastIndexOf('.darkinput,.darkselect,.darktextarea{'))
      .toBeGreaterThan(normalizedCss.indexOf('.toolbarinput,.toolbarselect,.budget-iteminput'))
  })
})
