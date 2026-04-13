const { Storage } = require('@google-cloud/storage');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

class BeatService {
  constructor() {
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    this.bucketName = 'arena-beats';
    this.bucket = this.storage.bucket(this.bucketName);
    
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async uploadBeat(beatData, audioFile, previewFile) {
    try {
      const {
        title,
        artist,
        tempo,
        keySignature,
        genre,
        duration,
        licenseType = 'commercial',
        tags = []
      } = beatData;

      // Validate beat data
      this.validateBeatData({ title, artist, tempo, keySignature, genre, duration });

      // Upload full audio file
      const audioFileName = `beats/${Date.now()}-${path.parse(audioFile.originalname).name}.mp3`;
      const audioUrl = await this.uploadFile(audioFile, audioFileName);

      // Upload preview file
      const previewFileName = `previews/${Date.now()}-preview-${path.parse(previewFile.originalname).name}.mp3`;
      const previewUrl = await this.uploadFile(previewFile, previewFileName);

      // Insert beat into database
      const { data: beat, error } = await this.supabase
        .from('beats')
        .insert({
          title,
          artist,
          tempo: parseInt(tempo),
          key_signature: keySignature,
          genre,
          duration_seconds: parseInt(duration),
          preview_url: previewUrl,
          file_url: audioUrl,
          license_type: licenseType,
          source: 'user_upload',
          status: 'pending',
          is_active: false,
          is_verified: false,
          tags
        })
        .select()
        .single();

      if (error) {
        // Clean up uploaded files if database insert fails
        await this.deleteFile(audioFileName);
        await this.deleteFile(previewFileName);
        throw new Error(`Failed to save beat: ${error.message}`);
      }

      // Create license record
      await this.supabase
        .from('beat_licenses')
        .insert({
          beat_id: beat.id,
          license_type: licenseType,
          commercial_use: true,
          attribution_required: false,
          redistribution_allowed: false,
          modification_allowed: true,
          price_cents: 199
        });

      logger.info(`Beat uploaded successfully: ${beat.id} - ${title}`);
      
      return {
        success: true,
        beat: {
          id: beat.id,
          title: beat.title,
          artist: beat.artist,
          tempo: beat.tempo,
          genre: beat.genre,
          status: beat.status,
          preview_url: beat.preview_url,
          file_url: beat.file_url
        }
      };

    } catch (error) {
      logger.error('Failed to upload beat:', error);
      throw error;
    }
  }

  async uploadFile(file, fileName) {
    try {
      const fileBuffer = await fs.readFile(file.path);
      
      const blob = this.bucket.file(fileName);
      const stream = blob.createWriteStream({
        metadata: {
          contentType: 'audio/mpeg',
          cacheControl: 'public, max-age=31536000'
        }
      });

      await new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', resolve);
        stream.end(fileBuffer);
      });

      // Make file public
      await blob.makePublic();
      
      // Return public URL
      return `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
      
    } catch (error) {
      logger.error(`Failed to upload file ${fileName}:`, error);
      throw error;
    }
  }

  async deleteFile(fileName) {
    try {
      await this.bucket.file(fileName).delete();
      logger.info(`Deleted file: ${fileName}`);
    } catch (error) {
      logger.error(`Failed to delete file ${fileName}:`, error);
    }
  }

  validateBeatData(data) {
    const errors = [];

    if (!data.title || data.title.trim().length < 2) {
      errors.push('Title must be at least 2 characters');
    }

    if (!data.artist || data.artist.trim().length < 2) {
      errors.push('Artist name must be at least 2 characters');
    }

    if (!data.tempo || data.tempo < 60 || data.tempo > 200) {
      errors.push('Tempo must be between 60 and 200 BPM');
    }

    if (!data.keySignature || !this.isValidKeySignature(data.keySignature)) {
      errors.push('Invalid key signature');
    }

    if (!data.genre || !this.isValidGenre(data.genre)) {
      errors.push('Invalid genre');
    }

    if (!data.duration || data.duration < 10 || data.duration > 600) {
      errors.push('Duration must be between 10 and 600 seconds');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  isValidKeySignature(key) {
    const validKeys = [
      'C Major', 'C Minor', 'C# Major', 'C# Minor', 'D Major', 'D Minor',
      'D# Major', 'D# Minor', 'E Major', 'E Minor', 'F Major', 'F Minor',
      'F# Major', 'F# Minor', 'G Major', 'G Minor', 'G# Major', 'G# Minor',
      'A Major', 'A Minor', 'A# Major', 'A# Minor', 'B Major', 'B Minor'
    ];
    return validKeys.includes(key);
  }

  isValidGenre(genre) {
    const validGenres = [
      'hip-hop', 'rap', 'trap', 'boom-bap', 'lo-fi', 'jazz-hop',
      'electronic', 'techno', 'house', 'dubstep', 'drum-and-bass',
      'pop', 'rock', 'indie', 'alternative', 'experimental',
      'r&b', 'soul', 'funk', 'disco', 'reggae'
    ];
    return validGenres.includes(genre.toLowerCase());
  }

  async getBeats(filters = {}) {
    try {
      let query = this.supabase
        .from('beats')
        .select(`
          id, title, artist, tempo, key_signature, genre, 
          duration_seconds, preview_url, usage_count, rating,
          status, is_active, is_verified, tags, created_at
        `)
        .eq('is_active', true)
        .eq('status', 'active');

      // Apply filters
      if (filters.genre && filters.genre !== 'all') {
        query = query.eq('genre', filters.genre);
      }

      if (filters.tempoMin) {
        query = query.gte('tempo', filters.tempoMin);
      }

      if (filters.tempoMax) {
        query = query.lte('tempo', filters.tempoMax);
      }

      if (filters.minRating) {
        query = query.gte('rating', filters.minRating);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }

      // Sorting
      const sortBy = filters.sortBy || 'usage_count';
      const sortOrder = filters.sortOrder || 'desc';
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Limit
      const limit = Math.min(filters.limit || 50, 100);
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch beats: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get beats:', error);
      throw error;
    }
  }

  async getBeatById(beatId) {
    try {
      const { data, error } = await this.supabase
        .from('beats')
        .select(`
          id, title, artist, tempo, key_signature, genre,
          duration_seconds, preview_url, file_url, usage_count,
          rating, status, is_active, is_verified, tags,
          created_at, updated_at,
          beat_licenses (
            license_type, commercial_use, attribution_required,
            redistribution_allowed, modification_allowed, price_cents
          )
        `)
        .eq('id', beatId)
        .single();

      if (error) {
        throw new Error(`Failed to get beat: ${error.message}`);
      }

      return data;

    } catch (error) {
      logger.error(`Failed to get beat ${beatId}:`, error);
      throw error;
    }
  }

  async trackBeatUsage(beatId, userId, usageType, battleId = null) {
    try {
      // Record usage
      await this.supabase
        .from('beat_usage')
        .insert({
          beat_id: beatId,
          user_id: userId,
          battle_id: battleId,
          usage_type: usageType
        });

      // Increment usage count
      await this.supabase
        .from('beats')
        .update({ usage_count: this.supabase.raw('usage_count + 1') })
        .eq('id', beatId);

      logger.info(`Beat usage tracked: ${beatId} by ${userId} (${usageType})`);

    } catch (error) {
      logger.error('Failed to track beat usage:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  async updateBeatRating(beatId, newRating) {
    try {
      const { data: currentBeat } = await this.supabase
        .from('beats')
        .select('rating, usage_count')
        .eq('id', beatId)
        .single();

      if (!currentBeat) {
        throw new Error('Beat not found');
      }

      // Calculate new average rating (simplified - in production you'd store individual ratings)
      const updatedRating = ((currentBeat.rating * currentBeat.usage_count) + newRating) / (currentBeat.usage_count + 1);

      await this.supabase
        .from('beats')
        .update({ rating: updatedRating })
        .eq('id', beatId);

      logger.info(`Beat rating updated: ${beatId} to ${updatedRating}`);

    } catch (error) {
      logger.error('Failed to update beat rating:', error);
      throw error;
    }
  }

  async getBeatStats() {
    try {
      const { data } = await this.supabase
        .from('beats')
        .select('genre, usage_count, rating, status')
        .eq('is_active', true);

      const stats = {
        totalBeats: data?.length || 0,
        activeBeats: data?.filter(b => b.status === 'active').length || 0,
        averageRating: data?.reduce((sum, b) => sum + (b.rating || 0), 0) / (data?.length || 1),
        totalUsage: data?.reduce((sum, b) => sum + (b.usage_count || 0), 0) || 0,
        genreBreakdown: {}
      };

      // Genre breakdown
      data?.forEach(beat => {
        stats.genreBreakdown[beat.genre] = (stats.genreBreakdown[beat.genre] || 0) + 1;
      });

      return stats;

    } catch (error) {
      logger.error('Failed to get beat stats:', error);
      throw error;
    }
  }
}

module.exports = BeatService;
