// Isolated browser fixtures, never imported by the app or sent to the backend.
// Run with: npm exec --yes --package=playwright -- node scripts/check-owner-profile.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'vite';

const playwrightPath = process.env.PATH.split(delimiter)
  .map((entry) => join(dirname(entry), 'playwright', 'index.mjs'))
  .find((entry) => existsSync(entry));
assert.ok(playwrightPath, 'Run this script with npm exec --package=playwright.');
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const previewServer = process.env.PROFILE_PREVIEW_URL ? null : await preview({
  root: process.cwd(), preview: { host: '127.0.0.1', port: 0 },
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = resolve('dist/profile-check');
mkdirSync(output, { recursive: true });
const baseURL = (process.env.PROFILE_PREVIEW_URL || previewServer.resolvedUrls.local[0]).replace(/\/$/, '');
const graphic = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${color}"/><circle cx="290" cy="110" r="65" fill="#fff" opacity=".25"/><path d="M0 350 155 145 290 320 400 220V400H0Z" fill="#111214" opacity=".25"/></svg>`)}`;
const fixtureProfile = {
  id: 999, username: 'design_preview', full_name: 'Profile preview',
  first_name: 'Profile', last_name: 'preview', bio: 'A real-data layout, tested in isolation',
  profile_picture: null, phone_number: '+1 202 555 0143', location: 'Test location',
  date_joined: '2025-06-01T00:00:00Z', followers_count: 12, following_count: 34,
  likes_count: 56, is_self: true,
};
const fixtureMedia = ['#9fbdce', '#bba9d1', '#e7ae8a', '#aac3cc', '#b6b9ce', '#a8bea8']
  .map((color, index) => ({ id: index + 1, media_type: index === 0 ? 'video' : 'image', file: index === 0 ? 'data:video/mp4;base64,' : graphic(color) }));
const errors = [];

try {
  for (const width of [390, 640, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('token', 'isolated-browser-test'));
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', (error) => errors.push(error.message));
    let profile = { ...fixtureProfile };
    const writes = [];
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/users/profile/')) {
        if (request.method() === 'PATCH') {
          writes.push(request.postDataJSON());
          profile = { ...profile, ...request.postDataJSON() };
          profile.full_name = `${profile.first_name} ${profile.last_name}`.trim();
        }
        return route.fulfill({ json: profile });
      }
      if (path.endsWith('/media/my-media/')) return route.fulfill({ json: { results: fixtureMedia, next: null } });
      if (path.endsWith('/users/profile/123/')) return route.fulfill({ json: { ...fixtureProfile, is_self: false } });
      if (path.endsWith('/media/user/123/')) return route.fulfill({ json: { results: fixtureMedia, next: null } });
      return route.fulfill({ status: 404, json: {} });
    });
    await page.goto(`${baseURL}/profile`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: fixtureProfile.full_name, exact: true }).waitFor();
    await page.locator('.owner-grid img').last().waitFor();
    assert.equal(await page.locator('.owner-detail').count(), 3, 'All supported info rows render');
    assert.equal(await page.locator('.owner-tile').count(), 6, 'Three-column grid retains all media');
    assert.equal(await page.getByRole('button', { name: 'Change profile photo' }).count(), 1);
    assert.equal(await page.locator('.owner-hero-actions a').getAttribute('href'), '/menu');
    const measurements = await page.evaluate(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      return {
        hero: box('.owner-hero'), avatar: box('.owner-avatar'), tabs: box('.owner-tabs'),
        details: box('.owner-info-card'), edit: box('.owner-edit'), grid: box('.owner-grid'),
        nav: box('nav'), overflow: document.documentElement.scrollWidth > innerWidth,
        color: getComputedStyle(document.querySelector('.owner-subtitle')).color,
        columns: getComputedStyle(document.querySelector('.owner-grid')).gridTemplateColumns,
      };
    });
    assert.equal(measurements.overflow, false, 'No horizontal scrolling');
    assert.equal(measurements.color, 'rgb(91, 73, 237)', 'Reference purple is applied');
    assert.equal(measurements.columns.split(' ').length, 3);
    assert.ok(Math.abs(measurements.nav.y + measurements.nav.height - 900) <= 1, 'Navigation remains viewport-fixed');
    await page.screenshot({ path: join(output, `owner-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await page.locator('.owner-play').waitFor();
    assert.equal(await page.locator('.owner-tile').count(), 1);
    await page.getByRole('button', { name: 'Photos', exact: true }).click();
    assert.equal(await page.locator('.owner-tile').count(), 5);
    await page.getByRole('button', { name: 'Edit profile', exact: true }).first().click();
    await page.getByLabel('First name', { exact: true }).fill('Updated');
    await page.getByRole('button', { name: 'Save profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Updated preview', exact: true }).waitFor();
    assert.equal(writes[0]?.first_name, 'Updated', 'Editor preserves the PATCH contract');
    profile = { ...profile, phone_number: '', location: '', bio: '' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Updated preview', exact: true }).waitFor();
    assert.equal(await page.locator('.owner-detail').count(), 3, 'Empty account fields retain all reference rows');
    await page.getByRole('button', { name: 'Add phone number' }).click();
    assert.equal(await page.getByLabel('Phone number', { exact: true }).inputValue(), '', 'Missing values are not fabricated');
    await page.goto(`${baseURL}/profile/123`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: fixtureProfile.full_name, exact: true }).waitFor();
    assert.equal(await page.locator('.owner-profile').count(), 0, 'Owner styling does not change visitor profile');
    assert.equal(await page.getByRole('button', { name: 'Edit profile', exact: true }).count(), 0);
    console.log(JSON.stringify({ width, measurements, status: 'passed' }));
    await context.close();
  }
  assert.deepEqual(errors, [], 'No runtime page errors');
  console.log(`Owner profile checks passed. Screenshots: ${output}`);
} finally {
  await browser.close();
  if (previewServer) {
    previewServer.httpServer.closeAllConnections();
    previewServer.httpServer.close();
    previewServer.httpServer.unref();
  }
}

// This standalone audit owns its process; all screenshots and assertions are awaited above.
// Exit explicitly so preview-tool workers cannot keep an otherwise completed audit alive.
process.exit(0);
