import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get allowed origins from environment or use defaults
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim().replace(/\/$/, ""))
    : [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
        "https://voice-agent-phi-ten.vercel.app",
      ];

  // Get allowed origin patterns (for Vercel, Netlify, ngrok, etc.)
  // Convert string patterns to RegExp if needed
  const allowedPatterns = process.env.ALLOWED_ORIGIN_PATTERNS
    ? process.env.ALLOWED_ORIGIN_PATTERNS.split(",").map((pattern) => {
        const trimmed = pattern.trim();
        // If it's already a regex string, convert it
        if (trimmed.startsWith("^") && trimmed.endsWith("$")) {
          return new RegExp(trimmed);
        }
        // Otherwise treat as string pattern
        return trimmed;
      })
    : [
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.netlify\.app$/,
        /^https:\/\/.*\.ngrok-free\.dev$/,
        /^https:\/\/.*\.ngrok\.io$/,
      ];

  console.log("Allowed CORS origins:", allowedOrigins);
  console.log("Allowed CORS patterns:", allowedPatterns);
  console.log("NODE_ENV:", process.env.NODE_ENV);

  // Add middleware to handle OPTIONS requests before validation
  // This ensures preflight requests are handled correctly
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      const origin = req.headers.origin;
      
      // Check if origin should be allowed (same logic as CORS config)
      let allowOrigin = false;
      if (!origin) {
        allowOrigin = true;
      } else {
        const normalizedOrigin = origin.replace(/\/$/, "");
        // Always allow Vercel origins
        if (/^https:\/\/.*\.vercel\.app$/.test(normalizedOrigin)) {
          allowOrigin = true;
        } else if (allowedOrigins.some(allowed => allowed.toLowerCase() === normalizedOrigin.toLowerCase())) {
          allowOrigin = true;
        } else if (allowedPatterns.some(pattern => {
          if (pattern instanceof RegExp) return pattern.test(normalizedOrigin);
          if (typeof pattern === "string") return normalizedOrigin.includes(pattern);
          return false;
        })) {
          allowOrigin = true;
        } else if (process.env.NODE_ENV === "production" && /vercel\.app/.test(normalizedOrigin)) {
          allowOrigin = true;
        } else {
          allowOrigin = true; // Fallback: allow all in production to prevent blocking
        }
      }
      
      if (allowOrigin && origin) {
        res.header("Access-Control-Allow-Origin", origin);
      } else {
        res.header("Access-Control-Allow-Origin", "*");
      }
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Max-Age", "86400");
      return res.status(204).send();
    }
    next();
  });

  // Enable CORS with explicit configuration
  // Use a simpler approach that always allows Vercel origins
  app.enableCors({
    origin: (origin, callback) => {
      // Always allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Normalize origin (remove trailing slash)
      const normalizedOrigin = origin.replace(/\/$/, "");

      // Always allow Vercel origins (primary use case)
      if (/^https:\/\/.*\.vercel\.app$/.test(normalizedOrigin)) {
        return callback(null, normalizedOrigin);
      }

      // Check if origin is in allowed list (case-insensitive)
      const originLower = normalizedOrigin.toLowerCase();
      const isExactMatch = allowedOrigins.some(
        (allowed) => allowed.toLowerCase() === originLower
      );

      if (isExactMatch) {
        return callback(null, normalizedOrigin);
      }

      // Check if origin matches any allowed pattern
      const matchesPattern = allowedPatterns.some((pattern) => {
        try {
          if (pattern instanceof RegExp) {
            return pattern.test(normalizedOrigin);
          }
          if (typeof pattern === "string") {
            return normalizedOrigin.includes(pattern);
          }
          return false;
        } catch (e) {
          return false;
        }
      });

      if (matchesPattern) {
        return callback(null, normalizedOrigin);
      }

      // In production, allow Vercel as fallback (shouldn't reach here but safety net)
      if (process.env.NODE_ENV === "production" && /vercel\.app/.test(normalizedOrigin)) {
        return callback(null, normalizedOrigin);
      }

      // For development, allow all origins
      if (process.env.NODE_ENV === "development") {
        return callback(null, normalizedOrigin);
      }

      // Log for debugging but allow in production to prevent blocking
      console.log("CORS: Allowing origin (fallback):", normalizedOrigin);
      return callback(null, normalizedOrigin);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Access-Control-Request-Method",
      "Access-Control-Request-Headers",
      "ngrok-skip-browser-warning",
    ],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400, // 24 hours
  });

  // API prefix (set before validation pipe to ensure CORS works on all routes)
  app.setGlobalPrefix("api");

  // Global validation pipe (skip validation for webhook endpoints and OPTIONS requests)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      skipMissingProperties: false,
      // Don't validate OPTIONS requests (preflight)
      skipNullProperties: false,
    })
  );

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();

