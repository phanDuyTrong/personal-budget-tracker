const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    // Switch to dark mode
    await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        document.documentElement.dataset.theme = 'dark';
    });
    
    // Wait for the UI to update
    await new Promise(r => setTimeout(r, 1000));
    
    const tabStyle = await page.evaluate(() => {
      // Find the tab that is selected
      const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
      const activeTab = tabs.find(t => t.getAttribute('data-selected') === 'true');
      if (!activeTab) return 'No active tab found';
      
      const style = window.getComputedStyle(activeTab);
      return {
        className: activeTab.className,
        backgroundColor: style.backgroundColor,
        color: style.color
      };
    });
    
    console.log('--- ACTIVE TAB STYLE ---');
    console.log(tabStyle);
    console.log('------------------------');
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await browser.close();
})();
