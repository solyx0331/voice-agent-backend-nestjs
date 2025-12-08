import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { AgentsModule } from "./modules/agents/agents.module";
import { CallsModule } from "./modules/calls/calls.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { UploadModule } from "./modules/upload/upload.module";
import { SearchModule } from "./modules/search/search.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // In production (Railway), ignore .env file and use environment variables directly
      // In development, try to load from .env file if it exists
      envFilePath: process.env.NODE_ENV === "production" ? undefined : ".env",
      ignoreEnvFile: process.env.NODE_ENV === "production",
      // Always load from process.env (Railway injects variables here)
      load: [],
      // Expand variables (useful for Railway)
      expandVariables: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Log all database-related environment variables for debugging
        console.log("=== Database Configuration Debug ===");
        console.log("NODE_ENV:", process.env.NODE_ENV);
        
        // Log all environment variables that might contain database connection info
        const dbRelatedVars = [
          "DATABASE_URL",
          "MONGO_URL",
          "MONGODB_URI",
          "MONGODB_URL",
          "DB_HOST",
          "DB_NAME",
          "DB_USERNAME",
          "DB_PASSWORD",
        ];
        
        console.log("--- Environment Variables Check ---");
        dbRelatedVars.forEach((varName) => {
          const value = process.env[varName];
          console.log(`${varName}:`, value ? (varName.includes("PASSWORD") ? "***HIDDEN***" : value.substring(0, 50)) : "NOT SET");
        });
        
        console.log("DATABASE_URL from configService:", configService.get<string>("DATABASE_URL") ? "SET" : "NOT SET");
        
        // Try to get DATABASE_URL from process.env first (Railway injects here)
        // Then check configService, then check Railway-specific MongoDB variables
        let databaseUrl = 
          process.env.DATABASE_URL ||
          configService.get<string>("DATABASE_URL") ||
          process.env.MONGO_URL ||
          process.env.MONGODB_URI ||
          process.env.MONGODB_URL;
        
        console.log("Final databaseUrl:", databaseUrl ? `${databaseUrl.substring(0, 50)}...` : "undefined");
        
        // Use DATABASE_URL if provided, otherwise construct from individual config
        if (databaseUrl) {
          // Ensure database name is included in the connection string
          let uri = databaseUrl;
          const dbName = configService.get<string>("DB_NAME") || "voice_ai_agent";
          
          // If URI doesn't have a database name, add it
          if (!uri.includes("/") || uri.split("/").length < 2 || uri.split("/")[1].includes("?")) {
            // Extract query parameters if they exist
            const urlParts = uri.split("?");
            const baseUrl = urlParts[0];
            const queryParams = urlParts[1] || "";
            
            // Add database name before query parameters
            const separator = baseUrl.endsWith("/") ? "" : "/";
            uri = `${baseUrl}${separator}${dbName}${queryParams ? `?${queryParams}` : ""}`;
          }

          return {
            uri,
            retryWrites: true,
            w: "majority",
          };
        }

        // Fallback to individual config
        const host = configService.get<string>("DB_HOST") || "localhost";
        const port = configService.get<string>("DB_PORT") || "27017";
        const database = configService.get<string>("DB_NAME") || "voice_ai_agent";
        const username = configService.get<string>("DB_USERNAME");
        const password = configService.get<string>("DB_PASSWORD");

        let uri = `mongodb://`;
        if (username && password) {
          uri += `${username}:${password}@`;
        }
        uri += `${host}:${port}/${database}`;

        return {
          uri,
        };
      },
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads",
    }),
    DashboardModule,
    AgentsModule,
    CallsModule,
    ContactsModule,
    SettingsModule,
    UploadModule,
    SearchModule,
  ],
})
export class AppModule {}

