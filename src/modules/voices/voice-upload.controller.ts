import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { VoicesService } from "./voices.service";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";

// Ensure upload directory exists
const uploadDir = join(process.cwd(), "uploads", "voices");
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

/**
 * Voice upload controller for client portal
 * Accepts MP3 or WAV files and creates custom voice clone via ElevenLabs
 */
@Controller()
export class VoiceUploadController {
  constructor(private readonly voicesService: VoicesService) {}

  /**
   * Voice upload endpoint for client portal
   * Accepts MP3 or WAV files and creates custom voice clone via ElevenLabs
   * POST /voice-upload
   */
  @Post("voice-upload")
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
        // Only accept MP3 or WAV for voice cloning
        const allowedMimes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave"];
        const allowedExts = [".mp3", ".wav"];
        const ext = extname(file.originalname).toLowerCase();
        
        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
          cb(null, true);
        } else {
          cb(new BadRequestException("Please upload an MP3 or WAV file"), false);
        }
      },
    })
  )
  async uploadVoice(
    @UploadedFile() file: Express.Multer.File,
    @Body("name") name?: string,
    @Body("agentId") agentId?: string
  ) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Create custom voice via ElevenLabs
    const voice = await this.voicesService.create(file, name, "uploaded");

    // If agentId is provided, link the voice to the agent
    // This will be handled by the agent update endpoint
    // For now, just return the voice with agentId

    return {
      id: voice._id.toString(),
      name: voice.name,
      voiceId: voice.voiceId, // This is the ElevenLabs voice_id
      url: voice.url,
      createdAt: voice.createdAt.toISOString(),
      type: voice.type,
      agentId: agentId || null,
    };
  }
}





