const axios = require("axios");

async function fetchHtml(url) {

  const start = Date.now();

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5"
    },
    validateStatus: () => true
  });

  const ttfb = Date.now() - start;

  return {
    html: response.data,
    statusCode: response.status,   
    headers: response.headers,
    ttfb: ttfb
  };
}

module.exports = fetchHtml;
