import { Injectable, BadRequestException } from "@nestjs/common";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

@Injectable()
export class UploadService {
  private readonly uploadDir = join(process.cwd(), "uploads", "voices");

  async onModuleInit() {
    // Ensure upload directory exists
    if (!existsSync(this.uploadDir)) {
      await mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadVoiceFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException("File size must be less than 10MB");
    }

    // Validate file type
    if (!file.mimetype.startsWith("audio/")) {
      throw new BadRequestException("Please upload an audio file");
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.originalname.split(".").pop();
    const filename = `voice_${timestamp}.${extension}`;
    const filepath = join(this.uploadDir, filename);

    // Save file
    await writeFile(filepath, file.buffer);

    // Return file info
    const voiceId = `voice_${timestamp}`;
    const url = `/uploads/voices/${filename}`;

    return {
      voiceId,
      url,
    };
  }

  async recordVoice() {
    // In a real implementation, this would handle voice recording
    // For now, return a mock response
    const voiceId = `voice_${Date.now()}`;
    const url = `/uploads/voices/${voiceId}.webm`;

    return {
      blob: null, // In real implementation, this would be the audio blob
      url,
    };
  }
}

