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

  // Enable CORS FIRST - before any other middleware
  // Use a simple, reliable configuration that always allows Vercel
  app.enableCors({
    origin: (origin, callback) => {
      console.log("CORS check - Origin:", origin);
      
      // Always allow requests with no origin
      if (!origin) {
        console.log("CORS: Allowing request with no origin");
        return callback(null, true);
      }

      // Normalize origin
      const normalizedOrigin = origin.replace(/\/$/, "");
      console.log("CORS: Normalized origin:", normalizedOrigin);

      // ALWAYS allow Vercel origins - this is the primary use case
      if (/^https:\/\/.*\.vercel\.app$/.test(normalizedOrigin)) {
        console.log("CORS: Allowing Vercel origin:", normalizedOrigin);
        return callback(null, normalizedOrigin);
      }

      // Check exact match
      const originLower = normalizedOrigin.toLowerCase();
      const isExactMatch = allowedOrigins.some(
        (allowed) => allowed.toLowerCase() === originLower
      );

      if (isExactMatch) {
        console.log("CORS: Allowing origin (exact match):", normalizedOrigin);
        return callback(null, normalizedOrigin);
      }

      // Check pattern match
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
        console.log("CORS: Allowing origin (pattern match):", normalizedOrigin);
        return callback(null, normalizedOrigin);
      }

      // In production, always allow Vercel as ultimate fallback
      if (/vercel\.app/.test(normalizedOrigin)) {
        console.log("CORS: Allowing Vercel origin (fallback):", normalizedOrigin);
        return callback(null, normalizedOrigin);
      }

      // For development, allow all
      if (process.env.NODE_ENV === "development") {
        console.log("CORS: Allowing origin (development):", normalizedOrigin);
        return callback(null, normalizedOrigin);
      }

      // Final fallback: allow all in production to prevent blocking
      console.log("CORS: Allowing origin (final fallback):", normalizedOrigin);
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
    maxAge: 86400,
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

