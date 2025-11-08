const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let browser = null;

// Initialize browser on startup
async function initBrowser() {
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ]
        });
        console.log('Browser initialized successfully');
    } catch (error) {
        console.error('Error initializing browser:', error);
    }
}

// Scrape Play Store app
app.post('/scrape', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required' 
        });
    }
    
    if (!browser) {
        await initBrowser();
    }
    
    let page = null;
    
    try {
        page = await browser.newPage();
        
        // Set realistic viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navigate to Play Store page
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for content to load
        await page.waitForTimeout(3000);
        
        // Extract app data
        const appData = await page.evaluate(() => {
            const data = {};
            
            // Extract name
            const nameEl = document.querySelector('h1') || document.querySelector('[itemprop="name"]');
            if (nameEl) {
                data.name = nameEl.textContent.trim();
                // Remove " - Apps on Google Play" suffix
                data.name = data.name.replace(/\s*-\s*Apps?\s+on\s+Google\s+Play.*$/i, '');
            }
            
            // Extract description - look for "Acerca de esta app" section
            const aboutSection = Array.from(document.querySelectorAll('h2')).find(h2 => 
                h2.textContent.includes('Acerca de esta app') || 
                h2.textContent.includes('About this app')
            );
            
            if (aboutSection) {
                let descElement = aboutSection.nextElementSibling;
                let description = '';
                
                // Get all text until next h2
                while (descElement && descElement.tagName !== 'H2') {
                    if (descElement.textContent) {
                        description += descElement.textContent.trim() + '\n\n';
                    }
                    descElement = descElement.nextElementSibling;
                }
                
                // Also try to get from bARER class divs
                const descDivs = document.querySelectorAll('div.bARER, div[class*="bARER"]');
                if (descDivs.length > 0) {
                    let combinedDesc = '';
                    descDivs.forEach(div => {
                        combinedDesc += div.textContent.trim() + '\n\n';
                    });
                    if (combinedDesc.length > description.length) {
                        description = combinedDesc;
                    }
                }
                
                data.description = description.trim();
            }
            
            // Extract icon
            const iconEl = document.querySelector('img[alt*="Icon"], img[itemprop="image"]');
            if (iconEl) {
                data.icon_url = iconEl.src || iconEl.getAttribute('data-src');
                // Convert to high-res
                if (data.icon_url) {
                    data.icon_url = data.icon_url.replace(/=w\d+-h\d+/, '=w512-h512');
                    data.icon_url = data.icon_url.replace(/=s\d+/, '=s512');
                }
            }
            
            // Extract screenshots
            const screenshots = [];
            const screenshotImgs = document.querySelectorAll('img[alt*="Screenshot"], img[alt*="screenshot"]');
            
            screenshotImgs.forEach(img => {
                let src = img.src || img.getAttribute('data-src');
                if (src && src.includes('googleusercontent.com') && 
                    !src.includes('icon') && !src.includes('logo')) {
                    // Convert to high-res
                    src = src.replace(/=w\d+-h\d+/, '=w720-h1280');
                    src = src.replace(/=s\d+/, '=s720');
                    if (!screenshots.includes(src)) {
                        screenshots.push(src);
                    }
                }
            });
            
            // Also look for screenshots in carousels
            const carousels = document.querySelectorAll('[role="list"], .screenshot-carousel');
            carousels.forEach(carousel => {
                const imgs = carousel.querySelectorAll('img');
                imgs.forEach(img => {
                    let src = img.src || img.getAttribute('data-src');
                    if (src && src.includes('googleusercontent.com') && 
                        !src.includes('icon') && !src.includes('logo') &&
                        !screenshots.includes(src)) {
                        src = src.replace(/=w\d+-h\d+/, '=w720-h1280');
                        src = src.replace(/=s\d+/, '=s720');
                        screenshots.push(src);
                    }
                });
            });
            
            data.screenshot_urls = screenshots;
            
            // Extract rating
            const ratingEl = document.querySelector('[itemprop="ratingValue"], .TT9eCd');
            if (ratingEl) {
                const ratingText = ratingEl.textContent.trim();
                const match = ratingText.match(/(\d+\.?\d*)/);
                if (match) {
                    data.rating = parseFloat(match[1]);
                }
            }
            
            // Extract price
            const priceEl = document.querySelector('[itemprop="price"], .VfPpkd-StrnGf-rymPhb');
            if (priceEl) {
                const priceText = priceEl.textContent.trim();
                if (priceText.toLowerCase().includes('gratis') || 
                    priceText.toLowerCase().includes('free')) {
                    data.price = 0;
                } else {
                    const match = priceText.match(/\$?(\d+\.?\d*)/);
                    if (match) {
                        data.price = parseFloat(match[1]);
                    }
                }
            } else {
                data.price = 0; // Default to free
            }
            
            // Extract publisher/author
            const publisherSelectors = [
                'a[href*="/store/apps/developer"]',
                'a[itemprop="author"]',
                '[itemprop="author"]',
                '.VfPpkd-StrnGf-rymPhb a',
                '.VfPpkd-StrnGf-rymPhb-ibnC6b a'
            ];
            
            for (const selector of publisherSelectors) {
                const publisherEl = document.querySelector(selector);
                if (publisherEl) {
                    const publisherText = publisherEl.textContent.trim();
                    if (publisherText && publisherText.length > 2) {
                        data.publisher = publisherText;
                        break;
                    }
                }
            }
            
            // Extract download count (Play Store format: "1M+", "500K+", "1,000,000+")
            const downloadText = document.body.textContent || '';
            // Pattern 1: "1M+", "500K+", "10M+", etc.
            const downloadMatch1 = downloadText.match(/(\d+(?:\.\d+)?)\s*([MK])\s*\+/i);
            if (downloadMatch1) {
                const number = parseFloat(downloadMatch1[1]);
                const unit = downloadMatch1[2].toUpperCase();
                if (unit === 'M') {
                    data.play_store_downloads = Math.floor(number * 1000000);
                } else if (unit === 'K') {
                    data.play_store_downloads = Math.floor(number * 1000);
                }
            }
            // Pattern 2: Full numbers like "1,000,000+"
            else {
                const downloadMatch2 = downloadText.match(/([\d,]+)\s*\+/);
                if (downloadMatch2) {
                    const numberStr = downloadMatch2[1].replace(/,/g, '');
                    const num = parseInt(numberStr);
                    if (num > 1000) {
                        data.play_store_downloads = num;
                    }
                }
            }
            
            return data;
        });
        
        await page.close();
        
        res.json({
            success: true,
            data: appData
        });
        
    } catch (error) {
        if (page) {
            await page.close().catch(() => {});
        }
        console.error('Scraping error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error scraping Play Store'
        });
    }
});

