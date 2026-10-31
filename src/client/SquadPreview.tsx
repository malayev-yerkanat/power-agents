import type { Member } from '../shared/types';
import { rangerAsset } from './Encounter';
import { t } from './i18n';

type Position = { left: number; top: number };

// Native 160px sprite frames fit inside a 288 × 230 logical pixel stage.
const formations: Record<number, Position[]> = {
  1: [{ left: 64, top: 35 }],
  2: [{ left: 0, top: 8 }, { left: 128, top: 70 }],
  3: [{ left: 0, top: 8 }, { left: 128, top: 8 }, { left: 64, top: 70 }],
  4: [{ left: 0, top: 0 }, { left: 128, top: 0 }, { left: 16, top: 70 }, { left: 112, top: 70 }],
  5: [{ left: 0, top: 0 }, { left: 128, top: 0 }, { left: 64, top: 35 }, { left: 0, top: 70 }, { left: 128, top: 70 }],
};

export function SquadPreview({ members }: { members: Member[] }) {
  const visible = members.slice(0, 5);
  const positions = formations[visible.length] || [];
  const countLabel = members.length === 1 ? t('участник') : members.length < 5 ? t('участника') : t('участников');

  return <figure className="squad-preview">
    <div className="squad-preview-stage" aria-hidden="true">
      <span className="squad-preview-ground" />
      {visible.map((member, index) => {
        const asset = rangerAsset(member.connectionId);
        return <div className="squad-preview-actor" key={member.id} style={{ ...positions[index], zIndex: positions[index].top + 1 }}>
          {asset
            ? <img src={asset} alt="" width={160} height={160} draggable={false} />
            : <span className="squad-preview-neutral">{member.name.slice(0, 1).toUpperCase() || '?'}</span>}
        </div>;
      })}
    </div>
    <figcaption><span>{t('Состав команды')}</span><span>{members.length} {countLabel}</span></figcaption>
  </figure>;
}
