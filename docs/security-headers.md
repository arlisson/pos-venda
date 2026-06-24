# Headers de seguranca em producao

O backend Express ja aplica os headers de seguranca nas respostas da API.
Para o scanner do dominio publico ficar OK, os mesmos headers tambem precisam
ser configurados no servidor/CDN que entrega o frontend.

## Nginx / proxy reverso

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), picture-in-picture=(), usb=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://avancevip.net.br https://www.avancevip.net.br; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests" always;

location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
  add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location / {
  add_header Cache-Control "no-cache, must-revalidate" always;
  try_files $uri /index.html;
}
```

## Observacoes

- HSTS so deve ser habilitado quando o dominio e subdominios ja estiverem 100%
  em HTTPS.
- O header `server: hcdn` vem da hospedagem/CDN, nao do Express. Para remover
  ou mascarar, ajuste no painel da CDN/hospedagem ou no proxy reverso.
- Se a API estiver em outro subdominio, inclua esse host em `connect-src` da CSP.
