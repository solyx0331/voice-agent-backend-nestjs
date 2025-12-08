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
  const allowedPatterns = process.env.ALLOWED_ORIGIN_PATTERNS
    ? process.env.ALLOWED_ORIGIN_PATTERNS.split(",").map((pattern) => pattern.trim())
    : [
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.netlify\.app$/,
        /^https:\/\/.*\.ngrok-free\.dev$/,
        /^https:\/\/.*\.ngrok\.io$/,
      ];

  console.log("Allowed CORS origins:", allowedOrigins);
  console.log("Allowed CORS patterns:", allowedPatterns);

  // Enable CORS with explicit configuration
  app.enableCors({
    origin: (origin, callback) => {
      try {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) {
          console.log("CORS: Allowing request with no origin");
          return callback(null, true);
        }

        // Normalize origin (remove trailing slash)
        const normalizedOrigin = origin.replace(/\/$/, "");

        // Check if origin is in allowed list
        if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes(origin)) {
          console.log("CORS: Allowing origin (exact match):", origin);
          return callback(null, origin);
        }

        // Check if origin matches any allowed pattern
        const matchesPattern = allowedPatterns.some((pattern) => {
          try {
            if (pattern instanceof RegExp) {
              return pattern.test(normalizedOrigin) || pattern.test(origin);
            }
            return normalizedOrigin.includes(pattern) || origin.includes(pattern);
          } catch (e) {
            return false;
          }
        });

        if (matchesPattern) {
          console.log("CORS: Allowing origin (pattern match):", origin);
          return callback(null, origin);
        }

        // Log rejected origins for debugging
        console.log("CORS blocked origin:", origin);
        console.log("Allowed origins:", allowedOrigins);
        console.log("Allowed patterns:", allowedPatterns);
        // For development/debugging, you might want to allow all origins
        // In production, you should reject unknown origins
        if (process.env.NODE_ENV === "development") {
          console.log("CORS: Allowing origin in development mode:", origin);
          return callback(null, origin);
        }
        callback(new Error("Not allowed by CORS"));
      } catch (error) {
        console.error("CORS origin callback error:", error);
        // On error, allow the request to prevent blocking (for development)
        if (process.env.NODE_ENV === "development") {
          callback(null, origin || true);
        } else {
          callback(error);
        }
      }
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

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // API prefix
  app.setGlobalPrefix("api");

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();

