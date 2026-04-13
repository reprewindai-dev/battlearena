import { query } from '../config/database';
import { setCache, getCache } from '../config/redis';
import { createError } from '../middleware/errorHandler';
import { S3 } from 'aws-sdk';
import ffmpeg from 'fluent-ffmpeg';
import musicMetadata from 'music-metadata';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface BeatUploadData {
  title: string;
  artist: string;
  tempo: number;
  key_signature: string;
  genre: string;
  license_type: string;
  uploaded_by: string;
  audioBuffer: Buffer;
  originalName: string;
  mimeType: string;
}

export interface Beat {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  key_signature: string;
  genre: string;
  duration_seconds: number;
  file_url: string;
  preview_url: string;
  license_type: string;
  uploaded_by: string;
  is_verified: boolean;
  is_active: boolean;
  usage_count: number;
  created_at: Date;
}

export class ContentService {
  private s3: S3;
  private bucketName: string;

  constructor() {
    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.bucketName = process.env.AWS_S3_BUCKET || 'arena-beats';
  }

  async uploadBeat(data: BeatUploadData): Promise<Beat> {
    try {
      // Extract metadata from audio file
      const metadata = await musicMetadata.parseBuffer(data.audioBuffer, data.mimeType);
      const duration = Math.round(metadata.format.duration || 0);

      // Generate unique filenames
      const beatId = uuidv4();
      const fileKey = `beats/${beatId}/original.${this.getFileExtension(data.originalName)}`;
      const previewKey = `beats/${beatId}/preview.mp3`;

      // Upload original file to S3
      await this.uploadToS3(fileKey, data.audioBuffer, data.mimeType);

      // Generate and upload preview (30 seconds)
      const previewBuffer = await this.generatePreview(data.audioBuffer, data.mimeType);
      await this.uploadToS3(previewKey, previewBuffer, 'audio/mpeg');

      // Save to database
      const result = await query(
        `INSERT INTO beats (
           id, title, artist, tempo, key_signature, genre, 
           duration_seconds, file_url, preview_url, license_type,
           uploaded_by, is_verified, is_active, usage_count
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          beatId,
          data.title,
          data.artist,
          data.tempo,
          data.key_signature,
          data.genre,
          duration,
          `https://${this.bucketName}.s3.amazonaws.com/${fileKey}`,
          `https://${this.bucketName}.s3.amazonaws.com/${previewKey}`,
          data.license_type,
          data.uploaded_by,
          false, // is_verified
          true,  // is_active
          0      // usage_count
        ]
      );

      const beat = result.rows[0];
      
      // Cache the beat
      await setCache(`beat:${beatId}`, beat, 3600);
      
      logger.info('Beat uploaded successfully', { beatId, title: data.title });
      
      return beat;
    } catch (error) {
      logger.error('Error uploading beat:', error);
      throw createError('Failed to upload beat', 500);
    }
  }

  async getBeatStream(beatId: string): Promise<Buffer> {
    try {
      // Check cache first
      const cached = await getCache(`beat_stream:${beatId}`);
      if (cached) {
        return Buffer.from(cached);
      }

      // Get beat from database
      const beatResult = await query(
        'SELECT file_url FROM beats WHERE id = $1 AND is_active = true',
        [beatId]
      );

      if (beatResult.rows.length === 0) {
        throw createError('Beat not found', 404);
      }

      const fileUrl = beatResult.rows[0].file_url;
      const fileKey = fileUrl.split('/').slice(-2).join('/');

      // Get file from S3
      const s3Object = await this.s3.getObject({
        Bucket: this.bucketName,
        Key: fileKey
      }).promise();

      const buffer = s3Object.Body as Buffer;
      
      // Cache for 1 hour
      await setCache(`beat_stream:${beatId}`, buffer.toString('base64'), 3600);
      
      return buffer;
    } catch (error) {
      logger.error('Error getting beat stream:', error);
      throw error;
    }
  }

  async getBeatPreview(beatId: string): Promise<Buffer> {
    try {
      // Check cache first
      const cached = await getCache(`beat_preview:${beatId}`);
      if (cached) {
        return Buffer.from(cached);
      }

      // Get beat from database
      const beatResult = await query(
        'SELECT preview_url FROM beats WHERE id = $1 AND is_active = true',
        [beatId]
      );

      if (beatResult.rows.length === 0) {
        throw createError('Beat not found', 404);
      }

      const previewUrl = beatResult.rows[0].preview_url;
      const previewKey = previewUrl.split('/').slice(-2).join('/');

      // Get preview from S3
      const s3Object = await this.s3.getObject({
        Bucket: this.bucketName,
        Key: previewKey
      }).promise();

      const buffer = s3Object.Body as Buffer;
      
      // Cache for 1 hour
      await setCache(`beat_preview:${beatId}`, buffer.toString('base64'), 3600);
      
      return buffer;
    } catch (error) {
      logger.error('Error getting beat preview:', error);
      throw error;
    }
  }

  async browseBeats(options: {
    genre?: string;
    tempo_min?: number;
    tempo_max?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ beats: Beat[]; total: number }> {
    try {
      const { genre, tempo_min, tempo_max, limit = 20, offset = 0 } = options;
      
      let whereClause = 'WHERE is_active = true AND is_verified = true';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (genre) {
        whereClause += ` AND genre = $${paramIndex++}`;
        queryParams.push(genre);
      }

      if (tempo_min) {
        whereClause += ` AND tempo >= $${paramIndex++}`;
        queryParams.push(tempo_min);
      }

      if (tempo_max) {
        whereClause += ` AND tempo <= $${paramIndex++}`;
        queryParams.push(tempo_max);
      }

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM beats ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].total);

      // Get beats with pagination
      const beatsResult = await query(
        `SELECT * FROM beats ${whereClause}
         ORDER BY usage_count DESC, created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, limit, offset]
      );

      const beats = beatsResult.rows.map(row => ({
        ...row,
        duration_seconds: parseInt(row.duration_seconds),
        usage_count: parseInt(row.usage_count)
      }));

      return { beats, total };
    } catch (error) {
      logger.error('Error browsing beats:', error);
      throw createError('Failed to browse beats', 500);
    }
  }

  async getBeatById(beatId: string): Promise<Beat> {
    try {
      // Check cache first
      const cached = await getCache(`beat:${beatId}`);
      if (cached) {
        return cached;
      }

      const result = await query(
        'SELECT * FROM beats WHERE id = $1 AND is_active = true',
        [beatId]
      );

      if (result.rows.length === 0) {
        throw createError('Beat not found', 404);
      }

      const beat = {
        ...result.rows[0],
        duration_seconds: parseInt(result.rows[0].duration_seconds),
        usage_count: parseInt(result.rows[0].usage_count)
      };

      // Cache for 1 hour
      await setCache(`beat:${beatId}`, beat, 3600);
      
      return beat;
    } catch (error) {
      logger.error('Error getting beat by ID:', error);
      throw error;
    }
  }

  async incrementUsage(beatId: string): Promise<void> {
    try {
      await query(
        'UPDATE beats SET usage_count = usage_count + 1 WHERE id = $1',
        [beatId]
      );

      // Invalidate cache
      await this.deleteCache(`beat:${beatId}`);
    } catch (error) {
      logger.error('Error incrementing beat usage:', error);
    }
  }

  private async uploadToS3(key: string, buffer: Buffer, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s3.upload({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read'
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async generatePreview(audioBuffer: Buffer, mimeType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const tempInput = `/tmp/${Date.now()}-input`;
      const tempOutput = `/tmp/${Date.now()}-preview.mp3`;

      // Write input buffer to temp file
      require('fs').writeFileSync(tempInput, audioBuffer);

      ffmpeg(tempInput)
        .duration(30) // 30 second preview
        .audioCodec('mp3')
        .audioBitrate('128k')
        .audioFrequency(44100)
        .audioChannels(2)
        .on('end', () => {
          const previewBuffer = require('fs').readFileSync(tempOutput);
          
          // Clean up temp files
          require('fs').unlinkSync(tempInput);
          require('fs').unlinkSync(tempOutput);
          
          resolve(previewBuffer);
        })
        .on('error', (err) => {
          // Clean up temp files on error
          try {
            require('fs').unlinkSync(tempInput);
            require('fs').unlinkSync(tempOutput);
          } catch (e) {}
          
          reject(err);
        })
        .save(tempOutput);
    });
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() || 'mp3';
  }

  private async deleteCache(key: string): Promise<void> {
    try {
      const { deleteCache } = await import('../config/redis');
      await deleteCache(key);
    } catch (error) {
      logger.error('Error deleting cache:', error);
    }
  }
}