// Generic scraper endpoint - for any website
app.post('/scrape-generic', async (req, res) => {
    const { url, selectors, waitFor, timeout = 30000 } = req.body;
    
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required' 
        });
    }
    
    if (!browser) {
        await initBrowser();
    }
    
    let page = null;
    
    try {
        page = await browser.newPage();
        
        // Set realistic viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Navigate to page
        await page.goto(url, { 
            waitUntil: waitFor || 'networkidle2',
            timeout: timeout 
        });
        
        // Wait for specific selector if provided
        if (req.body.waitForSelector) {
            await page.waitForSelector(req.body.waitForSelector, { timeout: timeout });
        } else {
            // Default wait
            await page.waitForTimeout(2000);
        }
        
        // Extract data using custom selectors or return full HTML
        let data = {};
        
        if (selectors && typeof selectors === 'object') {
            // Custom selectors provided
            data = await page.evaluate((sel) => {
                const result = {};
                for (const [key, selector] of Object.entries(sel)) {
                    if (typeof selector === 'string') {
                        // Single selector
                        const element = document.querySelector(selector);
                        if (element) {
                            result[key] = element.textContent?.trim() || element.innerHTML || element.getAttribute('src') || element.getAttribute('href') || '';
                        }
                    } else if (Array.isArray(selector)) {
                        // Multiple selectors (try each until one works)
                        for (const sel of selector) {
                            const element = document.querySelector(sel);
                            if (element) {
                                result[key] = element.textContent?.trim() || element.innerHTML || element.getAttribute('src') || element.getAttribute('href') || '';
                                break;
                            }
                        }
                    } else if (selector.selector) {
                        // Advanced selector with options
                        const element = document.querySelector(selector.selector);
                        if (element) {
                            if (selector.attribute) {
                                result[key] = element.getAttribute(selector.attribute);
                            } else if (selector.html) {
                                result[key] = element.innerHTML;
                            } else {
                                result[key] = element.textContent?.trim();
                            }
                        }
                    }
                }
                return result;
            }, selectors);
        } else {
            // No selectors provided, return page info
            data = await page.evaluate(() => {
                return {
                    title: document.title,
                    url: window.location.href,
                    html: document.documentElement.outerHTML.substring(0, 10000) // First 10KB
                };
            });
        }
        
        // Get all images if requested
        if (req.body.extractImages) {
            const images = await page.evaluate(() => {
                const imgs = [];
                document.querySelectorAll('img').forEach(img => {
                    const src = img.src || img.getAttribute('data-src');
                    if (src && !src.startsWith('data:')) {
                        imgs.push({
                            src: src,
                            alt: img.alt || '',
                            width: img.naturalWidth,
                            height: img.naturalHeight
                        });
                    }
                });
                return imgs;
            });
            data.images = images;
        }
        
        // Get all links if requested
        if (req.body.extractLinks) {
            const links = await page.evaluate(() => {
                const linkList = [];
                document.querySelectorAll('a[href]').forEach(link => {
                    const href = link.getAttribute('href');
                    if (href && !href.startsWith('javascript:')) {
                        linkList.push({
                            href: href,
                            text: link.textContent?.trim() || '',
                            title: link.getAttribute('title') || ''
                        });
                    }
                });
                return linkList;
            });
            data.links = links;
        }
        
        await page.close();
        
        res.json({
            success: true,
            data: data,
            url: url
        });
        
    } catch (error) {
        if (page) {
            await page.close().catch(() => {});
        }
        console.error('Scraping error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error scraping website'
        });
    }
});

