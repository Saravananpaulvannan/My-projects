import { useState } from 'react';
import Icon from './Icons.jsx';
import logoUrl from '../asset/images/Aaradhaya crackers logo.png';

export const LOGO_SRC = logoUrl;

export default function Logo({ size = 46, className = '' }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className={`logo ${className}`.trim()} style={{ width: size, height: size }}>
      {failed ? (
        <Icon name="sparkles" size={Math.round(size * 0.56)} />
      ) : (
        <img src={LOGO_SRC} alt="Aaradhaya Crackers logo" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
