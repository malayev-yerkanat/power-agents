import { useEffect, useState } from 'react';
import { PixelArtwork } from './PixelArtwork';
import { AnimatedCityMonster } from './AnimatedCityMonster';
import { t } from './i18n';

const MOTION_KEY = 'power-agents-city-motion';

export function CityBackdrop({ initiallyCollapsed = true }: { initiallyCollapsed?: boolean }) {
  const [expanded, setExpanded] = useState(!initiallyCollapsed);
  const [hasExpanded, setHasExpanded] = useState(!initiallyCollapsed);
  const [motionEnabled, setMotionEnabled] = useState(() => {
    try { return localStorage.getItem(MOTION_KEY) !== 'paused'; } catch { return true; }
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReducedMotion(preference.matches);
    const syncVisibility = () => setPageVisible(!document.hidden);
    syncMotion();
    syncVisibility();
    preference.addEventListener('change', syncMotion);
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      preference.removeEventListener('change', syncMotion);
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  const playing = expanded && motionEnabled && !reducedMotion && pageVisible;
  const toggleMotion = () => {
    const enabled = !motionEnabled;
    setMotionEnabled(enabled);
    try { localStorage.setItem(MOTION_KEY, enabled ? 'playing' : 'paused'); } catch { /* Preference remains available for this session. */ }
  };
  const toggleExpanded = () => {
    if (!expanded) setHasExpanded(true);
    setExpanded(value => !value);
  };

  return <div className={`city-scene${expanded ? '' : ' city-scene-collapsed'}`}>
    <div id="ambient-city" className={`city-backdrop${playing ? '' : ' city-backdrop-paused'}`} aria-hidden="true" hidden={!expanded}>
      {hasExpanded && <div className="city-backdrop-stage">
        <PixelArtwork className="city-landscape" src="/art/city-v2/panorama.png" width={768} height={256} />
        <PixelArtwork className="city-plane city-plane-one" src="/art/vehicles-v3/airliner.png" width={96} height={32} hardEdges />
        <PixelArtwork className="city-plane city-plane-two" src="/art/vehicles-v3/airliner.png" width={96} height={32} hardEdges />
        <AnimatedCityMonster kind="mantis" playing={playing} className="city-monster city-monster-left" />
        <AnimatedCityMonster kind="boss" playing={playing} className="city-monster city-monster-right" />
        <PixelArtwork className="city-car city-car-one" src="/art/vehicles-v3/sedan.png" width={80} height={32} hardEdges />
        <PixelArtwork className="city-car city-car-two" src="/art/vehicles-v3/taxi.png" width={80} height={32} hardEdges />
        <span className="city-car city-car-three"><PixelArtwork className="city-car-art city-car-art-reverse" src="/art/vehicles-v3/sedan.png" width={80} height={32} hardEdges /></span>
      </div>}
    </div>
    <div className="city-motion-control">{expanded && <button className="city-motion-toggle" type="button" onClick={toggleMotion} disabled={reducedMotion}
      aria-pressed={motionEnabled && !reducedMotion} aria-label={t('Анимация города')}
      title={reducedMotion ? t('Движение отключено настройкой уменьшения анимации') : undefined}>
      <span className="city-motion-icon" aria-hidden="true">{motionEnabled && !reducedMotion ? 'Ⅱ' : '▷'}</span>
      {reducedMotion ? t('Город · без движения') : motionEnabled ? t('Город · пауза') : t('Город · оживить')}
    </button>}<button className="city-motion-toggle" type="button" aria-expanded={expanded} aria-controls="ambient-city" onClick={toggleExpanded}>{expanded ? t('Свернуть город') : t('Показать город')}</button></div>
  </div>;
}
