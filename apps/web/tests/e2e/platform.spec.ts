import { expect, test } from '@playwright/test'

test('reserves a room through the real meeting API', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '지금 바로 맞는 회의실을 찾아보세요.' })).toBeVisible()
  await expect(page.getByText('데모 데이터', { exact: false })).toHaveCount(0)

  await page.getByRole('button', { name: /Atlas 예약/ }).click()
  await page.getByLabel('회의 제목').fill('Cloud Agent review')
  await page.getByRole('button', { name: '예약 확정' }).click()

  await expect(page.getByRole('heading', { name: '예약' })).toBeVisible()
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
  await page.getByRole('button', { name: '미니 에이전트' }).click()
  await page.getByRole('textbox', { name: '메시지' }).fill('How do I reserve a room?')
  await page.getByRole('button', { name: '미니 에이전트 실행' }).click()

  await expect(page.getByRole('status')).toContainText('Choose a room')
  await expect(page.getByText('reservation-help', { exact: true })).toBeVisible()
  await expect(page.getByText('classify:reservation-help')).toBeVisible()
})

test('classifies Korean room-search request via Mini Agent', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '미니 에이전트' }).click()

  await page.getByRole('textbox', { name: '메시지' }).fill('화상회의가 가능한 10명 회의실을 찾아줘')
  await page.getByRole('button', { name: '미니 에이전트 실행' }).click()

  await expect(page.getByRole('status')).toContainText('Use capacity and equipment filters')
  await expect(page.getByText('room-search', { exact: true })).toBeVisible()
  await expect(page.getByText('classify:room-search')).toBeVisible()
})
