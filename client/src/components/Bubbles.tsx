import React, { useMemo } from 'react';
import './Bubbles.css';

export default function Bubbles() {
  const bubbles = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 60 + 20}px`,
      delay: `${Math.random() * 20}s`,
      duration: `${Math.random() * 20 + 15}s`,
    }));
  }, []);

  return (
    <div className="bubbles-container">
      {bubbles.map(b => (
        <div
          key={b.id}
          className="bubble"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}
    </div>
  );
}
