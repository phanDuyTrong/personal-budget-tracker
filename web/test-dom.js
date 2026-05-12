import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5174/travel', { waitUntil: 'networkidle0' });
  
  // Set theme to dark
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  
  const glassCards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.glass-card'));
    return cards.map(c => ({
      className: c.className,
      bgColor: getComputedStyle(c).backgroundColor
    }));
  });
  
  console.log("Glass cards in Travel Tracker:", glassCards);
  await browser.close();
})();
