import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "fs/promises";
import { FormData } from "undici";

@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger(ElevenLabsService.name);
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.elevenlabs.io/v1";

  constructor(private configService: ConfigService) {
    this.apiKey =
      process.env.ELEVENLABS_API_KEY ||
      this.configService.get<string>("ELEVENLABS_API_KEY") ||
      "";

    if (!this.apiKey) {
      this.logger.warn(
        "ELEVENLABS_API_KEY not found. ElevenLabs integration will not work."
      );
    }
  }

  /**
   * Create a custom voice clone using ElevenLabs Voice Lab API
   * @param audioFilePath Path to the audio file (MP3 or WAV)
   * @param voiceName Name for the custom voice
   * @param description Optional description for the voice
   * @returns ElevenLabs voice_id
   */
  async createCustomVoice(
    audioFilePath: string,
    voiceName: string,
    description?: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new HttpException(
        "ELEVENLABS_API_KEY is not configured. Please set ELEVENLABS_API_KEY environment variable.",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      this.logger.log(`Creating custom voice in ElevenLabs: ${voiceName}`);

      // Read the audio file
      const audioBuffer = await readFile(audioFilePath);

      // Create FormData for multipart upload using undici (native FormData support)
      // According to ElevenLabs API: POST /v1/voices/add
      // Required fields: name, files (array of audio files)
      // Optional: description
      const formData = new FormData();
      formData.append("name", voiceName);
      if (description) {
        formData.append("description", description);
      }
      
      // Determine content type from file extension
      const fileName = audioFilePath.split(/[/\\]/).pop() || "voice.mp3";
      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'mp3';
      const contentType = fileExt === 'wav' ? 'audio/wav' : 'audio/mpeg';
      
      // ElevenLabs expects "files" field (can accept multiple files)
      // undici FormData requires Blob, not Buffer - convert Buffer to Blob
      const audioBlob = new Blob([audioBuffer], { type: contentType });
      
      // Append Blob with filename (third parameter is the filename)
      formData.append("files", audioBlob, fileName);

      this.logger.log(`📤 Sending voice clone request to ElevenLabs`);
      this.logger.log(`   URL: ${this.baseUrl}/voices/add`);
      this.logger.log(`   Voice name: ${voiceName}`);
      this.logger.log(`   File: ${fileName} (${audioBuffer.length} bytes, ${contentType})`);

      // Call ElevenLabs Voice Lab API using undici fetch (has proper FormData support)
      const { fetch: undiciFetch } = await import("undici");
      
      const response = await undiciFetch(`${this.baseUrl}/voices/add`, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          // Don't set Content-Type - undici will set it automatically with boundary
        },
        body: formData,
      });

      this.logger.log(`📥 ElevenLabs API response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to create voice in ElevenLabs: ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.detail) {
            if (typeof errorJson.detail === 'object' && errorJson.detail.status === 'missing_permissions') {
              errorMessage = `ElevenLabs API key is missing required permissions.\n\n` +
                `Error: ${errorJson.detail.message || 'Missing voices_write permission'}\n\n` +
                `To fix this:\n` +
                `1. Go to your ElevenLabs dashboard: https://elevenlabs.io/\n` +
                `2. Navigate to your API keys settings\n` +
                `3. Ensure your API key has the "voices_write" permission enabled\n` +
                `4. Voice cloning requires a subscription plan that supports custom voices\n\n` +
                `For more information, visit: https://elevenlabs.io/docs/api-reference/add-voice`;
            } else if (typeof errorJson.detail === 'string') {
              errorMessage = `ElevenLabs API error: ${errorJson.detail}`;
            } else {
              errorMessage = `ElevenLabs API error: ${JSON.stringify(errorJson.detail)}`;
            }
          } else {
            errorMessage = `ElevenLabs API error: ${errorText}`;
          }
        } catch (e) {
          // If errorText is not JSON, use it as-is
          errorMessage = `ElevenLabs API error: ${errorText}`;
        }
        
        this.logger.error(
          `❌ ElevenLabs voice creation failed: ${response.status} ${response.statusText}`
        );
        this.logger.error(`   Error details: ${errorText}`);
        throw new HttpException(
          errorMessage,
          response.status
        );
      }

      const result: any = await response.json();
      this.logger.log(`✅ ElevenLabs API response: ${JSON.stringify(result, null, 2)}`);

      // ElevenLabs API returns voice_id in the response
      // Check multiple possible response formats
      const voiceId = result.voice_id || result.voiceId || result.id;

      if (!voiceId) {
        this.logger.error(
          `❌ ElevenLabs voice creation response missing voice_id`
        );
        this.logger.error(`   Full response: ${JSON.stringify(result, null, 2)}`);
        throw new HttpException(
          `ElevenLabs voice creation succeeded but no voice_id returned. Response: ${JSON.stringify(result)}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      this.logger.log(`✅ Custom voice created in ElevenLabs successfully!`);
      this.logger.log(`   Voice ID: ${voiceId}`);
      this.logger.log(`   Voice Name: ${voiceName}`);
      return voiceId;
    } catch (error: any) {
      this.logger.error(
        `Error creating voice in ElevenLabs: ${error.message}`,
        error.stack
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to create voice in ElevenLabs: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Generate speech from text using ElevenLabs TTS API
   * @param text Text to convert to speech
   * @param voiceId ElevenLabs voice ID to use
   * @param options Optional TTS parameters (stability, similarity_boost, style, etc.)
   * @returns Audio buffer (MP3 format)
   */
  async textToSpeech(
    text: string,
    voiceId: string,
    options?: {
      stability?: number;
      similarity_boost?: number;
      style?: number;
      use_speaker_boost?: boolean;
    }
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new HttpException(
        "ELEVENLABS_API_KEY is not configured. Please set ELEVENLABS_API_KEY environment variable.",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      this.logger.log(`Generating TTS for voice ${voiceId}: ${text.substring(0, 50)}...`);

      // Call ElevenLabs TTS API
      // POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
      const url = `${this.baseUrl}/text-to-speech/${voiceId}`;
      
      const requestBody: any = {
        text: text,
        model_id: "eleven_multilingual_v2", // Use multilingual model
      };

      // Add optional parameters
      if (options) {
        if (options.stability !== undefined) {
          requestBody.stability = Math.max(0, Math.min(1, options.stability));
        }
        if (options.similarity_boost !== undefined) {
          requestBody.similarity_boost = Math.max(0, Math.min(1, options.similarity_boost));
        }
        if (options.style !== undefined) {
          requestBody.style = Math.max(0, Math.min(1, options.style));
        }
        if (options.use_speaker_boost !== undefined) {
          requestBody.use_speaker_boost = options.use_speaker_boost;
        }
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `ElevenLabs TTS failed: ${response.status} ${errorText}`
        );
        throw new HttpException(
          `Failed to generate TTS: ${response.statusText}`,
          response.status
        );
      }

      // Get audio as ArrayBuffer and convert to Buffer
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      this.logger.log(`TTS generated successfully. Audio size: ${audioBuffer.length} bytes`);
      return audioBuffer;
    } catch (error: any) {
      this.logger.error(
        `Error generating TTS: ${error.message}`,
        error.stack
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to generate TTS: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete a custom voice from ElevenLabs
   * @param voiceId ElevenLabs voice ID to delete
   */
  async deleteVoice(voiceId: string): Promise<void> {
    if (!this.apiKey) {
      throw new HttpException(
        "ELEVENLABS_API_KEY is not configured.",
        HttpStatus.UNAUTHORIZED
      );
    }

    try {
      this.logger.log(`Deleting voice from ElevenLabs: ${voiceId}`);

      const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        method: "DELETE",
        headers: {
          "xi-api-key": this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `ElevenLabs voice deletion failed: ${response.status} ${errorText}`
        );
        throw new HttpException(
          `Failed to delete voice from ElevenLabs: ${response.statusText}`,
          response.status
        );
      }

      this.logger.log(`Voice deleted from ElevenLabs: ${voiceId}`);
    } catch (error: any) {
      this.logger.error(
        `Error deleting voice from ElevenLabs: ${error.message}`,
        error.stack
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to delete voice: ${error.message || "Unknown error"}`,
        error.status || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

