import { test, expect } from './fixtures/test';

test.describe('Network Loop Audit: Verify RSC Requests Settle Across All Pages', () => {
  test('1. Dashboard: condition links and top doctors settle without infinite RSC loops', async ({ page }) => {
    const rscRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('_rsc')) {
        rscRequests.push(url);
      }
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Clinical Overview' })).toBeVisible();

    // Settle time: wait 3 seconds to observe any background polling loops
    await page.waitForTimeout(3000);

    // Verify condition breakdown card for "Discharged" is visible
    await expect(page.getByText('Discharged')).toBeVisible();

    // The condition breakdown link for discharged must NOT be spammed in an infinite loop
    const dischargedRscCalls = rscRequests.filter((url) => url.includes('condition=discharged'));
    expect(dischargedRscCalls.length).toBeLessThanOrEqual(1);

    // Total RSC requests across the whole dashboard during 3s rest should be small and settled
    expect(rscRequests.length).toBeLessThanOrEqual(3);
  });

  test('2. Direct navigation to /patients?condition=discharged settles without repeating fetch calls', async ({ page }) => {
    const rscRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('_rsc')) {
        rscRequests.push(url);
      }
    });

    await page.goto('/patients?condition=discharged');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();

    // Wait 3 seconds to ensure no repeating tight loop triggers
    await page.waitForTimeout(3000);

    // Filtered page should be rendered and settled
    const duplicatePageFetches = rscRequests.filter((url) => url.includes('patients?condition=discharged'));
    expect(duplicatePageFetches.length).toBeLessThanOrEqual(1);
  });

  test('3. Doctors Directory: search and pagination settle cleanly', async ({ page }) => {
    const rscRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('_rsc')) {
        rscRequests.push(url);
      }
    });

    await page.goto('/doctors');
    await expect(page.getByRole('heading', { name: 'Doctors Directory' })).toBeVisible();

    // Type in search
    const searchInput = page.getByTestId('doctor-search-input');
    await searchInput.fill('Sarah');
    await page.waitForTimeout(1000);

    // Wait 2 seconds
    await page.waitForTimeout(2000);

    // Assert that requests settled cleanly without looping
    expect(rscRequests.length).toBeLessThanOrEqual(3);
  });
});
