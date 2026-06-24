const ONE_YEAR_SECONDS = 31536000;

const securityHeaders = Object.freeze({
  'Strict-Transport-Security': `max-age=${ONE_YEAR_SECONDS}; includeSubDomains`,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'autoplay=()',
    'camera=()',
    'display-capture=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'picture-in-picture=()',
    'usb=()'
  ].join(', '),
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0'
});

/**
 * Aplica headers defensivos nas respostas da API.
 */
function securityHeadersMiddleware(req, res, next) {
  Object.entries(securityHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  next();
}

module.exports = {
  securityHeaders,
  securityHeadersMiddleware
};
