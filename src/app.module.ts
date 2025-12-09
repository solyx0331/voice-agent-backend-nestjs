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
import { VoicesModule } from "./modules/voices/voices.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // In development, load from .env file
      // In production (Railway), ignore .env and use environment variables from Railway
      envFilePath: process.env.NODE_ENV !== "production" ? ".env" : undefined,
      ignoreEnvFile: process.env.NODE_ENV === "production",
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Hardcoded database configuration
        const databaseUrl = 
          process.env.DATABASE_URL || 
          configService.get<string>("DATABASE_URL") ||
          "mongodb+srv://admin:EF7XnO2jDMgGGLMo@voiceai.8anhs3c.mongodb.net/?appName=voiceai";
        const dbName = 
          process.env.DB_NAME || 
          configService.get<string>("DB_NAME") || 
          "voice_ai_agent";
        
        console.log("databaseUrl  ==>", databaseUrl);

        if (databaseUrl) {
          // Ensure database name is included in the connection string
          let uri = databaseUrl;
          
          // Check if database name is missing (URI ends with / or ?)
          const urlMatch = uri.match(/^mongodb(\+srv)?:\/\/[^/]+(\/|$|\?)/);
          if (urlMatch && !uri.includes(`/${dbName}`) && !uri.match(/\/[^?]+(\?|$)/)) {
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

        // Fallback: construct from individual config variables
        const host = configService.get<string>("DB_HOST") || "localhost";
        const port = configService.get<string>("DB_PORT") || "27017";
        const database = dbName;
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
    VoicesModule,
  ],
})
export class AppModule {}

