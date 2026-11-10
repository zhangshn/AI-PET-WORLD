import {test, expect} from '@playwright/test'

test.beforeEach(async ({page}) => {
  // Exercise real browser requests and hydration without starting training or
  // submitting world/control mutations, even if a page later adds a write call.
  await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method())
    ? route.continue() : route.abort('blockedbyclient'))
})

test('world requires an explicit identity and does not display a training image', async ({page}) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto('/world')
  expect(response.status()).toBe(200)
  await expect(page.getByRole('heading', {name:'需要指定世界'})).toBeVisible()
  await expect(page.locator('main img')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('data overview hydrates, refreshes through GET and navigates to the work ledger', async ({page}) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto('/local-backup')
  expect(response.status()).toBe(200)
  await expect(page.getByRole('button', {name:'刷新总览', exact:true})).toBeVisible()
  const read = page.waitForResponse(r => r.url().includes('/api/local-backup/') && r.request().method() === 'GET')
  await page.getByRole('button', {name:'刷新总览', exact:true}).click()
  await read
  await page.getByRole('link', {name:'每日自动记录', exact:true}).click()
  await expect(page).toHaveURL(/\/local-backup\/work(?:[?#].*)?$/)
  expect(errors).toEqual([])
})
