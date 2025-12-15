import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = join(process.cwd(), "uploads", "audio");
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Get base URL from environment or use default
    this.baseUrl =
      process.env.WEBHOOK_BASE_URL ||
      this.configService.get<string>("WEBHOOK_BASE_URL") ||
      "http://localhost:8000";

    // Ensure upload directory exists
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    if (!existsSync(this.uploadDir)) {
      const { mkdir } = await import("fs/promises");
      await mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Upload audio file to public storage and return public URL
   * For now, we'll use local file storage with public serving
   * In production, you'd upload to S3 or similar
   * @param audioBuffer Audio file buffer
   * @param filename Optional filename
   * @returns Public URL to the audio file
   */
  async uploadAudio(audioBuffer: Buffer, filename?: string): Promise<string> {
    await this.ensureUploadDir();

    // Generate unique filename
    const timestamp = Date.now();
    const finalFilename = filename || `audio_${timestamp}.mp3`;
    const filepath = join(this.uploadDir, finalFilename);

    // Save file
    await writeFile(filepath, audioBuffer);

    // Return public URL
    // In production, this would be an S3 URL or CDN URL
    const publicUrl = `${this.baseUrl}/uploads/audio/${finalFilename}`;
    
    this.logger.log(`Audio uploaded: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Delete audio file from storage
   * @param url Public URL of the audio file
   */
  async deleteAudio(url: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = url.split("/").pop();
      if (filename) {
        const filepath = join(this.uploadDir, filename);
        if (existsSync(filepath)) {
          const { unlink } = await import("fs/promises");
          await unlink(filepath);
          this.logger.log(`Deleted audio file: ${filename}`);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to delete audio file: ${error.message}`);
    }
  }
}




