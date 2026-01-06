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
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { WebSocketModule } from "./modules/websocket/websocket.module";
import { ConversationModule } from "./modules/conversation/conversation.module";

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
        // Railway MongoDB provides MONGO_URL or DATABASE_URL
        // Check both environment variables (Railway uses MONGO_URL, but we also support DATABASE_URL)
        const databaseUrl = 
          process.env.MONGO_URL ||
          process.env.DATABASE_URL || 
          configService.get<string>("MONGO_URL") ||
          configService.get<string>("DATABASE_URL");
        
        const dbName = 
          process.env.DB_NAME || 
          configService.get<string>("DB_NAME") || 
          "voice_ai_agent";
        
        if (!databaseUrl) {
          throw new Error(
            "MongoDB connection string is required. Please set MONGO_URL or DATABASE_URL environment variable."
          );
        }

        console.log("Connecting to MongoDB...");
        console.log("Database URL:", databaseUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")); // Hide credentials in logs

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
      },
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads",
      serveStaticOptions: {
        index: false, // Don't serve index files
      },
    }),
    DashboardModule,
    AgentsModule,
    CallsModule,
    ContactsModule,
    SettingsModule,
    UploadModule,
    SearchModule,
    VoicesModule,
    WebhooksModule,
    WebSocketModule,
    ConversationModule,
  ],
})
export class AppModule {}

