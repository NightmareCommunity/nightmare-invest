/**
 * In-memory per-IP token-bucket rate limiter.
 *
 * Scope note:
 *   - This is per-instance, in-memory rate limiting — suitable for a
 *     single-server deployment or as a first line of defense behind a
 *     load balancer. For multi-instance deployments, back this with
 *     Redis or use edge rate-limiting (e.g. Cloudflare, Vercel Edge).
 *   - It does NOT affect authentication persistence — auth state lives
 *     in the database (RefreshToken / Session / AuthChallenge tables).
 *     This only throttles brute-force attempts against /login, /signup,
 *     /refresh, /password-reset endpoints.
 *
 * Buckets are sized per (ip, route) pair and garbage-collected lazily.
 */
type Bucket = { tokens: number; lastRefill: number };

const MAX_BUCKETS = 10_000; // cap to prevent unbounded memory growth
const buckets = new Map<string, Bucket>();

interface RateLimitOptions {
  /** Maximum tokens in the bucket (burst capacity). */
  capacity: number;
  /** Tokens added per second (sustained rate). */
  refillPerSec: number;
  /** Optional identifier override (default: client IP). */
  identifier?: string;
}

/**
 * Consume 1 token from the bucket. Returns true if allowed, false if
 * rate-limited. Mutates the bucket in place.
 */
export function rateLimit(opts: RateLimitOptions): boolean {
  const id = opts.identifier ?? "anon";
  const now = Date.now();
  let bucket = buckets.get(id);

  if (!bucket) {
    // Evict oldest if we're at capacity
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    bucket = { tokens: opts.capacity, lastRefill: now };
    buckets.set(id, bucket);
  }

  // Refill based on elapsed time
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsedSec * opts.refillPerSec);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/**
 * Extract a client identifier (IP) from a Request, suitable for rate
 * limiting. Falls back to "anon" if no IP is available.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "anon";
}

/**
 * Convenience presets for auth endpoints.
 */
export const RATE_LIMITS = {
  // Login: 5 attempts per 30s burst, refills 1 per 30s
  login: { capacity: 5, refillPerSec: 1 / 30 },
  // Signup: 3 per 60s burst, refills 1 per 60s
  signup: { capacity: 3, refillPerSec: 1 / 60 },
  // Refresh: 30 per minute (legitimate clients refresh at most once per 30min)
  refresh: { capacity: 30, refillPerSec: 0.5 },
  // Password reset: 3 per hour (prevent email enumeration / abuse)
  passwordReset: { capacity: 3, refillPerSec: 1 / 60 / 60 },
} as const;

/**
 * Check rate limit and return a 429 Response if exceeded, otherwise null.
 */
export function enforceRateLimit(
  req: Request,
  preset: keyof typeof RATE_LIMITS,
  identifierPrefix = ""
): Response | null {
  const ip = getClientIp(req);
  const id = identifierPrefix ? `${identifierPrefix}:${ip}` : ip;
  const allowed = rateLimit({ ...RATE_LIMITS[preset], identifier: id });
  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
        retryAfter: "60s",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }
  return null;
}
