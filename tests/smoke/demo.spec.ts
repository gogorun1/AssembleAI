import { test, expect } from '@playwright/test';

test.describe('Demo smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('app loads and shows key UI elements', async ({ page }) => {
    // Viewer stage should be present
    await expect(
      page.getByRole('main', { name: '3D assembly viewport' })
    ).toBeVisible({ timeout: 15_000 });

    // Right rail (assembly agent panel) should be present
    await expect(
      page.getByRole('complementary', { name: 'Assembly agent panel' })
    ).toBeVisible();

    // Presenter mode section should be visible
    await expect(
      page.getByRole('region', { name: 'Presenter mode' })
    ).toBeVisible();

    // Welcome transcript should be shown
    await expect(
      page.getByText(/I have the BILLY bookcase loaded/i)
    ).toBeVisible();

    // Progress rail shows step fraction 1/9 at start
    await expect(page.getByText('1/9')).toBeVisible();
  });

  test('presenter Next step button advances or updates transcript', async ({ page }) => {
    // Click the Next step presenter button
    await page.getByTestId('presenter-button-next-step').click();

    // Progress should advance to step 2
    await expect(page.getByText('2/9')).toBeVisible({ timeout: 10_000 });

    // Transcript should contain the agent reply with step 2 info
    await expect(
      page.getByText(/Next is step 2:/)
    ).toBeVisible();
  });

  test('presenter Which screw button updates transcript', async ({ page }) => {
    // Click the Which screw? presenter button
    await page.getByTestId('presenter-button-which-screw').click();

    // Transcript should mention cam screw with washer
    await expect(
      page.getByText(/cam screw with the washer/i)
    ).toBeVisible({ timeout: 10_000 });

    // Part number 117327 should appear in transcript
    await expect(
      page.getByText(/Use part 117327/i)
    ).toBeVisible();
  });

  test('full reset returns to welcome state', async ({ page }) => {
    // First advance to step 2 to create non-initial state
    await page.getByTestId('presenter-button-next-step').click();
    await expect(page.getByText('2/9')).toBeVisible({ timeout: 10_000 });

    // Click Full reset
    await page.getByTestId('presenter-button-full-reset').click();

    // Should return to step 1
    await expect(page.getByText('1/9')).toBeVisible({ timeout: 10_000 });

    // Welcome transcript should be restored
    await expect(
      page.getByText(/I have the BILLY bookcase loaded/i)
    ).toBeVisible();
  });

  test('viewer stage contains canvas or fallback UI', async ({ page }) => {
    // Assert the viewer stage exists
    const viewerStage = page.getByRole('main', { name: '3D assembly viewport' });

    // Either a <canvas> (WebGL active) or the fallback model UI should be present.
    // Playwright in headless Chromium supports WebGL, so a canvas is expected.
    // If WebGL fails, WebGLErrorBoundary renders the fallback — both are acceptable.
    // Forcing WebGL failure is out of scope for this basic smoke test.
    await expect(
      viewerStage.locator('canvas, [aria-label="Assembly model fallback"]').first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
