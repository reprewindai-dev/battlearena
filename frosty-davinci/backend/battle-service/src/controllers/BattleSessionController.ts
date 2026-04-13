import { Request, Response } from 'express';
import { BattleSessionService } from '../services/BattleSessionService';
import { asyncHandler } from '../middleware/asyncHandler';

export class BattleSessionController {
  constructor(private battleSessionService: BattleSessionService) {}

  // Create new battle session
  createSession = asyncHandler(async (req: Request, res: Response) => {
    const { creator_id, battle_type, format, entry_fee_tokens } = req.body;
    
    const session = await this.battleSessionService.createSession({
      creator_id,
      battle_type,
      format,
      entry_fee_tokens,
      total_rounds: 2
    });
    
    res.status(201).json(session);
  });

  // Get session by ID
  getSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const session = await this.battleSessionService.getSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  });

  // Join session
  joinSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id } = req.body;
    
    const result = await this.battleSessionService.joinSession(sessionId, user_id);
    
    res.json(result);
  });

  // Leave session
  leaveSession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id } = req.body;
    
    const result = await this.battleSessionService.leaveSession(sessionId, user_id);
    
    res.json(result);
  });

  // Update session state (server-authoritative)
  updateSessionState = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id, updates } = req.body;
    
    // Validate that this user can make this change
    const session = await this.battleSessionService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only creator can update certain fields, others can only send intents
    const canUpdate = await this.battleSessionService.canUserUpdateSession(user_id, session, updates);
    
    if (!canUpdate) {
      return res.status(403).json({ error: 'Unauthorized to update session state' });
    }
    
    const updatedSession = await this.battleSessionService.updateSessionState(sessionId, updates);
    
    // Broadcast to all connected clients via WebSocket
    this.battleSessionService.broadcastSessionUpdate(sessionId, updatedSession);
    
    res.json(updatedSession);
  });

  // Handle client intents
  handleReadyIntent = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id } = req.body;
    
    const result = await this.battleSessionService.handleReadyIntent(sessionId, user_id);
    
    // Broadcast updated session state
    this.battleSessionService.broadcastSessionUpdate(sessionId, result.session);
    
    res.json(result);
  });

  handleVoteIntent = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id, round_number, voted_for } = req.body;
    
    const vote = await this.battleSessionService.handleVoteIntent(sessionId, user_id, round_number, voted_for);
    
    // Broadcast vote to all clients
    this.battleSessionService.broadcastVote(sessionId, vote);
    
    res.json(vote);
  });

  handleChatIntent = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id, body } = req.body;
    
    const message = await this.battleSessionService.handleChatIntent(sessionId, user_id, body);
    
    // Broadcast message to all clients
    this.battleSessionService.broadcastChatMessage(sessionId, message);
    
    res.json(message);
  });

  // Start round (server-authoritative)
  startRound = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id } = req.body;
    
    const session = await this.battleSessionService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only creator can start rounds
    if (session.creator_id !== user_id) {
      return res.status(403).json({ error: 'Only creator can start rounds' });
    }
    
    const updatedSession = await this.battleSessionService.startRound(sessionId);
    
    // Broadcast to all clients
    this.battleSessionService.broadcastSessionUpdate(sessionId, updatedSession);
    
    res.json(updatedSession);
  });

  // End round and collect votes
  endRound = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { user_id } = req.body;
    
    const session = await this.battleSessionService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Only creator can end rounds
    if (session.creator_id !== user_id) {
      return res.status(403).json({ error: 'Only creator can end rounds' });
    }
    
    const result = await this.battleSessionService.endRound(sessionId);
    
    // Broadcast results
    this.battleSessionService.broadcastSessionUpdate(sessionId, result.session);
    
    res.json(result);
  });

  // Get session history
  getSessionHistory = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    const history = await this.battleSessionService.getSessionHistory(sessionId);
    
    res.json(history);
  });
}
