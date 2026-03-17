const axios = require("axios");
const cheerio = require("cheerio");

function scoreToNumber(score) {
  if (score === "good") return 2;
  if (score === "warning") return 1;
  return 0;
}

function createResult(score, description, recommendation) {
  return { score, description, recommendation };
}

/**
 * Проверка HTML через W3C Validator API
 */
async function validateWithW3C(html) {

  try {

    const response = await axios.post(
      "https://validator.w3.org/nu/",
      html,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "User-Agent": "Mozilla/5.0 (compatible; AuditApp/1.0)"
        },
        params: { out: "json" },
        timeout: 15000
      }
    );

    const data = response.data;

    const errors = data.messages.filter(m => m.type === "error").length;

    const warnings = data.messages.filter(
      m => m.type === "warning" || m.type === "info"
    ).length;

    let score = "good";

    if (errors > 0 && errors <= 10) score = "warning";
    if (errors > 10) score = "bad";

    return {
      result: createResult(
        score,
        errors === 0
          ? "HTML валиден"
          : `Обнаружено ${errors} ошибок HTML`,
        errors === 0
          ? "Поддерживайте валидный HTML"
          : "Исправьте ошибки, указанные W3C Validator"
      ),
      errors,
      warnings
    };

  } catch (error) {

    console.error("W3C API error:", error.message);

    return {
      result: createResult(
        "warning",
        "Не удалось проверить HTML через W3C",
        "Попробуйте повторить проверку позже"
      ),
      errors: -1,
      warnings: -1
    };

  }

}

/**
 * Основной сервис валидации
 */
async function runValidation(html) {

  const $ = cheerio.load(html);

  let scores = [];

  function pushScore(score) {
    scores.push(scoreToNumber(score));
  }

  // ======================
  // W3C VALIDATION
  // ======================

  const w3c = await validateWithW3C(html);

  pushScore(w3c.result.score);

  // ======================
  // DUPLICATE META TAGS
  // ======================

  const metaCounts = {};

  $("meta").each((i, el) => {

    const name = $(el).attr("name");
    const property = $(el).attr("property");
    const key = name || property;

    if (key) {
      metaCounts[key] = (metaCounts[key] || 0) + 1;
    }

  });

  const duplicateMetaTags = Object.keys(metaCounts)
    .filter(key => metaCounts[key] > 1);

  let duplicateMetaResult;

  if (duplicateMetaTags.length > 0) {

    duplicateMetaResult = createResult(
      "warning",
      `Найдено ${duplicateMetaTags.length} дублирующихся meta тегов`,
      "Удалите дублирующиеся meta теги"
    );

  } else {

    duplicateMetaResult = createResult(
      "good",
      "Дублирующиеся meta теги не обнаружены",
      "Структура meta тегов корректна"
    );

  }

  pushScore(duplicateMetaResult.score);

  const duplicateMetaDetails = duplicateMetaTags.map(tag => ({
    name: tag,
    count: metaCounts[tag],
    recommendation: `Удалите дублирующийся meta-тег "${tag}".`
  }));

  // ======================
  // HTML STRUCTURE
  // ======================

  const headPresent = $("head").length > 0;
  const bodyPresent = $("body").length > 0;
  const titlePresent = $("title").length > 0;

  const headResult = createResult(
    headPresent ? "good" : "bad",
    headPresent ? "Тег <head> присутствует" : "Тег <head> отсутствует",
    headPresent
      ? "Убедитесь что метаданные корректны"
      : "Добавьте тег <head>"
  );

  const bodyResult = createResult(
    bodyPresent ? "good" : "bad",
    bodyPresent ? "Тег <body> присутствует" : "Тег <body> отсутствует",
    bodyPresent
      ? "Контент должен находиться внутри body"
      : "Добавьте тег <body>"
  );

  const titleResult = createResult(
    titlePresent ? "good" : "bad",
    titlePresent ? "Тег <title> присутствует" : "Тег <title> отсутствует",
    titlePresent
      ? "Title важен для SEO и доступности"
      : "Добавьте тег <title> в head"
  );

  pushScore(headResult.score);
  pushScore(bodyResult.score);
  pushScore(titleResult.score);

  // ======================
  // FINAL SCORE
  // ======================

  const maxScore = scores.length * 2;

  const overallScore = Math.round(
    (scores.reduce((a, b) => a + b, 0) / maxScore) * 100
  );

  // ======================
  // RETURN RESULT
  // ======================

  return {

    w3cValidation: {
      ...w3c.result,
      errors: w3c.errors,
      warningsOrInfos: w3c.warnings
    },

    duplicateMetaTags: {
      ...duplicateMetaResult,
      tags: duplicateMetaTags,
      details: duplicateMetaDetails
    },

    htmlStructure: {
      head: headResult,
      body: bodyResult,
      title: titleResult
    },

    overallScore

  };

}

module.exports = runValidation;