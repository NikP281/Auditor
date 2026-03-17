const fetchHtml = require("../utils/fetchHtml");
const runSeo = require("../services/seoService");
const runValidation = require("../services/validationService");
const { checkSSL } = require('../services/securityService');

const auditTemplate = require("../templates/auditTemplate.json");

exports.runAudit = async (req, res) => {

try {

const { url } = req.body;

if (!url) {
return res.status(400).json({ error: "URL required" });
}

const page = await fetchHtml(url);

const seo = await runSeo(
page.html,
url,
page.statusCode,
page.ttfb
);

const validation = await runValidation(page.html);

const security = await checkSSL(url);

const result = {

...auditTemplate,

url: url,
timestamp: new Date().toISOString(),

seo,
security,
validation

};

// scores
result.scores.seo = seo.overallScore || 0;
result.scores.security = security.overallScore || 0;
result.scores.validation = validation.overallScore || 0;

result.scores.overall = Math.round(
(
result.scores.seo +
result.scores.security +
result.scores.validation
) / 3
);

res.json(result);

}
catch (error) {

res.status(500).json({
error: "Audit failed",
message: error.message
});

}

};