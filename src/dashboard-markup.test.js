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
    expect(app).toContain('class="mobile-nav-link"')
    expect(app).toContain(':aria-current="activePage === item.id ? \'page\' : undefined"')
    expect(app.match(/v-for="item in navigation"/g)?.length).toBe(2)
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
