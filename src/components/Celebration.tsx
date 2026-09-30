import { useEffect } from 'react';

export interface CelebrationData {
  exerciseName: string;
  kind: 'weight' | 'reps' | 'duration' | 'distance' | 'pace';
  delta: string;
  before: { label: string; value: string };
  after: { label: string; value: string };
}

const RIBBON: Record<CelebrationData['kind'], string> = {
  weight: 'NEW WEIGHT RECORD',
  reps: 'NEW REP RECORD',
  duration: 'NEW TIME RECORD',
  distance: 'NEW DISTANCE RECORD',
  pace: 'NEW PACE RECORD',
};

const SPARKS: [number, number][] = [
  [10, 16],
  [86, 12],
  [8, 50],
  [90, 44],
  [18, 30],
  [80, 30],
];

function Trophy() {
  return (
    <svg className="cel-trophy" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="trophy-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset=".55" stopColor="#f5c542" />
          <stop offset="1" stopColor="#c9951c" />
        </linearGradient>
      </defs>
      <path d="M34 22h52v18c0 20-11 34-26 34S34 60 34 40z" fill="url(#trophy-g)" />
      <path
        d="M34 28H20c0 16 8 24 18 25M86 28h14c0 16-8 24-18 25"
        fill="none"
        stroke="url(#trophy-g)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <rect x="54" y="72" width="12" height="16" fill="url(#trophy-g)" />
      <rect x="40" y="88" width="40" height="10" rx="3" fill="url(#trophy-g)" />
      <rect x="34" y="98" width="52" height="8" rx="3" fill="#c9951c" />
      <path d="M46 30c0 14 4 24 10 30" stroke="#fff6d6" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".6" />
    </svg>
  );
}

/** Full record celebration (SPEC D41). Tap OK or outside the card to close. */
export function Celebration({ data, onClose }: { data: CelebrationData; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="celebrate" onClick={onClose}>
      <div className="cel-card" role="alertdialog" aria-label="New record" onClick={(e) => e.stopPropagation()}>
        {SPARKS.map(([x, y], i) => (
          <span key={i} className="spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.18}s` }}>
            ✦
          </span>
        ))}
        <div className="cel-title">New record</div>
        <div className="cel-ex">{data.exerciseName}</div>
        <Trophy />
        <div className="ribbon">{RIBBON[data.kind]}</div>
        <div className="cel-delta">{data.delta}</div>
        <div className="cel-ba">
          <div>
            <div className="d">{data.before.label}</div>
            <div className="v old">{data.before.value}</div>
          </div>
          <div className="cel-arrow">▶</div>
          <div>
            <div className="d">{data.after.label}</div>
            <div className="v">{data.after.value}</div>
          </div>
        </div>
        <button className="btn btn-primary cel-ok" onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}
