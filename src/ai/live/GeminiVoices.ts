/**
 * Gemini Multimodal Live API Voice Definitions
 * Gemini currently supports 30 official prebuilt voices for audio generation.
 */

export interface GeminiLiveVoice {
  name: string;
  gender: 'female' | 'male';
  labelJa: string;
  labelEn: string;
}

export const GEMINI_LIVE_VOICES: GeminiLiveVoice[] = [
  // 女性ボイス (Female Voices - 13)
  { name: 'Aoede', gender: 'female', labelJa: '爽やか・軽快 (Breezy)', labelEn: 'Breezy' },
  { name: 'Kore', gender: 'female', labelJa: '凛とした・芯のある (Firm)', labelEn: 'Firm' },
  { name: 'Leda', gender: 'female', labelJa: '若々しい・活発 (Youthful)', labelEn: 'Youthful' },
  { name: 'Zephyr', gender: 'female', labelJa: '明るい・親しみやすい (Bright)', labelEn: 'Bright' },
  { name: 'Callirrhoe', gender: 'female', labelJa: '親切・フレンドリー (Friendly)', labelEn: 'Friendly' },
  { name: 'Autonoe', gender: 'female', labelJa: '快活・朗らか (Cheerful)', labelEn: 'Cheerful' },
  { name: 'Despina', gender: 'female', labelJa: '穏やか・優しい (Smooth & Gentle)', labelEn: 'Smooth & Gentle' },
  { name: 'Erinome', gender: 'female', labelJa: '澄んだ・クリア (Clear)', labelEn: 'Clear' },
  { name: 'Laomedeia', gender: 'female', labelJa: 'アップビート・活気 (Upbeat)', labelEn: 'Upbeat' },
  { name: 'Achernar', gender: 'female', labelJa: '温かみ・ソフト (Soft & Warm)', labelEn: 'Soft & Warm' },
  { name: 'Gacrux', gender: 'female', labelJa: '落ち着き・大人びた (Mature)', labelEn: 'Mature' },
  { name: 'Vindemiatrix', gender: 'female', labelJa: '物腰柔らかな (Gentle)', labelEn: 'Gentle' },
  { name: 'Sulafat', gender: 'female', labelJa: '温もり・包容力 (Warm)', labelEn: 'Warm' },

  // 男性ボイス (Male Voices - 17)
  { name: 'Puck', gender: 'male', labelJa: '快活・アップビート (Upbeat)', labelEn: 'Upbeat' },
  { name: 'Charon', gender: 'male', labelJa: '知的・情報案内 (Informative)', labelEn: 'Informative' },
  { name: 'Fenrir', gender: 'male', labelJa: 'エネルギッシュ (Excitable)', labelEn: 'Excitable' },
  { name: 'Orus', gender: 'male', labelJa: '芯のある・力強い (Firm)', labelEn: 'Firm' },
  { name: 'Enceladus', gender: 'male', labelJa: '息づかい・ソフト (Breathy)', labelEn: 'Breathy' },
  { name: 'Iapetus', gender: 'male', labelJa: 'クリア・明瞭 (Clear)', labelEn: 'Clear' },
  { name: 'Umbriel', gender: 'male', labelJa: '気さく・リラックス (Easy-going)', labelEn: 'Easy-going' },
  { name: 'Algieba', gender: 'male', labelJa: '滑らか・スムーズ (Smooth)', labelEn: 'Smooth' },
  { name: 'Algenib', gender: 'male', labelJa: '渋み・ハスキー (Gravelly)', labelEn: 'Gravelly' },
  { name: 'Rasalgethi', gender: 'male', labelJa: '語り口調・ナレーター (Narrator)', labelEn: 'Narrator' },
  { name: 'Alnilam', gender: 'male', labelJa: '自信に満ちた (Confident)', labelEn: 'Confident' },
  { name: 'Schedar', gender: 'male', labelJa: '堅実・落ち着き (Steady)', labelEn: 'Steady' },
  { name: 'Pulcherrima', gender: 'male', labelJa: '前向き・ストレート (Forward)', labelEn: 'Forward' },
  { name: 'Achird', gender: 'male', labelJa: '親しみ・温厚 (Kind)', labelEn: 'Kind' },
  { name: 'Zubenelgenubi', gender: 'male', labelJa: 'カジュアル (Casual)', labelEn: 'Casual' },
  { name: 'Sadachbia', gender: 'male', labelJa: '生き生きとした (Lively)', labelEn: 'Lively' },
  { name: 'Sadaltager', gender: 'male', labelJa: '博識・知性 (Knowledgeable)', labelEn: 'Knowledgeable' },
];
