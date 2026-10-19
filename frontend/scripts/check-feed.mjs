// Isolated fixtures; no live account or backend writes.
// Run after npm run build: npm exec --yes --package=playwright --offline -- node scripts/check-feed.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'vite';

const playwrightPath = process.env.PATH.split(delimiter)
  .map((entry) => join(dirname(entry), 'playwright', 'index.mjs')).find(existsSync);
assert.ok(playwrightPath, 'Run this script with npm exec --package=playwright.');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const previewServer = await preview({ root: process.cwd(), preview: { host: '127.0.0.1', port: 0 } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const baseURL = previewServer.resolvedUrls.local[0].replace(/\/$/, '');
const output = resolve('dist/feed-check');
mkdirSync(output, { recursive: true });
const graphic = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="744"><defs><linearGradient id="sky" x2="1" y2="1"><stop stop-color="#bdc9dd"/><stop offset="1" stop-color="#e9cfbb"/></linearGradient></defs><rect width="800" height="744" fill="url(#sky)"/><circle cx="590" cy="200" r="90" fill="#f8ebd8"/><path d="M0 580 260 260 610 660 800 450V744H0Z" fill="#627d8f"/><path d="m0 660 180-170 290 254H0Z" fill="#334c60"/></svg>')}`;
const fixture = {
  id: 9001, user: 'feed_preview', user_id: 999, user_full_name: 'Feed preview',
  user_profile_picture: null, title: '', content_type: 'post', file: graphic,
  caption: 'A quiet moment, a different perspective.', media_type: 'image',
  uploaded_at: `${new Date().getFullYear()}-08-12T12:00:00Z`, likes_count: 7,
  comments: [{ id: 1, user: 'preview_reader', text: 'A test comment.' }, { id: 2, user: 'second_reader', text: 'Another test comment.' }],
};
const runtimeErrors = [];

try {
  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('token', 'isolated-feed-test');
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (text) => { window.__copiedLink = text; } }, configurable: true });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    let liked = false;
    let rejectLike = false;
    const writes = [];
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== 'GET') writes.push(url.pathname);
      if (url.pathname.endsWith('/media/feed/')) {
        if (url.searchParams.has('page')) return route.fulfill({ json: { next: null, results: [{ ...fixture, id: 9002, media_type: 'text', file: '', caption: 'A second page text post.' }] } });
        return route.fulfill({ json: { next: `${url.origin}${url.pathname}?page=2`, results: [fixture] } });
      }
      if (url.pathname.endsWith('/media/like/9001/')) {
        if (rejectLike) return route.fulfill({ status: 500, json: {} });
        liked = !liked;
        return route.fulfill({ json: { message: liked ? 'Liked' : 'Unliked' } });
      }
      if (url.pathname.endsWith('/media/comment/9001/')) return route.fulfill({ json: { id: 3, user: 'test_account', text: request.postDataJSON().text } });
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto(`${baseURL}/feed`, { waitUntil: 'domcontentloaded' });
    const card = page.locator('#post-9001');
    await card.locator('.feed-media img').waitFor();
    await card.getByRole('button', { name: 'Like post', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.feed-like')?.getAttribute('aria-pressed') === 'true');
    assert.equal(await card.locator('.feed-like span').textContent(), '8');
    const measurements = await page.evaluate(() => {
      const box = (selector) => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
      };
      return {
        header: box('.feed-header'), search: box('.feed-search'), card: box('.feed-card'),
        image: box('.feed-media'), nav: box('.reference-feed-nav'),
        overflow: document.documentElement.scrollWidth > innerWidth,
        likeColor: getComputedStyle(document.querySelector('.feed-like svg')).color,
        searchColor: getComputedStyle(document.querySelector('.feed-search input')).backgroundColor,
      };
    });
    assert.equal(measurements.overflow, false);
    assert.ok(Math.abs(measurements.image.width / measurements.image.height - 1.075) < 0.005);
    assert.ok(Math.abs(measurements.nav.y + measurements.nav.height - 844) < 1, 'Navigation fixed to viewport');
    assert.equal(measurements.likeColor, 'rgb(241, 93, 118)');
    assert.equal(measurements.searchColor, 'rgb(239, 240, 244)');
    assert.deepEqual(await page.locator('.reference-feed-nav a').evaluateAll((links) => links.map((link) => link.getAttribute('href'))), ['/feed', '/videos', '/messages', '/notifications', '/profile']);
    assert.equal(await card.getByRole('button', { name: 'Share post', exact: true }).locator('span').count(), 0, 'No invented share total');
    assert.equal(await page.getByRole('link', { name: 'Open menu' }).getAttribute('href'), '/menu');
    await page.screenshot({ path: join(output, `feed-${width}.png`), fullPage: true });

    await card.getByRole('button', { name: 'Unlike post', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.feed-like')?.getAttribute('aria-pressed') === 'false');
    assert.equal(await card.locator('.feed-like span').textContent(), '7');
    rejectLike = true;
    await card.getByRole('button', { name: 'Like post', exact: true }).click();
    await card.getByRole('alert').waitFor();
    assert.equal(await card.locator('.feed-like span').textContent(), '7', 'Failed request does not change count');
    rejectLike = false;

    await card.getByRole('button', { name: 'View all 2 comments' }).click();
    assert.equal(await card.locator('.feed-comment-entry').count(), 2);
    await card.getByRole('textbox', { name: 'Comment', exact: true }).fill('An isolated test reply.');
    await card.getByRole('button', { name: 'Post', exact: true }).click();
    await card.getByRole('button', { name: 'View all 3 comments' }).waitFor();
    assert.equal(await card.locator('.feed-comment-entry').count(), 3);
    await card.getByRole('button', { name: 'Comment on post' }).click();

    await card.getByRole('button', { name: 'Post options' }).click();
    assert.equal(await card.getByRole('link', { name: 'View profile', exact: true }).getAttribute('href'), '/profile/999');
    await page.keyboard.press('Escape');
    assert.equal(await card.locator('.feed-menu-panel').count(), 0);
    await card.getByRole('button', { name: 'Post options' }).click();
    await card.getByRole('button', { name: 'Copy post link' }).click();
    await card.getByText('Post link copied.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__copiedLink), `${baseURL}/feed#post-9001`);
    const writeCount = writes.length;
    await card.getByRole('button', { name: 'Save post — unavailable' }).click();
    await card.getByText('Saving posts is not available yet.', { exact: true }).waitFor();
    assert.equal(writes.length, writeCount, 'Unsupported bookmark makes no backend write');

    const search = page.getByRole('textbox', { name: 'Search feed' });
    await search.fill('different perspective');
    assert.equal(await page.locator('.feed-card').count(), 1);
    await search.fill('missing search phrase');
    await page.getByText('No matching posts.', { exact: true }).waitFor();
    await search.fill('');
    await card.waitFor();
    await page.getByRole('button', { name: 'Create a post' }).click();
    await page.getByRole('dialog', { name: 'Create post', exact: true }).waitFor();
    const overlay = await page.getByRole('dialog').evaluate((node) => {
      const { x, y, width, height } = node.parentElement.getBoundingClientRect();
      return { x, y, width, height };
    });
    assert.deepEqual(overlay, { x: 0, y: 0, width, height: 844 }, 'Composer not trapped inside feed container');
    await page.getByRole('button', { name: 'Close create post' }).click();
    await page.getByRole('button', { name: 'Load more', exact: true }).click();
    await page.locator('#post-9002').waitFor();
    assert.equal(await page.locator('.feed-card').count(), 2);
    assert.equal(await page.locator('#post-9002 .feed-media').count(), 0, 'Text posts do not invent media');
    console.log(JSON.stringify({ width, status: 'passed', measurements, tested: 'layout, likes/errors, comments, menu, share, bookmark, search, composer, pagination' }));
    await context.close();
  }
  assert.deepEqual(runtimeErrors, []);
  console.log(`Feed browser checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
  previewServer.httpServer.closeAllConnections();
  previewServer.httpServer.close();
  previewServer.httpServer.unref();
}
process.exit(0);
