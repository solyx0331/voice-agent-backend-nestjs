import { Injectable, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CustomVoice, CustomVoiceDocument } from "../../schemas/custom-voice.schema";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { ElevenLabsService } from "../../services/elevenlabs.service";

@Injectable()
export class VoicesService {
  private readonly logger = new Logger(VoicesService.name);
  private readonly uploadDir = join(process.cwd(), "uploads", "voices");

  constructor(
    @InjectModel(CustomVoice.name)
    private customVoiceModel: Model<CustomVoiceDocument>,
    private elevenLabsService: ElevenLabsService
  ) {}

  async findAll(): Promise<CustomVoiceDocument[]> {
    return this.customVoiceModel.find().sort({ createdAt: -1 });
  }

  async findOne(id: string): Promise<CustomVoiceDocument> {
    const voice = await this.customVoiceModel.findById(id);
    if (!voice) {
      throw new NotFoundException(`Custom voice with ID ${id} not found`);
    }
    return voice;
  }

  async create(
    file: Express.Multer.File,
    name?: string,
    type: "uploaded" | "recorded" = "uploaded"
  ): Promise<CustomVoiceDocument> {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException("File size must be less than 10MB");
    }

    // Validate file type - accept audio files or webm (for recordings)
    if (!file.mimetype.startsWith("audio/") && file.mimetype !== "video/webm" && file.mimetype !== "audio/webm") {
      throw new BadRequestException("Please upload an audio file");
    }

    // Ensure upload directory exists
    if (!existsSync(this.uploadDir)) {
      const { mkdir } = await import("fs/promises");
      await mkdir(this.uploadDir, { recursive: true });
    }

    // Generate timestamp for voice ID and naming
    const timestamp = Date.now();
    
    // When using diskStorage, multer already saves the file
    // Use the path provided by multer, or save from buffer if available
    let filename: string;
    let filepath: string;
    
    if (file.path) {
      // File already saved by multer's diskStorage
      filepath = file.path;
      filename = file.filename || file.originalname;
    } else if (file.buffer) {
      // File in memory, need to save it
      // Handle webm files (recordings) - ensure .webm extension
      let extension = file.originalname.split(".").pop() || "mp3";
      if (file.mimetype === "video/webm" || file.mimetype === "audio/webm") {
        extension = "webm";
      }
      filename = `voice_${timestamp}.${extension}`;
      filepath = join(this.uploadDir, filename);
      await writeFile(filepath, file.buffer);
    } else {
      throw new BadRequestException("File data not available");
    }
    
    // Extract just the filename for URL
    const urlFilename = filename.split(/[/\\]/).pop() || filename;

    // Generate voice name
    const voiceName = name || file.originalname.replace(/\.[^/.]+$/, "") || `Custom Voice ${timestamp}`;

    // Upload to ElevenLabs Voice Lab API to create custom voice clone
    let elevenLabsVoiceId: string | null = null;
    try {
      this.logger.log(`Creating custom voice in ElevenLabs: ${voiceName}`);
      
      // Upload to ElevenLabs to get a real voice_id
      elevenLabsVoiceId = await this.elevenLabsService.createCustomVoice(
        filepath,
        voiceName
      );
      
      this.logger.log(`Voice created in ElevenLabs successfully. Voice ID: ${elevenLabsVoiceId}`);
    } catch (error: any) {
      this.logger.error(`Failed to create voice in ElevenLabs: ${error.message}`, error.stack);
      // Continue with local voice ID if ElevenLabs upload fails
      // This allows the system to work even if ElevenLabs upload fails
      elevenLabsVoiceId = `custom_voice_${timestamp}`;
      this.logger.warn(`Using local voice ID: ${elevenLabsVoiceId}. Voice will not work until uploaded to ElevenLabs.`);
    }

    // Create custom voice record
    const customVoice = new this.customVoiceModel({
      name: voiceName,
      voiceId: elevenLabsVoiceId, // This is the ElevenLabs voice_id after upload
      url: `/uploads/voices/${urlFilename}`,
      type: type,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });

    const saved = await customVoice.save();

    this.logger.log(`Custom voice created: ${saved._id} (${voiceName}) with ElevenLabs voiceId: ${elevenLabsVoiceId}`);

    return saved;
  }

  async remove(id: string): Promise<void> {
    const voice = await this.findOne(id);

    // Delete from ElevenLabs if it's a real ElevenLabs voice_id
    if (voice.voiceId && !voice.voiceId.startsWith("custom_voice_")) {
      try {
        await this.elevenLabsService.deleteVoice(voice.voiceId);
        this.logger.log(`Deleted voice from ElevenLabs: ${voice.voiceId}`);
      } catch (error: any) {
        this.logger.warn(`Failed to delete voice from ElevenLabs: ${error.message}`);
      }
    }

    // Delete the file from disk
    const filepath = join(this.uploadDir, voice.fileName || voice.url.split("/").pop() || "");
    if (existsSync(filepath)) {
      try {
        await unlink(filepath);
        this.logger.log(`Deleted voice file: ${filepath}`);
      } catch (error) {
        this.logger.warn(`Failed to delete voice file: ${filepath}`, error);
      }
    }

    // Delete from database
    await this.customVoiceModel.findByIdAndDelete(id);
    this.logger.log(`Custom voice deleted: ${id}`);
  }
}

