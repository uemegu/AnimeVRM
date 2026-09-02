export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'surprised'
  | 'relaxed';

export type AvatarMotion =
  | 'idle'
  | 'standing'
  | 'greeting'
  | 'bow'
  | 'acknowledge'
  | 'dismiss'
  | 'salute'
  | 'excited'
  | 'angry';

export interface AvatarReply {
  speech: string;
  expression: AvatarExpression;
  motion: AvatarMotion;
}

export type LlmProvider = 'gemini-nano' | 'lfm';

export type ChatState =
  | 'unloaded'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'synthesizing'
  | 'speaking'
  | 'error';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
