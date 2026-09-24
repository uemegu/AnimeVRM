import React from 'react';
import { TitleScreen } from '../../components/Title/TitleScreen';

export interface TitlePageProps {
  hasSaveData: boolean;
  onStartGame: () => void;
  onContinueGame: () => void;
  onStartGodExperiment?: () => void;
  onOpenLicense: () => void;
}

export const TitlePage: React.FC<TitlePageProps> = ({
  hasSaveData,
  onStartGame,
  onContinueGame,
  onStartGodExperiment,
  onOpenLicense,
}) => {
  return (
    <TitleScreen
      hasSaveData={hasSaveData}
      onStartGame={onStartGame}
      onContinueGame={onContinueGame}
      onStartGodExperiment={onStartGodExperiment}
      onOpenLicense={onOpenLicense}
    />
  );
};
