import React from 'react';
import './WhiteFlashOverlay.css';

interface WhiteFlashOverlayProps {
  triggerKey: string;
}

export const WhiteFlashOverlay: React.FC<WhiteFlashOverlayProps> = ({ triggerKey }) => {
  return <div key={triggerKey} className="white-flash-overlay" aria-hidden="true" />;
};
