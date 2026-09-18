import React from 'react';

interface DialogueBoxProps {
  speaker?: string;
  text: string;
  onClick: () => void;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({
  speaker,
  text,
  onClick,
}) => {
  return (
    <div className="dialogue-window" onClick={onClick}>
      {speaker ? <div className="speaker-name">{speaker}</div> : null}
      <div className="dialogue-text">{text}</div>
      <div className="dialogue-prompt">▼ Click to continue</div>
    </div>
  );
};
