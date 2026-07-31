import { expect, test } from '@playwright/test'

test('reserves a room through the real meeting API', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Find the right room, right now.' })).toBeVisible()
  await expect(page.getByText('Demo data', { exact: false })).toHaveCount(0)

  await page.getByRole('button', { name: /Reserve Atlas/ }).click()
  await page.getByLabel('Meeting title').fill('Cloud Agent review')
  await page.getByRole('button', { name: 'Confirm reservation' }).click()

  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible()
  await expect(page.getByText('Cloud Agent review')).toBeVisible()
})

test('creates a local GitHub issue preview through Work Intake', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Work Intake' }).click()
  await page.getByRole('button', { name: 'Generate work item' }).click()

  await expect(page.getByRole('status')).toContainText('created by the intake service')
  await expect(page.getByText('Preview only — no issue URL delivered')).toBeVisible()
  await expect(page.getByText('External key', { exact: true })).toBeVisible()
})
