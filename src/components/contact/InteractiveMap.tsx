import { useState } from 'react';
import { MapPinned } from 'lucide-react';

export function InteractiveMap() {
  const [active, setActive] = useState(false);

  return (
    <div className="interactive-map" data-active={active ? 'true' : 'false'}>
      <iframe
        title="Mapa de Casa La Arbolada en Tandil"
        src="https://www.google.com/maps?q=Casa%20La%20Arbolada%2C%20Tandil%2C%20Buenos%20Aires&output=embed"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        tabIndex={active ? 0 : -1}
      />
      {!active && (
        <button type="button" onClick={() => setActive(true)} aria-label="Activar mapa interactivo">
          <MapPinned size={24} strokeWidth={1.7} aria-hidden="true" />
          <span>Ver mapa</span>
        </button>
      )}
    </div>
  );
}
