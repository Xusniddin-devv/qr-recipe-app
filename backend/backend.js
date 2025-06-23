const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 30001;

// Middleware
app.use(cors());
app.use(express.json());

// Keep a browser instance running to avoid launch overhead
let browserInstance = null;

const getBrowser = async () => {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
  }
  return browserInstance;
};

const readCheck = async (url) => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if(req.resourceType() == 'stylesheet' || req.resourceType() == 'image' || req.resourceType() == 'font'){
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    const data = await page.evaluate(() => {
      // Create a debug function to help identify elements and their properties
      const debugInfo = [];

      // IMPROVED APPROACH: Focus specifically on products-row classes
      const productRows = Array.from(document.querySelectorAll('tr.products-row'));

      // Process the product rows and track discounts
      const products = [];
      const discounts = [];

      // Helper function to extract product info from a row
      function extractProductInfo(row) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 2) return null;

        // Extract product details from cells
        let name, quantityText, priceText;

        // Look for product name in first column with content
        for (let i = 0; i < cells.length; i++) {
          const cellText = cells[i]?.innerText.trim();
          if (cellText && cellText.length > 0) {
            name = cellText;
            break;
          }
        }

        // Look for price in cells with price-sum class
        const priceCell = row.querySelector('.price-sum');
        if (priceCell) {
          priceText = priceCell.innerText.trim();
        } else {
          // Fall back to last cell if no price-sum class found
          priceText = cells[cells.length - 1]?.innerText.trim();
        }

        // Look for quantity (usually in center-aligned cells)
        const quantityCell = Array.from(cells).find(cell =>
          cell.align === 'center' ||
          cell.getAttribute('align') === 'center'
        );

        if (quantityCell) {
          quantityText = quantityCell.innerText.trim();
        } else {
          // Default to 1 if no quantity found
          quantityText = "1";
        }

        // Clean and parse the data
        if (name && priceText) {
          const cleanedPriceText = priceText.replace(/[,\s]/g, '');
          const parsedQuantity = parseFloat(quantityText.replace(',', '.'));

          return {
            name: name,
            quantity: !isNaN(parsedQuantity) ? parsedQuantity : 1,
            price: parseFloat(cleanedPriceText) || 0
          };
        }

        return null;
      }

      // Helper function to parse values that might include currency symbols
      function parseNumericValue(text) {
        if (!text) return 0;
        const numericOnly = text.replace(/[^\d.,]/g, '').replace(',', '.');
        return parseFloat(numericOnly) || 0;
      }

      productRows.forEach((row) => {
        // Get the product info
        const productInfo = extractProductInfo(row);
        if (!productInfo) return;

        // Add the product to the products array
        products.push(productInfo);

        // Debug info to track what we're finding
        const rowDebugInfo = {
          productName: productInfo.name,
          checkedRows: []
        };

        // Check if this product has a discount by looking at the next sibling rows
        let nextRow = row.nextElementSibling;
        let hasDiscount = false;

        // Look through the next rows until we find another products-row or run out of rows
        while (nextRow && !nextRow.classList.contains('products-row')) {
          const rowText = nextRow.textContent.toLowerCase();

          // Add to debug
          rowDebugInfo.checkedRows.push({
            className: nextRow.className,
            text: rowText
          });

          // ONLY treat 'chegirma/boshqa' rows as discounts
          // This is the specific identifier for discount rows in the receipt
          if (rowText.includes('chegirma/boshqa')) {
            const cells = nextRow.querySelectorAll('td');
            if (cells.length >= 2) {
              const discountValueCell = cells[cells.length - 1];
              let discountValue = discountValueCell?.innerText.trim();

              // Special handling for values like "20000/0"
              if (discountValue && discountValue.includes('/')) {
                discountValue = discountValue.split('/')[0].trim();
              }

              const parsedValue = parseNumericValue(discountValue);

              // Only add non-zero discounts
              if (parsedValue > 0) {
                discounts.push({
                  productName: productInfo.name,
                  discountName: "Chegirma/Boshqa",
                  discountValue: parsedValue
                });

                hasDiscount = true;
                rowDebugInfo.foundDiscount = {
                  name: "Chegirma/Boshqa",
                  value: discountValue,
                  parsedValue: parsedValue
                };
              }
            }
          }

          nextRow = nextRow.nextElementSibling;
        }

        debugInfo.push(rowDebugInfo);
      });

      // Fallback approach: Look for discount rows anywhere in the table
      if (discounts.length === 0) {
        debugInfo.push({ message: "No discounts found with primary method, trying fallback" });

        // Get all rows and look for discounts
        const allRows = Array.from(document.querySelectorAll('table tbody tr'));
        let currentProduct = null;

        allRows.forEach(row => {
          if (row.classList.contains('products-row')) {
            // This is a product row, update current product
            const productInfo = extractProductInfo(row);
            if (productInfo) {
              currentProduct = productInfo;
            }
          } else if (currentProduct && row.textContent.toLowerCase().includes('chegirma/boshqa')) {
            // This is a discount row for the current product
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const discountValueCell = cells[cells.length - 1];
              let discountValue = discountValueCell?.innerText.trim();

              // Special handling for values like "20000/0"
              if (discountValue && discountValue.includes('/')) {
                discountValue = discountValue.split('/')[0].trim();
              }

              const parsedValue = parseNumericValue(discountValue);

              // Only add non-zero discounts
              if (parsedValue > 0) {
                discounts.push({
                  productName: currentProduct.name,
                  discountName: "Chegirma/Boshqa",
                  discountValue: parsedValue
                });

                debugInfo.push({
                  message: "Found discount with fallback method",
                  product: currentProduct.name,
                  discount: { name: "Chegirma/Boshqa", value: discountValue }
                });
              }
            }
          }
        });
      }

      // Get summary rows as before
      const summary = [];
      const allRows = Array.from(document.querySelectorAll('table tbody tr'));

      const summaryKeywords = [
        { keyword: 'naqd pul', exact: true },
        { keyword: 'bank kartalari', exact: true },
        { keyword: 'bank kartasi turi', exact: true },
        { keyword: 'jami to\'lov', exact: false },
        { keyword: 'jami tolov', exact: false },
      ];

      allRows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 2) {
          const label = cells[0]?.innerText.trim().toLowerCase();
          const value = cells[1]?.innerText.trim();

          const matchedKeyword = summaryKeywords.find(item => {
            const normalizedLabel = label.replace(/'/g, ''); // Normalize label for matching
            const normalizedKeyword = item.keyword.replace(/'/g, '');
            if (item.exact) {
              return normalizedLabel === normalizedKeyword;
            } else {
              // For 'jami tolov', check if label contains both 'jami' and 'tolov' (or 'lov')
              if (normalizedKeyword.includes('jami') && (normalizedKeyword.includes('tolov') || normalizedKeyword.includes('lov'))) {
                return normalizedLabel.includes('jami') && (normalizedLabel.includes('tolov') || normalizedLabel.includes('lov'));
              }
              return normalizedLabel.includes(normalizedKeyword);
            }
          });

          if (matchedKeyword && label && value) {
            const cleanedValue = value.replace(/[,\s]/g, '');
            const numericValue = parseFloat(cleanedValue);

            summary.push({
              name: cells[0]?.innerText.trim(),
              quantity: null,
              price: !isNaN(numericValue) ? numericValue : value
            });
          }
        }
      });

      return {
        products,
        discounts, // Include discounts in the response
        summary,
        debug: {
          debugInfo,
          rowsFound: {
            productRows: productRows.length,
            discountRows: discounts.length
          }
        }
      };
    });

    console.log('Scraping debug info:', JSON.stringify(data.debug, null, 2));

    // Remove debug info before returning data to client
    delete data.debug;
    return data;
  } catch (error) {
    console.error('Error during scraping:', error);
    throw new Error(`Failed to scrape data: ${error.message}`);
  } finally {
    await page.close();
  }
};

// Keep only this single route handler for /api/check
app.get('/api/check', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL query parameter is required' });
    }

    if (!url.includes('ofd.soliq.uz/check')) {
      return res.status(400).json({ error: 'Invalid receipt URL format' });
    }

    const receiptData = await readCheck(url);

    res.json({
      products: receiptData.products,
      discounts: receiptData.discounts, // Include discounts in the response
      summary: receiptData.summary
    });

  } catch (error) {
    console.error('❌ Error processing receipt via /api/check:', error.message);
    res.status(500).json({
      error: 'Failed to process receipt',
      message: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
