import { Link } from 'react-router-dom'
import { computeGameMoney } from '../../domain/money'
import ActionIcon from '../brand/ActionIcon'
import Icon from '../icons'
import { strings } from '../strings'
import { useAllGames } from '../useAllGames'

const t = strings.history

export default function History() {
  const data = useAllGames()
  const games = data ? [...data.games].reverse() : []
  const nameOf = (pid: string) => data?.players.find((p) => p.id === pid)?.name ?? '?'

  return (
    <main className="page">
      <Link to="/" className="back"><Icon name="back" size={18} />{strings.back}</Link>
      <h1>{t.title}</h1>
      {data && games.length === 0 && <p className="empty with-art"><span className="action-tile ai-flipThree"><ActionIcon name="flipThree" size={28} /></span>{t.empty}</p>}
      <ul className="stack history-list">
        {games.map(({ stored, record }) => {
          const money = computeGameMoney(record)
          return (
            <li key={stored.id}>
              <Link to={`/game/${stored.id}/settlement`} className="card">
                <strong>
                  {new Date(stored.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                </strong>
                <span className="win-line"><Icon name="trophy" size={14} />{t.winner(money.finalWinners.map(nameOf).join(', '))}</span>
                <span className="muted">
                  {stored.playerIds.map(nameOf).join(', ')} · {t.rounds(record.rounds.length)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
