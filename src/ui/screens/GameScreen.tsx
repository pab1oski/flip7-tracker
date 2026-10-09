import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { computeGameMoney } from '../../domain/money'
import { repos } from '../../db/repositories'
import { db } from '../../db/schema'
import MoneyChart from '../game/MoneyChart'
import Race, { type RacePlayer } from '../game/Race'
import RoundTable from '../game/RoundTable'
import { formatCents } from '../format'
import Icon from '../icons'
import { strings } from '../strings'

const t = strings.game

export default function GameScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const loaded = useLiveQuery(async () => ({ value: await repos.loadGame(id) }), [id])
  const playerRecords = useLiveQuery(() => db.players.toArray(), [])
  const [finishError, setFinishError] = useState(false)

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
  const players: RacePlayer[] | null = useMemo(() => {
    if (!value || !playerRecords || !money) return null
    return value.game.playerIds.map((pid) => ({
      id: pid,
      name: playerRecords.find((p) => p.id === pid)?.name ?? '?',
      total: money.totals[pid] ?? 0,
    }))
  }, [value, playerRecords, money])

  if (loaded && !value) {
    return (
      <main className="page">
        <Link to="/" className="back"><Icon name="back" size={18} />{strings.back}</Link>
        <p className="empty">{t.notFound}</p>
      </main>
    )
  }
  if (!value || !players || !money) return <main className="page" />

  const { game, rounds } = value
  const nameOf = (pid: string) => players.find((p) => p.id === pid)?.name ?? '?'
  const stored = game.status === 'finished'

  async function finish() {
    try {
      await repos.finishGame(id)
      navigate(`/game/${id}/settlement`)
    } catch {
      setFinishError(true)
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="icon-btn" aria-label={strings.back}><Icon name="back" size={20} /></Link>
          <dl className="stats-strip">
            <div><dt><Icon name="flag" size={13} />{t.limit}</dt><dd>{game.limit}</dd></div>
            <div><dt><Icon name="coins" size={13} />{t.stake}</dt><dd>{formatCents(game.stakeCents)}</dd></div>
            <div aria-label={t.splitAria(game.winnerSharePct, 100 - game.winnerSharePct)}>
              <dt>{t.split}</dt><dd>{t.splitValue(game.winnerSharePct, 100 - game.winnerSharePct)}</dd>
            </div>
            <div><dt>{t.pot}</dt><dd className="accent-text">{formatCents(money.pot)}</dd></div>
          </dl>
        </div>
      </header>
    <main className="page game">

      {money.finished && (
        <section className="finish-card" role="status">
          <span className="finish-icon"><Icon name="trophy" size={22} /></span>
          <h2>{stored ? t.finishedBanner : t.finishTitle}</h2>
          <p>{t.finishWinners(money.finalWinners.map(nameOf).join(', '))}</p>
          <p>{t.finishPot(formatCents(money.pot))}</p>
          {stored ? (
            <Link to={`/game/${id}/settlement`} className="btn-primary">{t.goSettlement}<Icon name="arrow" size={18} /></Link>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void finish()}>{t.finishButton}</button>
          )}
          {finishError && <p className="error" role="alert">{t.saveError}</p>}
        </section>
      )}

      <Race players={players} limit={game.limit} />
      <RoundTable
        players={players}
        rounds={rounds}
        totals={money.totals}
        canAdd={!money.finished}
        onAdd={async (scores) => {
          await repos.addRound(id, scores)
        }}
        onEditLast={async (scores) => {
          await repos.editLastRound(id, scores)
        }}
        onUndoLast={() => repos.deleteLastRound(id)}
      />
      <MoneyChart players={players} money={money} />
    </main>
    </>
  )
}
