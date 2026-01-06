import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Build static whitelist of allowed origins (required for credentials: true)
  const staticOrigins: string[] = process.env.ALLOWED_ORIGINS
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

  // Add Vercel pattern matching origins dynamically (for Railway/Vercel compatibility)
  const vercelPattern = /^https:\/\/.*\.vercel\.app$/;
  const netlifyPattern = /^https:\/\/.*\.netlify\.app$/;
  const ngrokPattern = /^https:\/\/.*\.ngrok(-free)?\.(dev|io)$/;

  // Helper to check if origin matches patterns
  // Returns: allowed origin string, true (for no-origin requests), or false (rejected)
  const isOriginAllowed = (origin: string | undefined): string | true | false => {
    if (!origin) {
      // Allow requests with no origin (e.g., Postman, curl) - return true, not wildcard
      return true;
    }

    const normalized = origin.replace(/\/$/, "");

    // Check static whitelist (case-insensitive)
    const exactMatch = staticOrigins.find(
      (allowed) => allowed.toLowerCase() === normalized.toLowerCase()
    );
    if (exactMatch) {
      return exactMatch; // Return whitelisted origin (not dynamic one)
    }

    // Check Vercel pattern (validated pattern, safe to return actual origin)
    if (vercelPattern.test(normalized)) {
      return normalized;
    }

    // Check Netlify pattern
    if (netlifyPattern.test(normalized)) {
      return normalized;
    }

    // Check ngrok pattern
    if (ngrokPattern.test(normalized)) {
      return normalized;
    }

    // In development, allow all origins
    if (process.env.NODE_ENV === "development") {
      return normalized;
    }

    // Reject in production if not in whitelist
    return false;
  };

  // Explicit OPTIONS handler middleware - MUST be first
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      const origin = req.headers.origin;
      const allowedOrigin = isOriginAllowed(origin);

      if (allowedOrigin !== false) {
        // For no-origin requests, don't set Access-Control-Allow-Origin (browser won't send credentials anyway)
        if (allowedOrigin !== true) {
          res.header("Access-Control-Allow-Origin", allowedOrigin);
          res.header("Access-Control-Allow-Credentials", "true");
        }
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
        res.header(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With, Accept, Origin, Access-Control-Request-Method, Access-Control-Request-Headers, ngrok-skip-browser-warning"
        );
        res.header("Access-Control-Max-Age", "86400");
        res.header("Access-Control-Expose-Headers", "Content-Range, X-Content-Range");
        return res.status(204).send();
      }

      // Reject preflight if origin not allowed
      return res.status(403).send("CORS policy: Origin not allowed");
    }
    next();
  });

  // CORS configuration (for non-OPTIONS requests)
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigin = isOriginAllowed(origin);
      if (allowedOrigin !== false) {
        callback(null, allowedOrigin);
      } else {
        callback(new Error("CORS policy: Origin not allowed"));
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
    maxAge: 86400,
  });

  // API prefix
  app.setGlobalPrefix("api");

  // Global validation pipe (NestJS automatically skips OPTIONS, but we ensure it)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      skipMissingProperties: false,
      skipNullProperties: false,
    })
  );

  const port = process.env.PORT || 8000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`CORS enabled for origins: ${staticOrigins.join(", ")}`);
  console.log(`CORS patterns: Vercel, Netlify, ngrok`);
}

bootstrap();