// Screenshot endpoint - take screenshot of any page
app.post('/screenshot', async (req, res) => {
    const { url, fullPage = false, width = 1920, height = 1080 } = req.body;
    
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required' 
        });
    }
    
    if (!browser) {
        await initBrowser();
    }
    
    let page = null;
    
    try {
        page = await browser.newPage();
        await page.setViewport({ width, height });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const screenshot = await page.screenshot({ 
            fullPage,
            type: 'png',
            encoding: 'base64'
        });
        
        await page.close();
        
        res.json({
            success: true,
            screenshot: `data:image/png;base64,${screenshot}`,
            url: url
        });
        
    } catch (error) {
        if (page) {
            await page.close().catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Error taking screenshot'
        });
    }
});

// PDF endpoint - generate PDF of any page
app.post('/pdf', async (req, res) => {
    const { url, format = 'A4' } = req.body;
    
    if (!url) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL is required' 
        });
    }
    
    if (!browser) {
        await initBrowser();
    }
    
    let page = null;
    
    try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const pdf = await page.pdf({ 
            format: format,
            printBackground: true
        });
        
        await page.close();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="page.pdf"`);
        res.send(pdf);
        
    } catch (error) {
        if (page) {
            await page.close().catch(() => {});
        }
        res.status(500).json({
            success: false,
            error: error.message || 'Error generating PDF'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        browser: browser ? 'initialized' : 'not initialized',
        endpoints: [
            'POST /scrape - Scrape Play Store apps',
            'POST /scrape-generic - Scrape any website with custom selectors',
            'POST /screenshot - Take screenshot of any page',
            'POST /pdf - Generate PDF of any page',
            'GET /health - Health check'
        ]
    });
});

// Initialize browser on startup
initBrowser();

// Graceful shutdown
process.on('SIGTERM', async () => {
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Play Store Scraper service running on port ${PORT}`);
});

