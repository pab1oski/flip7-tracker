import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../../db/repositories'
import { db } from '../../db/schema'
import ActionIcon, { type ActionName } from '../brand/ActionIcon'
import { CardChip, CardFan } from '../brand/Cards'
import Logo from '../brand/Logo'
import Icon from '../icons'
import { strings } from '../strings'

const L = strings.home.legend
const ACTIONS: ActionName[] = ['freeze', 'flipThree', 'secondChance']

/** Compact scoring legend with original card-chip and action-card art. */
function ScoringLegend() {
  return (
    <section className="panel legend" aria-labelledby="legend-title">
      <h2 id="legend-title">{strings.home.legendTitle}</h2>
      <ul className="legend-list">
        <li>
          <span className="legend-art"><CardChip>{L.numbers.chip}</CardChip></span>
          <span><strong>{L.numbers.title}</strong> <span className="muted">{L.numbers.text}</span></span>
        </li>
        <li>
          <span className="legend-art"><span className="card-chip mod">+4</span><span className="card-chip mod">x2</span></span>
          <span><strong>{L.modifiers.title}</strong> <span className="muted">{L.modifiers.text}</span></span>
        </li>
        <li>
          <span className="legend-art"><span className="card-chip seven">{L.flip7.chip}</span></span>
          <span><strong>{L.flip7.title}</strong> <span className="muted">{L.flip7.text}</span></span>
        </li>
        {ACTIONS.map((a) => (
          <li key={a}>
            <span className={`legend-art action-tile ai-${a}`}><ActionIcon name={a} /></span>
            <span><strong>{L[a].title}</strong> <span className="muted">{L[a].text}</span></span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Home() {
  const inProgress = useLiveQuery(async () => ({ game: await repos.getInProgressGame() }), [])
  const players = useLiveQuery(() => db.players.toArray(), [])
  const game = inProgress?.game
  const names = game && players ? game.playerIds.map((id) => players.find((p) => p.id === id)?.name ?? '?').join(', ') : ''

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-top">
          <Logo size={60} className="logo" />
          <CardFan />
        </div>
        <h1>{strings.appName}</h1>
        <p className="muted">{strings.tagline}</p>
      </header>
      {inProgress === undefined ? (
        <p className="muted">{strings.home.loading}</p>
      ) : (
        game && (
          <Link to={`/game/${game.id}`} className="card primary">
            <span className="card-icon"><Icon name="play" size={20} /></span>
            <span className="card-text">
              <strong>{strings.home.resume}</strong>
              <span className="muted">{strings.home.resumeHint(names)}</span>
            </span>
            <Icon name="arrow" size={18} />
          </Link>
        )
      )}
      <nav className="stack">
        <Link to="/new" className="card row-card"><span className="card-icon"><Icon name="plus" size={20} /></span><span className="card-text"><strong>{strings.home.newGame}</strong></span><Icon name="arrow" size={18} /></Link>
        <Link to="/history" className="card row-card"><span className="card-icon"><Icon name="history" size={20} /></span><span className="card-text"><strong>{strings.home.history}</strong></span><Icon name="arrow" size={18} /></Link>
        <Link to="/players" className="card row-card"><span className="card-icon"><Icon name="users" size={20} /></span><span className="card-text"><strong>{strings.home.players}</strong></span><Icon name="arrow" size={18} /></Link>
      </nav>
      <ScoringLegend />
    </main>
  )
}
