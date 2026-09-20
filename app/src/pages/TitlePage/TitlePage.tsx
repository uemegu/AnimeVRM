import React from 'react';
import { SupportedLanguage } from '../../types/scenario';
import { TitleScreen } from '../../components/Title/TitleScreen';

export interface TitlePageProps {
  hasSaveData: boolean;
  lang: SupportedLanguage;
  isMuted: boolean;
  onToggleMute: () => void;
  onStartGame: () => void;
  onContinueGame: () => void;
  onToggleLanguage: () => void;
  onOpenLicense: () => void;
}

export const TitlePage: React.FC<TitlePageProps> = ({
  hasSaveData,
  lang,
  isMuted,
  onToggleMute,
  onStartGame,
  onContinueGame,
  onToggleLanguage,
  onOpenLicense,
}) => {
  return (
    <TitleScreen
      hasSaveData={hasSaveData}
      lang={lang}
      isMuted={isMuted}
      onToggleMute={onToggleMute}
      onStartGame={onStartGame}
      onContinueGame={onContinueGame}
      onToggleLanguage={onToggleLanguage}
      onOpenLicense={onOpenLicense}
    />
  );
};
