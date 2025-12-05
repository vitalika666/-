import React, { useState, useEffect } from 'react';

interface TypewriterProps {
  text: string;
  speed?: number;
}

const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 20 }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      // Using slice ensures we always render the exact substring up to i,
      // preventing issues with skipped characters or state update race conditions.
      setDisplayedText(text.slice(0, i));
      
      if (i >= text.length) {
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <p className="leading-relaxed whitespace-pre-wrap">{displayedText}</p>;
};

export default Typewriter;