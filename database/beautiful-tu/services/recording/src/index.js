const { RoomServiceClient, Room, EgressClient } = require('livekit-server-sdk');
const { createClient } = require('@supabase/supabase-js');
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

// Configuration
const LIVEKIT_HOST = process.env.LIVEKIT_HOST || 'localhost';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'devsecret';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Initialize clients
const roomClient = new RoomServiceClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
const egressClient = new EgressClient(LIVEKIT_HOST, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class RecordingService {
  async startRecording(roomName, battleId) {
    try {
      logger.info(`Starting recording for room: ${roomName}, battle: ${battleId}`);

      // Start room composite egress
      const egress = await egressClient.startRoomCompositeEgress({
        roomName,
        layout: 'grid',
        outputPath: `s3://battlearena-recordings/battles/${battleId}/`,
        fileOutput: {
          fileType: 'mp4',
          s3: {
            accessKey: process.env.AWS_ACCESS_KEY_ID,
            secret: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
            bucket: 'battlearena-recordings'
          }
        }
      });

      // Update database with recording info
      await supabase
        .from('battles')
        .update({
          recording_url: `https://battlearena-recordings.s3.amazonaws.com/battles/${battleId}/recording.mp4`,
          recording_status: 'recording',
          egress_id: egress.egressId
        })
        .eq('id', battleId);

      logger.info(`Recording started successfully: ${egress.egressId}`);
      return egress;
    } catch (error) {
      logger.error(`Failed to start recording: ${error.message}`);
      throw error;
    }
  }

  async stopRecording(egressId, battleId) {
    try {
      logger.info(`Stopping recording: ${egressId}`);

      await egressClient.stopEgress(egressId);

      // Update database
      await supabase
        .from('battles')
        .update({
          recording_status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', battleId);

      logger.info(`Recording stopped successfully`);
    } catch (error) {
      logger.error(`Failed to stop recording: ${error.message}`);
      throw error;
    }
  }

  async processRecording(battleId) {
    try {
      logger.info(`Processing recording for battle: ${battleId}`);

      // Get battle info
      const { data: battle } = await supabase
        .from('battles')
        .select('*')
        .eq('id', battleId)
        .single();

      if (!battle) {
        throw new Error('Battle not found');
      }

      // Create split-screen version
      const outputPath = `/tmp/battle-${battleId}-processed.mp4`;
      
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(battle.recording_url)
          .output(outputPath)
          .videoFilters('[0:v]scale=640:360[left];[0:v]scale=640:360[right];[left][right]hstack')
          .audioFilters('volume=0.8')
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      // Upload processed version
      const s3 = new AWS.S3();
      await s3.upload({
        Bucket: 'battlearena-recordings',
        Key: `battles/${battleId}/processed.mp4`,
        Body: require('fs').createReadStream(outputPath)
      }).promise();

      // Update database
      await supabase
        .from('battles')
        .update({
          processed_url: `https://battlearena-recordings.s3.amazonaws.com/battles/${battleId}/processed.mp4`,
          processing_status: 'completed'
        })
        .eq('id', battleId);

      logger.info(`Recording processed successfully`);
    } catch (error) {
      logger.error(`Failed to process recording: ${error.message}`);
      throw error;
    }
  }
}

// Initialize service
const recordingService = new RecordingService();

// Start HTTP server for webhook callbacks
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook/egress', async (req, res) => {
  const { egressId, status, error } = req.body;
  
  try {
    if (status === 'EGRESS_COMPLETE') {
      // Find battle by egress ID and update
      const { data: battle } = await supabase
        .from('battles')
        .select('id')
        .eq('egress_id', egressId)
        .single();

      if (battle) {
        await recordingService.processRecording(battle.id);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Webhook error: ${error.message}`);
    res.status(500).send('Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Recording service running on port ${PORT}`);
});

module.exports = { RecordingService };
