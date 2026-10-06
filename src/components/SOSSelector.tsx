import { SOS_OPTIONS } from '../data/content';

export function SOSSelector({ onPick }: { onPick: (opt: (typeof SOS_OPTIONS)[number]) => void }) {
  return (
    <div className="stack">
      {SOS_OPTIONS.map((o) => (
        <button key={o.id} className="choice" style={{ minHeight: 76 }} onClick={() => onPick(o)}>
          {o.label}
          <span className="sub">{o.sub}</span>
        </button>
      ))}
    </div>
  );
}
