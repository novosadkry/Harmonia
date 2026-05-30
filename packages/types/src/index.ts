export type PlaybackStatus = 'playing' | 'paused' | 'stopped' | 'loading';
export type LoopMode = 'none' | 'track' | 'queue';

export interface PlaybackState {
  status: PlaybackStatus;
  trackId: string | null;
  currentTrack: TrackInQueue | null;
  startedAt: number | null;
  pausedAt: number | null;
  volume: number;
  loop: LoopMode;
  shuffle: boolean;
}

export interface TrackInQueue {
  trackId: string;
  youtubeVideoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  queuedBy: string;
}

export type BotCommand =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SKIP' }
  | { type: 'STOP' }
  | { type: 'SEEK'; positionSeconds: number }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_LOOP'; mode: LoopMode }
  | { type: 'TOGGLE_SHUFFLE' }
  | { type: 'JOIN_CHANNEL'; userId: string }
  | { type: 'LEAVE_CHANNEL' };

export type BotEvent =
  | { type: 'TRACK_STARTED'; track: TrackInQueue }
  | { type: 'TRACK_ENDED'; trackId: string }
  | { type: 'TRACK_ERROR'; trackId: string; error: string }
  | { type: 'QUEUE_UPDATED'; queue: TrackInQueue[] }
  | { type: 'PLAYBACK_STATE_CHANGED'; state: PlaybackState }
  | { type: 'DJ_CHANGED'; userId: string | null }
  | { type: 'BOT_JOINED'; channelId: string }
  | { type: 'BOT_LEFT' }
  | { type: 'BOT_ERROR'; error: string };
