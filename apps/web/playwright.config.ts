import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'rm -f /tmp/cloud-agent-e2e-meeting.sqlite3 && MEETING_API_DATABASE=/tmp/cloud-agent-e2e-meeting.sqlite3 python3 -m uvicorn meeting_api.main:app --app-dir ../api --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'rm -f /tmp/cloud-agent-e2e-intake.sqlite3 && GITHUB_TOKEN= GITHUB_REPOSITORY= WORK_INTAKE_DATABASE=/tmp/cloud-agent-e2e-intake.sqlite3 python3 -m uvicorn work_intake.main:app --app-dir ../work-intake --host 127.0.0.1 --port 8001',
      url: 'http://127.0.0.1:8001/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
