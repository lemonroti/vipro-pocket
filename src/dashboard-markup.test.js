import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const dashboardUrl = new URL('./components/finance/FinanceDashboard.vue', import.meta.url)
const app = existsSync(dashboardUrl) ? readFileSync(dashboardUrl, 'utf8') : ''

describe('prototype dashboard markup', () => {
  it('contains the complete prototype sidebar structure', () => {
    expect(app).toContain('sidebar-link')
    expect(app).toContain('nav-indicator')
    expect(app).toContain('transaction-count')
    expect(app).toContain('sidebar-profile')
  })

  it('reuses every destination in an accessible mobile navigation', () => {
    expect(app).toContain('<nav class="mobile-nav" aria-label="Primary navigation">')
    expect(app).toMatch(/<button\s+v-for="item in navigation"/)
    expect(app).toContain('class="mobile-nav-link"')
    expect(app).toContain(':aria-label="item.label"')
    expect(app).toContain(':aria-current="activePage === item.id ? \'page\' : undefined"')
    expect(app).toContain('@click="switchPage(item.id)"')
    expect(app).toContain('<component :is="item.icon" :size="20" />')
    expect(app).toContain('<span>{{ item.mobileLabel }}</span>')
    expect(app.match(/v-for="item in navigation"/g)?.length).toBe(2)
    expect(app.match(/mobileLabel:/g)?.length).toBe(6)
  })

  it('returns scroll and focus to the page heading when switching destinations', () => {
    expect(app).toContain('<h1 ref="pageHeading" tabindex="-1">{{ pageTitle }}</h1>')
    expect(app).toContain("window.scrollTo({ top: 0, behavior: 'auto' })")
    expect(app).toContain('pageHeading.value?.focus({ preventScroll: true })')
  })

  it('contains the circular budget gauge and four metric cards', () => {
    expect(app).toContain('budget-ring')
    expect(app).toContain('metric-grid')
    expect(app.match(/class="metric-card/g)?.length).toBe(4)
  })

  it('contains top spending and recent transaction sections', () => {
    expect(app).toContain('top-spending-list')
    expect(app).toContain('recent-transactions-card')
  })
})
