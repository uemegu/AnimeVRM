import React from 'react';
import { ActionLocationId, ActionLocationOption, DayPhase } from '../../types/game';
import { SupportedLanguage } from '../../types/scenario';
import { ActionSelectModal } from '../../components/ActionSelect/ActionSelectModal';

export interface ActionSelectPageProps {
  options: ActionLocationOption[];
  lang: SupportedLanguage;
  onSelectLocation: (locationId: ActionLocationId) => void;
  phase?: DayPhase;
  affinities?: Record<string, number>;
}

export const ActionSelectPage: React.FC<ActionSelectPageProps> = ({
  options,
  lang,
  onSelectLocation,
  phase,
  affinities,
}) => {
  return (
    <div className="action-select-page">
      <ActionSelectModal
        options={options}
        lang={lang}
        onSelectLocation={onSelectLocation}
        phase={phase}
        affinities={affinities}
      />
    </div>
  );
};
