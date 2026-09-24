import React from 'react';
import { ActionLocationId, ActionLocationOption, DayPhase } from '../../types/game';
import { ActionSelectModal } from '../../components/ActionSelect/ActionSelectModal';

export interface ActionSelectPageProps {
  options: ActionLocationOption[];
  onSelectLocation: (locationId: ActionLocationId) => void;
  phase?: DayPhase;
  affinities?: Record<string, number>;
}

export const ActionSelectPage: React.FC<ActionSelectPageProps> = ({
  options,
  onSelectLocation,
  phase,
  affinities,
}) => {
  return (
    <div className="action-select-page">
      <ActionSelectModal
        options={options}
        onSelectLocation={onSelectLocation}
        phase={phase}
        affinities={affinities}
      />
    </div>
  );
};
