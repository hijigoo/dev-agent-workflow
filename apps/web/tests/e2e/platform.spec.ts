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
  await page.goto('http://127.0.0.1:8001/')
  await expect(page.getByRole('heading', { name: '개발 요청을 Cloud Agent 작업으로 정리합니다.' })).toBeVisible()
  await page.getByRole('button', { name: '작업 요청 생성' }).click()

  await expect(page.getByRole('status')).toContainText('Issue 미리보기가 생성되었습니다')
  await expect(page.getByText('미리보기 전용')).toBeVisible()
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
