// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI expects a function expression.
async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8043/docs/design/43/');
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('400 16px Pretendard') && document.fonts.check('600 16px Pretendard')), 'Pretendard 400/600 failed');
  const photoLoaded = await page.locator('.photo img').evaluate(image => image.complete && image.naturalWidth > 0);
  assert(photoLoaded, 'Reference food photo failed; report visual verification separately');
  const report = { photoLoaded, layouts: [] };
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['cards', 'list']) {
      await page.locator(`button[data-view="${view}"]`).click();
      await page.evaluate(() => scrollTo(0, 0));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow ${width}/${view}`);
      assert(await page.locator('#results article').count() === 4, 'Missing fixtures');
      assert(await page.locator(`button[data-view="${view}"]`).getAttribute('aria-pressed') === 'true', 'View state');
      const small = await page.locator('button, input[type="search"], select, .check, summary').evaluateAll(elements => elements.filter(el => { const box = el.getBoundingClientRect(); return box.width > 0 && (box.width < 44 || box.height < 44); }).map(el => el.outerHTML));
      assert(small.length === 0, `Small control ${width}/${view}: ${small}`);
      await page.screenshot({ path: `output/playwright/library-study/${view}-${width}.png`, fullPage: true });
      report.layouts.push(`${width}/${view}`);
    }
  }
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.locator('button[data-view="cards"]').click();
  const longTitle = page.locator('.title-button').nth(2);
  const title = await longTitle.textContent();
  await longTitle.click();
  assert(await page.locator('#detail-title').textContent() === title, 'Full title lost');
  await page.keyboard.press('Escape');
  assert(await longTitle.evaluate(el => el === document.activeElement), 'Dialog focus not restored');
  await page.locator('#tag').selectOption({ label: '간식' });
  assert(await page.locator('#results article').count() === 1, 'Tag filter');
  await page.locator('#favorites').check();
  assert(await page.locator('#empty').isVisible(), 'Combined filters / empty state');
  await page.locator('#reset').click();
  await page.locator('#query').fill('감자');
  await page.locator('#query').press('Enter');
  assert(await page.locator('#results article').count() === 1, 'Search');
  await page.locator('#query').fill('없는검색어');
  await page.locator('#query').press('Enter');
  await page.screenshot({ path: 'output/playwright/library-study/empty-320.png', fullPage: true });
  await page.locator('#reset').click();
  await page.locator('#favorites').check();
  assert(await page.locator('#results article').count() === 2, 'Favorite filter');
  await page.locator('.favorite').first().click();
  assert(await page.locator('#results article').count() === 1, 'Favorite removal');
  await page.locator('#favorites').uncheck();
  await page.locator('#font').selectOption('nanum');
  await page.evaluate(() => document.fonts.ready);
  assert(await page.evaluate(() => document.fonts.check('400 16px Nanum') && document.fonts.check('700 16px Nanum')), 'Current font failed');
  await page.screenshot({ path: 'output/playwright/library-study/nanum-320.png', fullPage: true });
  await page.locator('#font').selectOption('pretendard');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.locator('button').first().evaluate(el => getComputedStyle(el).transitionDuration === '0s'), 'Reduced motion');
  await page.locator('#query').focus();
  await page.keyboard.press('Tab');
  assert(await page.locator('#tag').evaluate(el => el === document.activeElement && getComputedStyle(el).outlineWidth === '3px'), 'Keyboard focus');
  await page.route('https://static.wtable.co.kr/**', route => route.abort());
  await page.reload();
  await page.locator('.photo-fallback').waitFor();
  assert(await page.locator('#results article').count() === 4, 'Photo failure lost content');
  await page.unroute('https://static.wtable.co.kr/**');
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => document.fonts.ready);
  assert(errors.length === 0, `Browser errors: ${errors}`);
  return { ...report, interactions: 'search, tag, favorites, reset, full title, dialog focus, fonts, keyboard, reduced motion, photo failure', errors };
}
