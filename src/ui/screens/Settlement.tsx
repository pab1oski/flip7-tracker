import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { computeGameMoney } from '../../domain/money'
import { settle, type SettlementMode } from '../../domain/settlement'
import { repos } from '../../db/repositories'
import { db } from '../../db/schema'
import { playerColor } from '../colors'
import { formatCents } from '../format'
import MoneyChart from '../game/MoneyChart'
import Icon from '../icons'
import { strings } from '../strings'

const t = strings.settlement

export default function Settlement() {
  const { id = '' } = useParams()
  const loaded = useLiveQuery(async () => ({ value: await repos.loadGame(id) }), [id])
  const playerRecords = useLiveQuery(() => db.players.toArray(), [])
  const [mode, setMode] = useState<SettlementMode>('real')

  const value = loaded?.value
  const money = useMemo(
    () =>
      value
        ? computeGameMoney({
            playerIds: value.game.playerIds,
            rounds: value.rounds,
            stakeCents: value.game.stakeCents,
            limit: value.game.limit,
            winnerSharePct: value.game.winnerSharePct,
          })
        : null,
    [value],
  )

  if (loaded && !value) {
    return (
      <main className="page">
        <Link to="/" className="back"><Icon name="back" size={18} />{strings.back}</Link>
        <p className="empty">{strings.game.notFound}</p>
      </main>
    )
  }
  if (!value || !money || !playerRecords) return <main className="page" />

  const { game } = value
  const nameOf = (pid: string) => playerRecords.find((p) => p.id === pid)?.name ?? '?'
  const players = game.playerIds.map((pid) => ({ id: pid, name: nameOf(pid), total: money.totals[pid] ?? 0 }))

  if (!money.finished) {
    return (
      <main className="page">
        <Link to={`/game/${id}`} className="back"><Icon name="back" size={18} />{t.backToGame}</Link>
        <h1>{t.title}</h1>
        <p className="empty">{t.notFinished}</p>
      </main>
    )
  }

  const transfers = settle(mode, game.playerIds, money)
  const ranking = players
    .map((p, i) => ({ ...p, color: playerColor(i) }))
    .sort((a, b) => b.total - a.total)

  return (
    <main className="page settlement">
      <Link to="/history" className="back"><Icon name="back" size={18} />{strings.back}</Link>
      <h1>{t.title}</h1>
      <p className="muted">
        {new Date(game.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <section className="panel" aria-label={t.resultsTitle}>
        <div className="panel-head"><h2>{t.resultsTitle}</h2></div>
        <ol className="ranking">
          {ranking.map((p) => (
            <li key={p.id} className={money.finalWinners.includes(p.id) ? 'winner' : ''} style={{ '--c': p.color } as React.CSSProperties}>
              <span className="label-name"><i className="dot" />{p.name}</span>
              <span>
                {money.finalWinners.includes(p.id) && <span className="badge accent"><Icon name="trophy" size={12} />{t.winner}</span>}
                <strong>{t.points(p.total)}</strong>
              </span>
            </li>
          ))}
        </ol>
        <p className="note">{t.potWinners(money.finalWinners.map(nameOf).join(', '), formatCents(money.pot))}</p>
        <p className="note muted">{t.splitNote(game.winnerSharePct, 100 - game.winnerSharePct)}</p>
      </section>

      <section className="panel" aria-label={t.balancesTitle}>
        <div className="panel-head"><h2>{t.balancesTitle}</h2></div>
        <ul className="balances">
          {players.map((p, i) => {
            const b = money.balances[p.id] ?? 0
            return (
              <li key={p.id} style={{ '--c': playerColor(i) } as React.CSSProperties}>
                <span className="label-name"><i className="dot" />{p.name}</span>
                <strong className={b > 0 ? 'pos' : b < 0 ? 'neg' : ''}>{formatCents(b)}</strong>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="panel">
        <div className="segmented" role="group" aria-label={t.title}>
          <button type="button" className={mode === 'real' ? 'on' : ''} aria-pressed={mode === 'real'} onClick={() => setMode('real')}>
            {t.modeReal}
          </button>
          <button type="button" className={mode === 'minimal' ? 'on' : ''} aria-pressed={mode === 'minimal'} onClick={() => setMode('minimal')}>
            {t.modeMinimal}
          </button>
        </div>
        <p className="muted">{mode === 'real' ? t.modeHintReal : t.modeHintMinimal}</p>
        {transfers.length === 0 ? (
          <p className="empty">{t.nothingToPay}</p>
        ) : (
          <ul className="transfers">
            {transfers.map((tr) => (
              <li key={`${tr.from}-${tr.to}`}><Icon name="arrow" size={16} />{t.paysTo(nameOf(tr.from), formatCents(tr.cents), nameOf(tr.to))}</li>
            ))}
          </ul>
        )}
      </section>

      <MoneyChart players={players} money={money} />
      <Link to={`/game/${id}`} className="btn-secondary">{t.backToGame}</Link>
    </main>
  )
}
