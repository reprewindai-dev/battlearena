import { BeatService } from './BeatService';

// Re-export for frontend usage
export { BeatService };

// Create singleton instance
const beatService = new BeatService();
export default beatService;
