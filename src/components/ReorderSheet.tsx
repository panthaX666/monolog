import { useState, type PointerEvent } from 'react';
import { Sheet } from './Sheet';

// Reorder a workout's exercises: drag a row by its ≡ handle, or use ↑ ↓ (also what screen readers use).

const ROW = 64;

export interface ReorderItem {
  id: string;
  name: string;
  detail: string;
}

export function ReorderSheet({
  items,
  onSave,
  onClose,
}: {
  items: ReorderItem[];
  onSave: (orderedIds: string[]) => void;
  onClose: () => void;
}) {
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [drag, setDrag] = useState<{ id: string; startY: number; dy: number } | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return order;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    setOrder(next);
    return next;
  };

  const down = (e: PointerEvent, id: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, startY: e.clientY, dy: 0 });
  };
  const moveTo = (e: PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const from = order.indexOf(drag.id);
    const to = Math.max(0, Math.min(order.length - 1, from + Math.round(dy / ROW)));
    if (to !== from) {
      move(from, to);
      // Keep the row under the finger: its slot moved by (to - from) rows.
      setDrag({ id: drag.id, startY: drag.startY + (to - from) * ROW, dy: dy - (to - from) * ROW });
    } else setDrag({ ...drag, dy });
  };
  const up = () => setDrag(null);

  const changed = order.some((id, i) => id !== items[i]?.id);

  return (
    <Sheet onClose={onClose} tall label="Reorder exercises">
      <div className="sheet-head">
        <span className="t-h2">Reorder</span>
        <button className="btn btn-primary btn-small" onClick={() => (changed ? onSave(order) : onClose())}>
          Done
        </button>
      </div>
      <p className="t-meta" style={{ padding: '0 16px', margin: '4px 0 8px' }}>
        Hold ≡ and drag, or use the arrows.
      </p>
      <ol className="sheet-scroll reorder-list" aria-label="Exercise order">
        {order.map((id, i) => {
          const item = byId.get(id)!;
          const dragging = drag?.id === id;
          return (
            <li
              key={id}
              className={`reorder-row ${dragging ? 'dragging' : ''}`}
              style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}
            >
              <span
                className="reorder-handle"
                aria-hidden="true"
                onPointerDown={(e) => down(e, id)}
                onPointerMove={moveTo}
                onPointerUp={up}
                onPointerCancel={up}
              >
                ≡
              </span>
              <span className="reorder-name">
                {item.name}
                <small>{item.detail}</small>
              </span>
              <button
                className="icon-btn"
                aria-label={`Move ${item.name} up`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                aria-label={`Move ${item.name} down`}
                disabled={i === order.length - 1}
                onClick={() => move(i, i + 1)}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}
