import { describe, expect, it } from 'vitest'
import { buildHashRouteUrl } from './auth-redirect'

describe('buildHashRouteUrl', () => {
  it('builds a GitHub Pages hash route', () => {
    expect(buildHashRouteUrl('https://lemonroti.github.io', '/vipro-pocket/', 'update-password'))
      .toBe('https://lemonroti.github.io/vipro-pocket/#/update-password')
  })

  it('normalizes missing slashes', () => {
    expect(buildHashRouteUrl('https://example.com/', 'vipro-pocket', '/login'))
      .toBe('https://example.com/vipro-pocket/#/login')
  })
})
