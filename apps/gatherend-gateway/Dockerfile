FROM caddy:2-builder AS builder
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

# Railway terminates TLS before reaching the container; Caddy runs HTTP only.
# For self-hosting, remove 'auto_https off' from Caddyfile to let Caddy handle TLS.
COPY Caddyfile /etc/caddy/Caddyfile

