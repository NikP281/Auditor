const https = require('https');
const urlModule = require('url');
const securityTemplate = require('../templates/securityTemplate.json');

/**
 * Функция для оценки true/false параметров в good/bad
 */
function scoreBool(value, goodText, badText) {
    return {
        score: value ? 'good' : 'bad',
        description: value ? goodText : badText,
        recommendation: value ? 'Поддерживайте текущую настройку' : 'Настройте этот параметр безопасности'
    };
}

/**
 * Проверка SSL и заголовков безопасности
 */
async function checkSSL(url) {
    const result = { ...securityTemplate };

    try {
        const parsedUrl = urlModule.parse(url);
        result.https = scoreBool(parsedUrl.protocol === 'https:', 'Сайт использует HTTPS', 'Сайт не использует HTTPS');

        if (parsedUrl.protocol !== 'https:') {
            // Если нет HTTPS, остальное бессмысленно
            result.ssl_valid = scoreBool(false, '', '');
            result.ssl_expiry = scoreBool(false, '', '');
            result.ssl_issuer = '';
            result.ssl_expiry_date = '';
            result.ssl_days_left = 0;
            ['hsts','csp','x_frame_options','x_content_type_options','referrer_policy','permissions_policy']
                .forEach(key => result[key] = scoreBool(false, '', ''));
            result.overallScore = 0;
            return result;
        }

        // Настройка запроса с отдельным агентом (без keepAlive)
        const options = {
            method: 'GET',
            host: parsedUrl.hostname,
            port: 443,
            path: '/',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            rejectUnauthorized: false,
            agent: new https.Agent({ keepAlive: false }),
            timeout: 5000
        };

        await new Promise((resolve) => {
            const req = https.request(options, (res) => {
                try {
                    // SSL
                    const cert = res.socket.getPeerCertificate(true);
                    if (!cert || !Object.keys(cert).length) {
                        result.ssl_valid = scoreBool(false, '', '');
                        result.ssl_issuer = '';
                        result.ssl_expiry_date = '';
                        result.ssl_days_left = 0;
                        result.ssl_expiry = scoreBool(false, '', '');
                    } else {
                        result.ssl_valid = scoreBool(true, 'SSL сертификат действителен', 'SSL сертификат недействителен');
                        result.ssl_issuer = cert.issuer?.O || '';
                        result.ssl_expiry_date = cert.valid_to || '';
                        const expiry = new Date(cert.valid_to);
                        const now = new Date();
                        const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                        result.ssl_days_left = diffDays > 0 ? diffDays : 0;
                        result.ssl_expiry = scoreBool(diffDays > 0, `SSL сертификат истекает через ${result.ssl_days_left} дней`, 'SSL сертификат недоступен или истек');
                    }

                    // Заголовки безопасности
                    result.hsts = scoreBool(!!res.headers['strict-transport-security'], 'HSTS включен', 'HSTS отсутствует');
                    result.csp = scoreBool(!!res.headers['content-security-policy'], 'Content-Security-Policy настроен', 'CSP отсутствует');
                    result.x_frame_options = scoreBool(!!res.headers['x-frame-options'], 'X-Frame-Options настроен', 'X-Frame-Options отсутствует');
                    result.x_content_type_options = scoreBool(!!res.headers['x-content-type-options'], 'X-Content-Type-Options настроен', 'X-Content-Type-Options отсутствует');
                    result.referrer_policy = scoreBool(!!res.headers['referrer-policy'], 'Referrer-Policy настроен', 'Referrer-Policy отсутствует');
                    result.permissions_policy = scoreBool(!!res.headers['permissions-policy'], 'Permissions-Policy настроен', 'Permissions-Policy отсутствует');

                    resolve();
                } catch {
                    resolve();
                }
            });

            req.on('error', () => resolve());
            req.on('timeout', () => req.destroy());
            req.end();
        });

        // Вычисление overallScore
        const checks = [
            result.https,
            result.ssl_valid,
            result.ssl_expiry,
            result.hsts,
            result.csp,
            result.x_frame_options,
            result.x_content_type_options,
            result.referrer_policy,
            result.permissions_policy
        ];
        const points = checks.reduce((acc, c) => acc + (c.score === 'good' ? 1 : 0), 0);
        result.overallScore = Math.round((points / checks.length) * 100);

    } catch (err) {
        // На случай любых ошибок — заполняем дефолтными bad
        result.https = scoreBool(false, '', '');
        result.ssl_valid = scoreBool(false, '', '');
        result.ssl_issuer = '';
        result.ssl_expiry_date = '';
        result.ssl_days_left = 0;
        result.ssl_expiry = scoreBool(false, '', '');
        ['hsts','csp','x_frame_options','x_content_type_options','referrer_policy','permissions_policy']
            .forEach(key => result[key] = scoreBool(false, '', ''));
        result.overallScore = 0;
    }

    return result;
}

module.exports = { checkSSL };