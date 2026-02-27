import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get('room');
  const participant = searchParams.get('participant');

  if (!room || !participant) {
    return NextResponse.json(
      { error: 'room and participant are required' },
      { status: 400 }
    );
  }

  try {
    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'devsecret';
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participant,
      name: participant,
    });

    at.addGrant({
      room: room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = at.toJwt();
    
    return NextResponse.json({ 
      token,
      url: livekitUrl,
      room,
      participant
    });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
