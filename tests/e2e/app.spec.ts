import { expect, test, type Page } from '@playwright/test';

// Every test runs against the same seeded demo database and demo provider.
test.describe.configure({ mode: 'serial' });

const SEED_DOC = '员工差旅费用管理办法 v3.2';

async function openWorkbench(page: Page) {
  await page.goto('/');
  await expect(page.getByText(SEED_DOC).first()).toBeVisible({ timeout: 30_000 });
}

test('answers a policy question with citations and evidence', async ({ page }) => {
  await openWorkbench(page);

  await page.getByRole('button', { name: '一线城市住宿标准是多少？' }).click();

  await expect(page.getByText(/650/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.cite').first()).toBeVisible();

  await page.getByRole('tab', { name: '证据' }).click();
  await expect(page.locator('.ev').first()).toBeVisible();
});

test('refuses questions outside the knowledge base with a handoff card', async ({ page }) => {
  await openWorkbench(page);

  await page.getByRole('button', { name: '海外出差怎么报销？' }).click();

  await expect(page.getByText('建议转人工 / 补充资料').first()).toBeVisible({ timeout: 30_000 });
});

test('extracts structured rows from a mentioned document', async ({ page }) => {
  await openWorkbench(page);

  const input = page.getByLabel('输入问题或指令');
  await input.fill('@Q3');

  const option = page.getByRole('option', { name: /Q3 产品评审会纪要/ });
  await expect(option).toBeVisible();
  await option.click();

  await expect(page.getByText('已引用', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '文档抽取' }).click();
  await page.getByRole('button', { name: '抽取这份会议纪要的行动项' }).click();

  await expect(page.getByText(/已抽取\s*5\s*行结构化数据/)).toBeVisible({ timeout: 30_000 });

  const resultTab = page.getByRole('tab', { name: '结果' });
  await expect(resultTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('columnheader', { name: '任务', exact: true })).toBeVisible();
});

test('generates a weekly report draft', async ({ page }) => {
  await openWorkbench(page);

  await page.getByRole('button', { name: '周报生成' }).click();
  await page.getByRole('button', { name: '生成本周周报' }).click();

  await expect(page.getByText('本周完成').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('下周计划').first()).toBeVisible();
});

test('uploads a markdown document and indexes it', async ({ page }) => {
  await openWorkbench(page);

  const name = `e2e-upload-${Date.now()}.md`;
  await page.getByLabel('选择要上传的文档').setInputFiles({
    name,
    mimeType: 'text/markdown',
    buffer: Buffer.from('一线城市住宿 650 元', 'utf8'),
  });

  await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });

  const row = page.locator('.doc').filter({ hasText: name });
  await expect(row).toContainText('已入库', { timeout: 30_000 });
});

test('mobile layout does not overflow and the document drawer opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByLabel('输入问题或指令')).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const library = page.getByRole('complementary', { name: '文档库' });
  const toggle = page.getByRole('button', { name: '打开文档库' });

  await toggle.click();
  await expect(library).toBeVisible();
  await expect.poll(async () => (await library.boundingBox())?.x ?? -1).toBe(0);

  await toggle.click();
  await expect.poll(async () => (await library.boundingBox())?.x ?? 0).toBeLessThan(0);
});
