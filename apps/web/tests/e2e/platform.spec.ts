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

test('runs the deterministic Mini Agent and displays pipeline evidence', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mini Agent' }).click()
  await page.getByRole('button', { name: 'Run Mini Agent' }).click()

  await expect(page.getByRole('status')).toContainText('Choose a room')
  await expect(page.getByText('reservation-help', { exact: true })).toBeVisible()
  await expect(page.getByText('classify:reservation-help')).toBeVisible()
})

test('classifies Korean room-search request via Mini Agent', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Mini Agent' }).click()

  await page.getByRole('textbox', { name: 'Message' }).fill('화상회의가 가능한 10명 회의실을 찾아줘')
  await page.getByRole('button', { name: 'Run Mini Agent' }).click()

  await expect(page.getByRole('status')).toContainText('Use capacity and equipment filters')
  await expect(page.getByText('room-search', { exact: true })).toBeVisible()
  await expect(page.getByText('classify:room-search')).toBeVisible()
})
