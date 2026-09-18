import React from 'react';

interface ChoiceBoxProps {
  choices: Array<{
    text: string;
    goto: string;
  }>;
  onSelect: (index: number) => void;
}

export const ChoiceBox: React.FC<ChoiceBoxProps> = ({ choices, onSelect }) => {
  return (
    <div className="choices-container">
      {choices.map((choice, i) => (
        <button
          key={`${choice.goto}_${i}`}
          className="choice-button"
          onClick={() => onSelect(i)}
        >
          {choice.text}
        </button>
      ))}
    </div>
  );
};
