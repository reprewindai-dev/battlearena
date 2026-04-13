# SSL/HTTPS Configuration Guide

This guide explains how to set up SSL/HTTPS for BattleArena production deployment.

## Option 1: Let's Encrypt (Recommended for Production)

### Prerequisites
- Domain name pointing to your server
- Server with public IP address
- Port 80 and 443 open on firewall

### Steps

1. **Install Certbot**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

2. **Generate SSL Certificate**
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

3. **Update nginx.conf**
The nginx.conf file already has SSL configuration commented out. Uncomment and update:
```nginx
# Uncomment the HTTPS server block in nginx.conf
# Update the SSL certificate paths:
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

4. **Update Docker Compose**
Update docker-compose.yml to mount the SSL certificates:
```yaml
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  depends_on:
    - app
  restart: unless-stopped
  profiles:
    - production
```

5. **Auto-renewal**
Certbot auto-renews certificates by default. Test renewal:
```bash
sudo certbot renew --dry-run
```

## Option 2: Cloudflare SSL (Recommended for ease of use)

### Steps

1. **Add your domain to Cloudflare**
   - Sign up at cloudflare.com
   - Add your domain
   - Update your domain's nameservers to Cloudflare's nameservers

2. **Enable SSL/TLS**
   - Go to SSL/TLS settings in Cloudflare dashboard
   - Set SSL/TLS mode to "Full" or "Full (strict)"

3. **Configure nginx for HTTP only**
   - Keep nginx.conf with HTTP only (port 80)
   - Cloudflare will handle HTTPS termination

4. **Update DNS**
   - Add A record pointing to your server IP
   - Enable "Proxy status" (orange cloud icon)

## Option 3: Self-Signed Certificate (Development Only)

**NOT recommended for production**

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./ssl/privkey.pem \
  -out ./ssl/fullchain.pem \
  -subj "/CN=localhost"
```

Then update docker-compose.yml to use the self-signed certs.

## Verification

After setting up SSL, verify:
```bash
# Check SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Or use online tools:
# - https://www.ssllabs.com/ssltest/
# - https://www.cloudflare.com/ssl/
```

## Troubleshooting

### Certificate not found
- Ensure certificate files exist at the specified paths
- Check file permissions
- Verify Docker volume mounts

### Mixed content warnings
- Ensure all resources use HTTPS
- Update NEXT_PUBLIC_SITE_URL in .env.production

### Certificate expired
- Check auto-renewal is working
- Manually renew with: `sudo certbot renew`
