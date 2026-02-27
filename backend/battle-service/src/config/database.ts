import { Pool } from 'pg';

// Mock database for local development without Docker
const mockDatabase = {
  query: async (text: string, params?: any[]) => {
    console.log('Mock DB Query:', text, params);
    
    // Return mock data for development
    if (text.includes('beats')) {
      return {
        rows: [
          {
            id: 'beat-1',
            title: 'Boom Bap Classic',
            artist: 'Producer 1',
            tempo: 95,
            key_signature: 'C Minor',
            genre: 'boom-bap',
            duration_seconds: 180,
            file_url: 'https://example.com/beat1.mp3',
            preview_url: 'https://example.com/beat1-preview.mp3',
            license_type: 'standard',
            uploaded_by: 'user-1',
            is_verified: true,
            is_active: true,
            usage_count: 42,
            created_at: new Date()
          },
          {
            id: 'beat-2',
            title: 'Trap Fire',
            artist: 'Producer 2',
            tempo: 140,
            key_signature: 'F# Minor',
            genre: 'trap',
            duration_seconds: 160,
            file_url: 'https://example.com/beat2.mp3',
            preview_url: 'https://example.com/beat2-preview.mp3',
            license_type: 'premium',
            uploaded_by: 'user-2',
            is_verified: true,
            is_active: true,
            usage_count: 28,
            created_at: new Date()
          }
        ]
      };
    }
    
    if (text.includes('COUNT')) {
      return { rows: [{ total: 2 }] };
    }
    
    return { rows: [] };
  }
};

// Real database connection (when available)
let pool: Pool | null = null;

export const query = async (text: string, params?: any[]) => {
  if (process.env.DATABASE_URL === 'mock' || !process.env.DATABASE_URL) {
    return mockDatabase.query(text, params);
  }
  
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  
  return pool.query(text, params);
};

export const connectDB = async () => {
  if (process.env.DATABASE_URL === 'mock' || !process.env.DATABASE_URL) {
    console.log('🔌 Using mock database (no PostgreSQL connection)');
    return;
  }
  
  try {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
    }
    
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL database');
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error);
    throw error;
  }
};
