import crypto from 'crypto';

// Security utilities for Arena v2

export class SecurityUtils {
  // Generate secure random tokens
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data
  static hashData(data: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    return crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512').toString('hex');
  }

  // Verify data hash
  static verifyHash(data: string, hash: string, salt: string): boolean {
    const computedHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
    return computedHash === hash;
  }

  // Generate room codes
  static generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Sanitize input to prevent XSS
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate username format
  static isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
    return usernameRegex.test(username);
  }

  // Validate strong password
  static isStrongPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  // Rate limiting implementation
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (identifier: string): boolean => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean up old entries
      for (const [key, value] of requests.entries()) {
        if (value.resetTime < now) {
          requests.delete(key);
        }
      }

      const current = requests.get(identifier);
      
      if (!current) {
        requests.set(identifier, { count: 1, resetTime: now + windowMs });
        return true;
      }

      if (current.resetTime < now) {
        requests.set(identifier, { count: 1, resetTime: now + windowMs });
        return true;
      }

      if (current.count >= maxRequests) {
        return false;
      }

      current.count++;
      return true;
    };
  }

  // Encrypt sensitive data
  static encrypt(text: string, key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  // Decrypt sensitive data
  static decrypt(encryptedText: string, key: string): string {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedData = textParts.join(':');
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Generate CSRF token
  static generateCSRFToken(): string {
    return this.generateSecureToken(32);
  }

  // Verify CSRF token
  static verifyCSRFToken(token: string, sessionToken: string): boolean {
    return token === sessionToken;
  }

  // Content Security Policy header
  static getCSPHeader(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "media-src 'self' blob:",
      "connect-src 'self' https://api.stripe.com wss://localhost:8080",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ');
  }

  // Security headers
  static getSecurityHeaders() {
    return {
      'Content-Security-Policy': this.getCSPHeader(),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    };
  }

  // Input validation patterns
  static validationPatterns = {
    username: /^[a-zA-Z0-9_]{3,50}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    roomCode: /^[A-Z0-9]{6}$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    token: /^[a-f0-9]{64}$/i
  };

  // Validate input against pattern
  static validateInput(input: string, pattern: keyof typeof this.validationPatterns): boolean {
    return this.validationPatterns[pattern].test(input);
  }

  // Escape HTML entities
  static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Generate secure session ID
  static generateSessionId(): string {
    return this.generateSecureToken(64);
  }

  // Check if request is from same origin
  static isSameOrigin(request: { headers: { origin?: string; referer?: string } }, allowedOrigin: string): boolean {
    const origin = request.headers.origin || request.headers.referer;
    if (!origin) return false;
    return origin === allowedOrigin || origin.startsWith(allowedOrigin);
  }

  // Rate limit by IP
  static ipRateLimiters = new Map<string, ReturnType<typeof SecurityUtils.createRateLimiter>>();

  static getRateLimiter(key: string, maxRequests: number, windowMs: number) {
    if (!this.ipRateLimiters.has(key)) {
      this.ipRateLimiters.set(key, this.createRateLimiter(maxRequests, windowMs));
    }
    return this.ipRateLimiters.get(key)!;
  }

  // Sanitize file name
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  // Validate file type
  static isValidFileType(fileName: string, allowedTypes: string[]): boolean {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return extension ? allowedTypes.includes(extension) : false;
  }

  // Generate API key
  static generateApiKey(): string {
    const timestamp = Date.now().toString();
    const random = this.generateSecureToken(16);
    return `arena_${timestamp}_${random}`;
  }

  // Verify API key format
  static isValidApiKey(apiKey: string): boolean {
    return /^arena_\d+_[a-f0-9]{32}$/i.test(apiKey);
  }
}
