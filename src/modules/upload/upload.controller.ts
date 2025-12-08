import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UploadService } from "./upload.service";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";

// Ensure upload directory exists
const uploadDir = join(process.cwd(), "uploads", "voices");
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post("voice")
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
        if (file.mimetype.startsWith("audio/")) {
          cb(null, true);
        } else {
          cb(new BadRequestException("Please upload an audio file"), false);
        }
      },
    })
  )
  async uploadVoiceFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }
    return this.uploadService.uploadVoiceFile(file);
  }

  @Post("voice/record")
  async recordVoice() {
    return this.uploadService.recordVoice();
  }
}

