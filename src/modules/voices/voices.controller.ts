import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RetellService } from "../../services/retell.service";
import { VoicesService } from "./voices.service";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";

// Ensure upload directory exists
const uploadDir = join(process.cwd(), "uploads", "voices");
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@Controller("voices")
export class VoicesController {
  constructor(
    private readonly retellService: RetellService,
    private readonly voicesService: VoicesService
  ) {}

  @Get()
  async getAvailableVoices() {
    const voices = await this.retellService.listAvailableVoices();
    return voices;
  }

  @Get("custom")
  async getCustomVoices() {
    const voices = await this.voicesService.findAll();
    return voices.map((voice) => ({
      id: voice._id.toString(),
      name: voice.name,
      voiceId: voice.voiceId,
      url: voice.url,
      createdAt: voice.createdAt.toISOString(),
      type: voice.type,
    }));
  }

  @Post("custom")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: uploadDir,
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const ext = extname(file.originalname);
          cb(null, `voice_${timestamp}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        // Accept audio files or webm (for recordings)
        if (file.mimetype.startsWith("audio/") || file.mimetype === "video/webm" || file.mimetype === "audio/webm") {
          cb(null, true);
        } else {
          cb(new BadRequestException("Please upload an audio file"), false);
        }
      },
    })
  )
  async uploadCustomVoice(
    @UploadedFile() file: Express.Multer.File,
    @Body("name") name?: string,
    @Body("type") type?: "uploaded" | "recorded"
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Determine type from request or file
    const voiceType = type || (file.mimetype === "video/webm" || file.mimetype === "audio/webm" ? "recorded" : "uploaded");

    const voice = await this.voicesService.create(file, name, voiceType);

    return {
      id: voice._id.toString(),
      name: voice.name,
      voiceId: voice.voiceId,
      url: voice.url,
      createdAt: voice.createdAt.toISOString(),
      type: voice.type,
    };
  }

  @Delete("custom/:id")
  async deleteCustomVoice(@Param("id") id: string) {
    await this.voicesService.remove(id);
    return { message: "Custom voice deleted successfully" };
  }
}

