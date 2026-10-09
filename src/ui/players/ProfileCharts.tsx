import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { GameResult, HistogramBucket, TimelinePoint } from '../../domain/playerProfile'
import { chartTheme, moneyColors, tooltipStyle } from '../colors'
import { formatCents } from '../format'
import { strings } from '../strings'
import { usePrefersReducedMotion, useSvgId } from './visualUtils'

const t = strings.profile
const axisProps = { stroke: chartTheme.axis, fontSize: 11, tickLine: false, axisLine: false } as const
const euroTick = (v: number) => `${Math.round(v)}€`

interface TooltipProps<T> {
  active?: boolean
  payload?: readonly { payload: T }[]
}

function TooltipBox({ title, lines }: { title: string; lines: { text: string; className?: string }[] }) {
  return (
    <div style={{ ...tooltipStyle, padding: '8px 12px' }}>
      <div style={{ color: chartTheme.axis, fontSize: 12, marginBottom: 2 }}>{title}</div>
      {lines.map((l, i) => (
        <div key={i} className={l.className} style={{ fontWeight: 700 }}>
          {l.text}
        </div>
      ))}
    </div>
  )
}

const signClass = (cents: number) => (cents > 0 ? 'pos' : cents < 0 ? 'neg' : undefined)

interface MoneyRow {
  step: number
  value: number
  point: TimelinePoint
}

function MoneyTooltip({ active, payload }: TooltipProps<MoneyRow>) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const { point } = row
  const title =
    point.kind === 'start'
      ? t.tooltipStart
      : `${t.tooltipGame(point.game)} · ${point.kind === 'payout' ? t.tooltipPayout : t.tooltipRound(point.round)}`
  return <TooltipBox title={title} lines={[{ text: formatCents(point.balanceCents), className: signClass(point.balanceCents) }]} />
}

/** Cumulative money round by round, green above zero and red below, with game boundaries. */
export function MoneyTimelineChart({ timeline, color }: { timeline: readonly TimelinePoint[]; color: string }) {
  const reduced = usePrefersReducedMotion()
  const fillId = useSvgId('money-fill')
  const strokeId = useSvgId('money-stroke')
  const data: MoneyRow[] = timeline.map((point) => ({ step: point.step, value: point.balanceCents / 100, point }))
  const values = data.map((d) => d.value)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  // Fraction of the plot height (from the top) where y = 0 sits.
  const zeroAt = max === min ? 0.5 : max / (max - min)

  // One marker at the start of each game (the step right before its first round).
  const starts: { game: number; step: number }[] = []
  for (const p of timeline) {
    if (p.kind === 'round' && p.round === 1) starts.push({ game: p.game, step: p.step - 1 })
  }
  const labelEvery = Math.max(1, Math.ceil(starts.length / 8))

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={moneyColors.pos} stopOpacity={0.42} />
              <stop offset={zeroAt} stopColor={moneyColors.pos} stopOpacity={0.04} />
              <stop offset={zeroAt} stopColor={moneyColors.neg} stopOpacity={0.04} />
              <stop offset={1} stopColor={moneyColors.neg} stopOpacity={0.42} />
            </linearGradient>
            <linearGradient id={strokeId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={zeroAt} stopColor={moneyColors.pos} />
              <stop offset={zeroAt} stopColor={moneyColors.neg} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis dataKey="step" type="number" domain={[0, 'dataMax']} allowDecimals={false} hide />
          <YAxis {...axisProps} width={44} tickFormatter={euroTick} domain={[min, max]} />
          {starts.map((s, i) => (
            <ReferenceLine
              key={s.game}
              x={s.step}
              stroke={color}
              strokeOpacity={0.35}
              strokeDasharray="3 4"
              label={i % labelEvery === 0 ? { value: t.gameMarker(s.game), position: 'top', fill: color, fontSize: 10, fontWeight: 700 } : undefined}
            />
          ))}
          <ReferenceLine y={0} stroke={chartTheme.zero} strokeDasharray="4 4" />
          <Tooltip content={<MoneyTooltip />} cursor={{ stroke: color, strokeOpacity: 0.5 }} />
          <Area
            type="monotone"
            dataKey="value"
            baseValue={0}
            stroke={max === min ? chartTheme.axis : `url(#${strokeId})`}
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: chartTheme.tooltipBg, strokeWidth: 2 }}
            isAnimationActive={!reduced}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface GameRow {
  label: string
  value: number
  result: GameResult
}

function GameTooltip({ active, payload }: TooltipProps<GameRow>) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const { result } = row
  return (
    <TooltipBox
      title={`${t.inGame(result.index)} · ${result.tied ? t.positionTied(result.position) : t.position(result.position)}`}
      lines={[{ text: formatCents(result.netCents), className: signClass(result.netCents) }, { text: t.points(result.points) }]}
    />
  )
}

/** Net money per game as green / red bars. */
export function PerGameChart({ results }: { results: readonly GameResult[] }) {
  const reduced = usePrefersReducedMotion()
  const data: GameRow[] = results.map((result) => ({ label: t.gameMarker(result.index), value: result.netCents / 100, result }))
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} width={44} tickFormatter={euroTick} />
          <ReferenceLine y={0} stroke={chartTheme.zero} />
          <Tooltip content={<GameTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={36} isAnimationActive={!reduced}>
            {data.map((d) => (
              <Cell key={d.result.gameId} fill={d.value >= 0 ? moneyColors.pos : moneyColors.neg} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface BucketRow {
  label: string
  count: number
  bucket: HistogramBucket
}

const bucketLabel = (b: HistogramBucket) => (b.max === 0 ? t.bucketBust : t.bucketRange(b.min, b.max))

function BucketTooltip({ active, payload }: TooltipProps<BucketRow>) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const title = row.bucket.max === 0 ? `${t.bucketBust} (${t.bucketBustHint})` : t.bucketPoints(row.label)
  return <TooltipBox title={title} lines={[{ text: t.rounds(row.count) }]} />
}

/** Points-per-round distribution in the player's color; the bust bucket is red. */
export function HistogramChart({ buckets, color }: { buckets: readonly HistogramBucket[]; color: string }) {
  const reduced = usePrefersReducedMotion()
  const gradId = useSvgId('hist')
  const data: BucketRow[] = buckets.map((bucket) => ({ label: bucketLabel(bucket), count: bucket.count, bucket }))
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 20, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} stopColor={color} stopOpacity={1} />
              <stop offset={1} stopColor={color} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartTheme.grid} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval={0} />
          <YAxis {...axisProps} width={28} allowDecimals={false} />
          <Tooltip content={<BucketTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={!reduced}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.bucket.max === 0 ? moneyColors.neg : `url(#${gradId})`} />
            ))}
            <LabelList dataKey="count" position="top" fill={chartTheme.tooltipText} fontSize={11} fontWeight={700} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
