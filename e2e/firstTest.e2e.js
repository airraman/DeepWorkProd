const { device, expect, element, by } = require('detox');

describe('First Test', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should display the welcome screen', async () => {
    await expect(element(by.id('welcomeScreen'))).toBeVisible();
  });
});