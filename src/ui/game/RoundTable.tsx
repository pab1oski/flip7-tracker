import { useState, type CSSProperties, type FormEvent } from 'react'
import { roundWinners, type Round } from '../../domain/scoring'
import { CardChip } from '../brand/Cards'
import { playerColor } from '../colors'
import Icon from '../icons'
import { strings } from '../strings'
import type { RacePlayer } from './Race'

const t = strings.game

interface Props {
  players: RacePlayer[]
  rounds: Round[]
  totals: Record<string, number>
  /** When false the current-round form is hidden (game is over). */
  canAdd: boolean
  onAdd: (scores: Record<string, number>) => Promise<void>
  onEditLast: (scores: Record<string, number>) => Promise<void>
  onUndoLast: () => Promise<void>
}

/** Parses the text inputs into non-negative integers, or null if any is invalid. */
function parseScores(ids: string[], values: Record<string, string>): Record<string, number> | null {
  const scores: Record<string, number> = {}
  for (const id of ids) {
    const raw = (values[id] ?? '').trim()
    if (raw === '') {
      scores[id] = 0
      continue
    }
    if (!/^\d+$/.test(raw)) return null
    scores[id] = Number(raw)
  }
  return scores
}

interface FormProps {
  players: RacePlayer[]
  values: Record<string, string>
  setValues: (fn: (v: Record<string, string>) => Record<string, string>) => void
  error: string | null
  submitLabel: string
  onSubmit: (e: FormEvent) => void
  onCancel?: () => void
}

