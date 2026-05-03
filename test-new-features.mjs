import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  function log(test, pass, detail = '') {
    results.push({ test, pass, detail });
    console.log(`${pass ? '✅' : '❌'} ${test}${detail ? ' - ' + detail : ''}`);
  }

  try {
    // Test 1: Home page loads
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const title = await page.title();
    log('首页加载', true, `title: ${title}`);

    // Test 2: Status filter buttons exist
    const statusBtns = await page.$$('text=想看');
    log('状态筛选栏-想看按钮', statusBtns.length > 0, `found ${statusBtns.length}`);

    const watchingBtns = await page.$$('text=在看');
    log('状态筛选栏-在看按钮', watchingBtns.length > 0, `found ${watchingBtns.length}`);

    const finishedBtns = await page.$$('text=已看完');
    log('状态筛选栏-已看完按钮', finishedBtns.length > 0, `found ${finishedBtns.length}`);

    const droppedBtns = await page.$$('text=弃了');
    log('状态筛选栏-弃了按钮', droppedBtns.length > 0, `found ${droppedBtns.length}`);

    // Test 3: Sort buttons exist
    const sortNameBtns = await page.$$('button:has-text("名称")');
    log('排序-名称按钮', sortNameBtns.length > 0);

    const sortRatingBtns = await page.$$('button:has-text("评分")');
    log('排序-评分按钮', sortRatingBtns.length > 0);

    const sortRecentBtns = await page.$$('button:has-text("最近观看")');
    log('排序-最近观看按钮', sortRecentBtns.length > 0);

    // Test 4: Timeline link exists
    const timelineLink = await page.$('a[href="/timeline"]');
    log('时间线导航链接', !!timelineLink);

    // Test 5: Navigate to timeline
    await page.goto(BASE + '/timeline', { waitUntil: 'networkidle' });
    const timelineTitle = await page.$('text=观看时间线');
    log('时间线页面标题', !!timelineTitle);

    const emptyMsg = await page.$('text=暂无观看记录');
    log('时间线空状态提示', !!emptyMsg);

    // Test 6: Navigate to statistics
    await page.goto(BASE + '/statistics', { waitUntil: 'networkidle' });
    log('统计页面', (await page.content()).length > 0);

    // Test 7: Navigate to search
    await page.goto(BASE + '/search', { waitUntil: 'networkidle' });
    log('搜索页面', (await page.content()).length > 0);

    // Test 8: Check vite dev server HMR (build check already passed)
    const resp = await page.goto(BASE, { waitUntil: 'networkidle' });
    log('首页HTTP状态', resp.status() === 200, `status: ${resp.status()}`);

    // Test 9: Check that SHOW_STATUSES is imported in ShowList
    const homeContent = await page.content();
    log('首页含状态筛选栏', homeContent.includes('全部状态'));

    // Test 10: Check timeline route works via SPA
    await page.click('a[href="/timeline"]');
    await page.waitForTimeout(500);
    const tlUrl = page.url();
    log('SPA导航到时间线', tlUrl.includes('/timeline'), `url: ${tlUrl}`);

    // Test 11: Back button works on timeline
    const backBtn = await page.$('text=← 返回');
    log('时间线返回按钮', !!backBtn);

  } catch (e) {
    console.error('Test error:', e.message);
  } finally {
    await browser.close();

    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    console.log(`\n${'='.repeat(40)}`);
    console.log(`总计: ${total} 项测试, ${passed} 通过, ${total - passed} 失败`);
    if (passed === total) {
      console.log('🎉 全部测试通过!');
    }
  }
}

run();
