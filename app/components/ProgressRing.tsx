"use client";

interface Props {
  positive: number;
  called: number;
  negative: number;
  total: number;
  size?: number;
}

export default function ProgressRing({ positive, called, negative, total, size = 64 }: Props) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeTotal = total || 1;

  const pPositive = positive / safeTotal;
  const pCalled = called / safeTotal;
  const pNegative = negative / safeTotal;

  const segments = [
    { color: "#34d399", value: pPositive },
    { color: "#fbbf24", value: pCalled },
    { color: "#f87171", value: pNegative },
  ];

  let offset = 0;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232329" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const dash = seg.value * c;
          const start = -offset * c;
          offset += seg.value;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={start}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-base font-bold leading-none">{Math.round(((positive + called + negative) / safeTotal) * 100)}%</div>
        <div className="text-[9px] uppercase tracking-wider text-neutral-500 leading-none mt-0.5">traités</div>
      </div>
    </div>
  );
}