function ScoreForm({ players, values, setValues, error, submitLabel, onSubmit, onCancel }: FormProps) {
  return (
    <form className="round-form" onSubmit={onSubmit}>
      <div className="score-inputs">
        {players.map((p, i) => (
          <label key={p.id} style={{ '--c': playerColor(i) } as CSSProperties}>
            <span className="label-name"><i className="dot" />{p.name}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={values[p.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
        ))}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn-primary">
          <Icon name="check" size={18} />
          {submitLabel}
        </button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>{t.cancelEdit}</button>}
      </div>
    </form>
  )
}

interface ItemProps {
  title: string
  summary: React.ReactNode
  tag?: string
  open: boolean
  onToggle: () => void
  id: string
  children: React.ReactNode
}

function AccordionItem({ title, summary, tag, open, onToggle, id, children }: ItemProps) {
  return (
    <div className={`acc-item${open ? ' open' : ''}${tag ? ' current' : ''}`}>
      <h3>
        <button type="button" className="acc-head" aria-expanded={open} aria-controls={`${id}-panel`} id={`${id}-head`} onClick={onToggle}>
          <span className="acc-title">{title}</span>
          {tag && <span className="badge accent">{tag}</span>}
          <span className="acc-summary">{summary}</span>
          <span className="acc-chevron"><Icon name="chevron" size={18} /></span>
        </button>
      </h3>
      <div className="acc-body" id={`${id}-panel`} role="region" aria-labelledby={`${id}-head`} hidden={!open}>
        <div className="acc-inner">{children}</div>
      </div>
    </div>
  )
}

export default function RoundTable({ players, rounds, totals, canAdd, onAdd, onEditLast, onUndoLast }: Props) {
  const ids = players.map((p) => p.id)
  const nameOf = (pid: string) => players.find((p) => p.id === pid)?.name ?? '?'
  const [addValues, setAddValues] = useState<Record<string, string>>({})
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  // The current round is open by default; played rounds start collapsed.
  const [currentOpen, setCurrentOpen] = useState(true)
  const [openPlayed, setOpenPlayed] = useState<Set<number>>(new Set())
  const winnersPerRound = rounds.map((r) => new Set(roundWinners(ids, r.scores)))
  const lastIndex = rounds.length - 1

  function togglePlayed(i: number) {
    setOpenPlayed((s) => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function startEdit() {
    const last = rounds[lastIndex]
    if (!last) return
    const v: Record<string, string> = {}
    for (const id of ids) v[id] = String(last.scores[id] ?? 0)
    setEditValues(v)
    setEditing(true)
    setEditError(null)
    setOpenPlayed((s) => new Set(s).add(lastIndex))
  }

  function cancelEdit() {
    setEditing(false)
    setEditValues({})
    setEditError(null)
  }

  async function submitAdd(e: FormEvent) {
    e.preventDefault()
    const scores = parseScores(ids, addValues)
    if (!scores) return setAddError(t.invalidPoints)
    try {
      await onAdd(scores)
      setAddValues({})
      setAddError(null)
      setCurrentOpen(true)
    } catch {
      setAddError(t.saveError)
    }
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault()
    const scores = parseScores(ids, editValues)
    if (!scores) return setEditError(t.invalidPoints)
    try {
      await onEditLast(scores)
      cancelEdit()
    } catch {
      setEditError(t.saveError)
    }
  }

  return (
    <section aria-label={t.roundsTitle}>
      <div className="panel-head outside">
        <h2>{t.roundsTitle}</h2>
      </div>
      <div className="accordion">
        {rounds.map((r, ri) => {
          const winners = [...winnersPerRound[ri]]
          const best = Math.max(0, ...ids.map((id) => r.scores[id] ?? 0))
          const isLast = ri === lastIndex
          const open = openPlayed.has(ri) || (isLast && editing)
          return (
            <AccordionItem
              key={ri}
              id={`round-${ri + 1}`}
              title={t.roundLabel(ri + 1)}
              summary={
                <>
                  <Icon name="trophy" size={14} />
                  <span className="acc-names">{winners.map(nameOf).join(', ')}</span>
                  <CardChip srSuffix={t.pointsSr}>{best}</CardChip>
                </>
              }
              open={open}
              onToggle={() => togglePlayed(ri)}
            >
              {isLast && editing ? (
                <ScoreForm
                  players={players}
                  values={editValues}
                  setValues={setEditValues}
                  error={editError}
                  submitLabel={t.saveRound}
                  onSubmit={(e) => void submitEdit(e)}
                  onCancel={cancelEdit}
                />
              ) : (
                <>
                  <ul className="score-list">
                    {players.map((p, i) => (
                      <li key={p.id} className={winnersPerRound[ri].has(p.id) ? 'win' : 'lose'} style={{ '--c': playerColor(i) } as CSSProperties}>
                        <span className="label-name"><i className="dot" />{p.name}</span>
                        <strong>{t.playerPoints(r.scores[p.id] ?? 0)}</strong>
                      </li>
                    ))}
                  </ul>
                  {isLast && (
                    <div className="row actions">
                      <button type="button" className="btn-secondary" onClick={startEdit}>
                        <Icon name="edit" size={16} />
                        {t.editLast}
                      </button>
                      <button type="button" className="btn-danger" onClick={() => {
                          setOpenPlayed((o) => {
                            const n = new Set(o)
                            n.delete(lastIndex)
                            return n
                          })
                          void onUndoLast()
                        }}>
                        <Icon name="undo" size={16} />
                        {t.undoLast}
                      </button>
                    </div>
                  )}
                </>
              )}
            </AccordionItem>
          )
        })}
        {canAdd && (
          <AccordionItem
            id="round-current"
            title={t.roundLabel(rounds.length + 1)}
            tag={t.currentTag}
            summary={null}
            open={currentOpen}
            onToggle={() => setCurrentOpen((o) => !o)}
          >
            <ScoreForm
              players={players}
              values={addValues}
              setValues={setAddValues}
              error={addError}
              submitLabel={t.addRound}
              onSubmit={(e) => void submitAdd(e)}
            />
          </AccordionItem>
        )}
      </div>

      <div className="panel table-panel">
        <div className="panel-head">
          <h2>{t.tableTitle}</h2>
        </div>
        {rounds.length === 0 ? (
          <p className="empty">{t.emptyRounds}</p>
        ) : (
          <div className="table-wrap">
            <table className="rounds">
              <thead>
                <tr>
                  <th scope="col">{t.roundShort}</th>
                  {players.map((p, i) => (
                    <th scope="col" key={p.id} style={{ '--c': playerColor(i) } as CSSProperties}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((r, ri) => (
                  <tr key={ri}>
                    <th scope="row">{ri + 1}</th>
                    {players.map((p) => (
                      winnersPerRound[ri].has(p.id) ? (
                        <td key={p.id} className="win"><CardChip>{r.scores[p.id] ?? 0}</CardChip></td>
                      ) : (
                        <td key={p.id} className="lose">{r.scores[p.id] ?? 0}</td>
                      )
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t.total}</th>
                  {players.map((p) => (
                    <td key={p.id}>{totals[p.id] ?? 0}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
