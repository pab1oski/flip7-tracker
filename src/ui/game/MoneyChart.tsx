import type { CSSProperties } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GameMoney } from '../../domain/money'
import { chartTheme, playerColor, tooltipStyle } from '../colors'
import { formatCents } from '../format'
import { strings } from '../strings'
import type { RacePlayer } from './Race'

const t = strings.game

const lineWidth = (index: number, count: number) => (count <= 1 ? 2.5 : 6 - (index * 4) / (count - 1))

export default function MoneyChart({ players, money }: { players: RacePlayer[]; money: GameMoney }) {
  // Start from a zero point so the first round has a visible slope.
  const data = [
    { label: '0', ...Object.fromEntries(players.map((p) => [p.id, 0])) },
    ...money.series.map((pt, i) => ({
      label: pt.kind === 'payout' ? t.payoutPoint : String(pt.round),
      key: i,
      ...Object.fromEntries(players.map((p) => [p.id, pt.balances[p.id] / 100])),
    })),
  ]
  const euro = (v: number) => formatCents(Math.round(v * 100))

  return (
    <section className="panel" aria-label={t.moneyTitle}>
      <div className="panel-head">
        <h2>{t.moneyTitle}</h2>
        <span className="pot-pill">
          {t.pot} <strong>{formatCents(money.pot)}</strong>
        </span>
      </div>
      <ul className="balances">
        {players.map((p, i) => {
          const b = money.balances[p.id] ?? 0
          return (
            <li key={p.id} style={{ '--c': playerColor(i) } as CSSProperties}>
              <span className="label-name"><i className="dot" />{p.name}</span>
              <strong className={b > 0 ? 'pos' : b < 0 ? 'neg' : ''}>{formatCents(b)}</strong>
            </li>
          )
        })}
      </ul>
      <div className="chart">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={chartTheme.grid} vertical={false} />
            <XAxis dataKey="label" stroke={chartTheme.axis} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={chartTheme.axis} fontSize={12} width={44} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}`} />
            <ReferenceLine y={0} stroke={chartTheme.zero} strokeDasharray="4 4" />
            <Tooltip
              formatter={(v) => euro(Number(v))}
              contentStyle={tooltipStyle}
              cursor={{ stroke: chartTheme.grid }}
              labelFormatter={(l) => (/^\d+$/.test(String(l)) ? t.roundAxis(Number(l)) : String(l))}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            {/* Earlier players draw thicker so identical balances stay visible as layered lines. */}
            {players.map((p, i) => (
              <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={playerColor(i)} strokeWidth={lineWidth(i, players.length)} dot={{ r: 3, strokeWidth: 0, fill: playerColor(i) }} activeDot={{ r: 5 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
