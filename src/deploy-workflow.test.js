import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8')

describe('production workflow', () => {
  it('uses repository variables and rejects missing Supabase configuration', () => {
    expect(workflow).toContain('VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}')
    expect(workflow).toContain('VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}')
    expect(workflow).toContain('Validate public Supabase configuration')
    expect(workflow).not.toContain('placeholder.supabase.co')
  })

  it('runs feature checks once through pull requests and deploys only main', () => {
    expect(workflow).toContain('branches: [main]')
    expect(workflow).not.toContain('branches: [main, feat/supabase-production]')
    expect(workflow).toContain("github.event_name == 'push' && github.ref == 'refs/heads/main'")
  })

  it('uses maintained official action majors and bounded jobs', () => {
    expect(workflow).toContain('actions/checkout@v6')
    expect(workflow).toContain('actions/setup-node@v6')
    expect(workflow).toContain('supabase/setup-cli@v3')
    expect(workflow.match(/timeout-minutes:/g)).toHaveLength(3)
  })
})
