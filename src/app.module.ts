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
      envFilePath: ".env",
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>("DATABASE_URL");
        
        // Use DATABASE_URL if provided, otherwise construct from individual config
        if (databaseUrl) {
          return {
            uri: databaseUrl,
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

