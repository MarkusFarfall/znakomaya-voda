import type { Engine } from '@/game/engine';
import { NAV_LEFT, NAV_RIGHT, SPOT_WORLD_WIDTH } from '@/game/navigation';
import type { Scene } from '@/game/render/scene';
import { bedFrac } from '@/game/world';

export function LocalNavigationPanel({ engine: e, scene, landscape }: { engine: Engine; scene: Scene; landscape: boolean }) {
  const n = e.navigation;
  const pos = n.nx * 1000, target = n.target === null ? null : n.target / SPOT_WORLD_WIDTH * 1000;
  const profile = Array.from({ length: 81 }, (_, i) => `${i * 12.5},${27 + bedFrac(e.spot, i / 80) * 30}`).join(' ');
  const state = n.state === 'turning' ? 'Разворачиваемся' : n.state === 'braking' ? 'Тормозим' : n.moving ? 'Идём к точке' : 'Лодка остановлена';
  return <section aria-label="Перемещение по подлокации" className={`zv-ui local-navigation ${landscape ? 'local-navigation--land' : ''}`} onPointerDown={ev => ev.stopPropagation()}>
    <div className="local-navigation__head">
      <div className="local-navigation__heading"><span className="local-navigation__eyebrow">МАЛЫЙ ХОД · {e.spot.name}</span><strong role="status">{state}</strong></div>
      <div className="local-navigation__actions">
        <button className="btn btn-quiet" onClick={() => e.stopNavigation()} disabled={!n.moving} title="Плавно остановить лодку · пробел">Стоп</button>
        <button className="btn btn-solid" onClick={() => e.setNavigationMode(false)} disabled={n.moving} title={n.moving ? 'Сначала остановите лодку' : 'Убрать карту и приготовить снасть'}>Рыбачить</button>
      </div>
    </div>
    <div className="local-navigation__chartrow">
      <button className="local-navigation__edge" onClick={() => e.navigateTo(NAV_LEFT)} aria-label="Плыть к левой границе" title="К левой границе">←</button>
      <div className="local-navigation__chart">
        <svg viewBox="0 0 1000 64" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 20H1000" stroke="#99c7bc" strokeOpacity=".25" />
          <polygon points={`0,64 ${profile} 1000,64`} fill="#728e80" fillOpacity=".22" />
          <polyline points={profile} fill="none" stroke="#9aae97" strokeOpacity=".6" />
          <rect x={scene.cameraX / SPOT_WORLD_WIDTH * 1000} y="2" width={scene.viewWidth / SPOT_WORLD_WIDTH * 1000} height="59" rx="4" fill="#d6d5ad" fillOpacity=".05" stroke="#d6d5ad" strokeOpacity=".28" />
          {[100, 900].map(x => <path key={x} d={`M${x} 7V60`} stroke="#c7b994" strokeDasharray="3 5" strokeOpacity=".5" />)}
          {target !== null && <><path d={`M${pos} 19H${target}`} stroke="#dfc68f" strokeDasharray="5 6" /><path d={`M${target} 7V31`} stroke="#f1d69d" strokeWidth="2" /></>}
          <path d={`M${pos - 12} 17H${pos + 12}L${pos + 7} 25H${pos - 7}Z`} fill="#f7e2b5" />
        </svg>
        <input type="range" min="0" max="1000" step="5" value={Math.round(target ?? pos)} aria-label="Точка назначения в подлокации" aria-valuetext={`${Math.round(((target ?? pos) / 1000 - NAV_LEFT) / (NAV_RIGHT - NAV_LEFT) * 100)} процентов от левой границы`} onChange={ev => e.navigateTo(Number(ev.target.value) / 1000)} />
      </div>
      <button className="local-navigation__edge" onClick={() => e.navigateTo(NAV_RIGHT)} aria-label="Плыть к правой границе" title="К правой границе">→</button>
    </div>
    <div className="local-navigation__hint"><span>Нажмите на воду или выберите точку на карте</span><span>{Math.round((n.nx - NAV_LEFT) / (NAV_RIGHT - NAV_LEFT) * 100)}% акватории</span></div>
  </section>;
}
