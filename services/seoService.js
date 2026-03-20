const cheerio = require("cheerio");
const axios = require("axios");
const seoTemplate = require("../templates/seoTemplate.json");


function scoreToNumber(score) {
  if (score === "good") return 2;
  if (score === "warning") return 1;
  return 0;
}


function createResult(score, description, recommendation) {
  return { score, description, recommendation };
}


async function runSeo(html, url, statusCode, ttfb) {
  const $ = cheerio.load(html);
  let scores = [];

  function pushScore(score) {
    scores.push(scoreToNumber(score));
  }

 
  const title = $("title").text().trim();
  let titleResult;
  if (!title) {
    titleResult = createResult("bad", "Title отсутствует", "Добавьте тег <title> в <head>");
    pushScore("bad");
  } else if (title.length > 60) {
    titleResult = createResult("warning", "Title слишком длинный", "Сократите до 50-60 символов");
    pushScore("warning");
  } else {
    titleResult = createResult("good", "Title оптимальной длины", "Поддерживайте длину 50-60 символов");
    pushScore("good");
  }

  const metaDescription = $('meta[name="description"]').attr("content") || "";
  let metaResult;
  if (!metaDescription) {
    metaResult = createResult("bad", "Meta description отсутствует", "Добавьте meta description");
    pushScore("bad");
  } else if (metaDescription.length > 160) {
    metaResult = createResult("warning", "Meta description слишком длинный", "Оптимальная длина 150-160 символов");
    pushScore("warning");
  } else {
    metaResult = createResult("good", "Meta description корректен", "Поддерживайте длину 150-160 символов");
    pushScore("good");
  }


  const h1Count = $("h1").length;
  let h1Result;
  if (h1Count === 0) {
    h1Result = createResult("bad", "H1 отсутствует", "Добавьте основной заголовок H1");
    pushScore("bad");
  } else if (h1Count > 1) {
    h1Result = createResult("warning", "Несколько H1 на странице", "Используйте только один H1");
    pushScore("warning");
  } else {
    h1Result = createResult("good", "H1 корректно используется", "Оставляйте один основной H1");
    pushScore("good");
  }

 
  const images = $("img");
  let imagesWithoutAlt = 0;
  images.each((i, el) => {
    if (!$(el).attr("alt")) imagesWithoutAlt++;
  });
  let imagesResult;
  if (imagesWithoutAlt > 0) {
    imagesResult = createResult("warning", `${imagesWithoutAlt} изображений без alt`, "Добавьте alt для изображений");
    pushScore("warning");
  } else {
    imagesResult = createResult("good", "Все изображения имеют alt", "Продолжайте добавлять alt");
    pushScore("good");
  }

  let robotsResult;
  try {
    const robotsUrl = new URL("/robots.txt", url).href;
    const res = await axios.get(robotsUrl, { timeout: 5000 });
    robotsResult = res.status === 200
      ? createResult("good", "robots.txt найден", "Поддерживайте актуальность файла")
      : createResult("warning", "robots.txt отсутствует", "Создайте robots.txt");
    pushScore(robotsResult.score);
  } catch {
    robotsResult = createResult("warning", "robots.txt отсутствует", "Создайте robots.txt");
    pushScore("warning");
  }

 
  let sitemapResult;
  try {
    const sitemapUrl = new URL("/sitemap.xml", url).href;
    const res = await axios.get(sitemapUrl, { timeout: 5000 });
    sitemapResult = res.status === 200
      ? createResult("good", "sitemap.xml найден", "Поддерживайте актуальность карты сайта")
      : createResult("warning", "sitemap.xml отсутствует", "Добавьте sitemap.xml");
    pushScore(sitemapResult.score);
  } catch {
    sitemapResult = createResult("warning", "sitemap.xml отсутствует", "Добавьте sitemap.xml");
    pushScore("warning");
  }


  let ttfbCheck = ttfb <= 1200
    ? createResult("good", "TTFB быстрый", "Сервер отвечает быстро")
    : createResult("bad", "TTFB медленный", "Оптимизируйте сервер или используйте CDN");
  pushScore(ttfbCheck.score);


  let statusCodeCheck = statusCode === 200
    ? createResult("good", "Страница возвращает 200 OK", "Сервер отвечает корректно")
    : createResult("bad", `Страница возвращает ${statusCode}`, "Проверьте доступность страницы");
  pushScore(statusCodeCheck.score);


  const maxScore = scores.length * 2;
  const overallScore = Math.round((scores.reduce((a, b) => a + b, 0) / maxScore) * 100);

  return {
    ...seoTemplate,
    statusCode,
    ttfb,
    title: titleResult,
    metaDescription: metaResult,
    h1: h1Result,
    images: imagesResult,
    robotsTxt: robotsResult,
    sitemapXml: sitemapResult,
    ttfbCheck,
    statusCodeCheck,
    overallScore
  };
}

module.exports = runSeo;
