import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Trust Railway proxy (required for correct origin detection)
  app.getHttpAdapter().getInstance().set("trust proxy", true);

  // Single allowed origin (Vercel frontend)
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://voice-agent-phi-ten.vercel.app";

  // Early OPTIONS handler - MUST be first, before any other middleware
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      const origin = req.headers.origin;
      
      // Always set CORS headers for preflight (even if origin doesn't match)
      // This ensures browser gets a response and doesn't fail silently
      if (origin === allowedOrigin || process.env.NODE_ENV === "development") {
        res.header("Access-Control-Allow-Origin", origin || allowedOrigin);
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
    next();
  });

  // Simple CORS configuration - static origin, no callbacks
  app.enableCors({
    origin: process.env.NODE_ENV === "development" ? true : allowedOrigin,
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

  // Global validation pipe
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
  console.log(`CORS allowed origin: ${allowedOrigin}`);
  console.log(`Trust proxy: enabled`);
}

bootstrap();

