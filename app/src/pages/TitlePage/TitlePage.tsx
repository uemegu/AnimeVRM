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
  onStartGodExperiment?: () => void;
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
  onStartGodExperiment,
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
      onStartGodExperiment={onStartGodExperiment}
      onToggleLanguage={onToggleLanguage}
      onOpenLicense={onOpenLicense}
    />
  );
};
