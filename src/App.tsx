import { useEffect, useReducer, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { facingLabel, initialState, placeName, reducer, type Dir, type GameState, type LogEntry } from './game/engine'
import { CLUES, CLUE_ORDER, EXPLOSION_TIME, formatTime } from './game/scenario'
import { GameView } from './ui/GameView'
import { pressDir, type Input } from './ui/input'

const STORAGE_KEY = 'nazotoki:save:v3'
const ZOOM_KEY = 'nazotoki:zoom'
const ZOOMS = [1.5, 2, 2.5, 3, 4]

const loadZoom = () => {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY))
    if (ZOOMS.includes(z)) return z
  } catch {
    // 読めなければ既定値
  }
  return 2.5
}

const load = (): GameState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as GameState
  } catch {
    // 保存データが読めないときは最初から
  }
  return initialState()
}

const save = (state: GameState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 保存できない環境でも遊べるようにする
  }
}

/** 直近の出来事を1文字ずつ表示する。クリックで全文 */
function TextBox({ entries }: { entries: LogEntry[] }) {
  const total = entries.reduce((n, e) => n + e.text.length, 0)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setShown((n) => Math.min(total, n + 2)), 30)
    return () => clearInterval(id)
  }, [total])

  const starts = entries.map((_, i) => entries.slice(0, i).reduce((n, e) => n + e.text.length, 0))
  return (
    <div className="textbox" aria-live="polite" onClick={() => setShown(total)}>
      {entries.map((e, i) => {
        const text = e.text.slice(0, Math.max(0, shown - starts[i]))
        return (
          <p key={i} className={`log-${e.kind}`}>
            {text}
            <span className="ghost">{e.text.slice(text.length)}</span>
          </p>
        )
      })}
    </div>
  )
}

function CodePad({
  label,
  time,
  message,
  onSubmit,
  onClose,
  onWait,
}: {
  label: string
  time: string
  message: string
  onSubmit: (code: string) => void
  onClose: () => void
  /** 入力画面を開いたまま待てる（装置の前で） */
  onWait?: () => void
}) {
  const [code, setCode] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== 4) return
    onSubmit(code)
    setCode('')
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <form className="dialog codepad" onSubmit={submit}>
        <p className="big">{label}</p>
        <p className="pad-time">{time}</p>
        <input
          autoFocus
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="0000"
          aria-label="4桁の数字"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
        />
        <p className="pad-message">{message}</p>
        <div className="row">
          <button type="button" onClick={onClose}>
            離れる
          </button>
          {onWait && (
            <button type="button" onClick={onWait}>
              1分待つ
            </button>
          )}
          <button type="submit" className="primary" disabled={code.length !== 4}>
            入力
          </button>
        </div>
      </form>
    </div>
  )
}

/** エンディング。一行ずつ浮かび上がる */
function Ending({
  kind,
  lines,
  question,
  children,
}: {
  kind: 'normal' | 'true'
  lines: string[]
  question?: string
  children: ReactNode
}) {
  const delay = (i: number) => ({ animationDelay: `${0.4 + i * 1.1}s` })
  return (
    <div className={`overlay ending ${kind}`} role="dialog" aria-modal="true">
      <div className="dialog">
        {lines.map((line, i) => (
          <p key={i} className="ending-line" style={delay(i)}>
            {line}
          </p>
        ))}
        {question && (
          <p className="ending-line question" style={delay(lines.length + 0.5)}>
            {question}
          </p>
        )}
        <div className="ending-line ending-foot" style={delay(lines.length + (question ? 2 : 1))}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** 記憶の一覧。広い画面では横に、狭い画面ではボタンから開く */
function Memory({ clues, onRestart }: { clues: GameState['clues']; onRestart: () => void }) {
  return (
    <>
      {clues.length === 0 ? (
        <p className="empty">まだ、何も。</p>
      ) : (
        <ul>
          {CLUE_ORDER.filter((id) => clues.includes(id)).map((id) => (
            <li key={id}>
              <strong>{CLUES[id].title}</strong>
              <span>{CLUES[id].text}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="restart" onClick={onRestart}>
        最初からやり直す
      </button>
    </>
  )
}

const STAGE_CLASS: Record<GameState['status'], string> = {
  playing: '',
  exploded: 'shake',
  normalEnd: 'frozen',
  trueEnd: 'dawn',
}

const DPAD: { dir: Dir; label: string; mark: string }[] = [
  { dir: 'up', label: '上', mark: '▲' },
  { dir: 'left', label: '左', mark: '◀' },
  { dir: 'right', label: '右', mark: '▶' },
  { dir: 'down', label: '下', mark: '▼' },
]

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  const input = useRef<Input>({ held: null, queue: [] })
  const [zoom, setZoom] = useState(loadZoom)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [seenClues, setSeenClues] = useState(state.clues.length)
  const unread = state.clues.length - seenClues

  const changeZoom = (step: number) => {
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(zoom) + step))]
    setZoom(next)
    try {
      localStorage.setItem(ZOOM_KEY, String(next))
    } catch {
      // 保存できなくても拡大はできる
    }
  }
  const openMemory = () => {
    setSeenClues(state.clues.length)
    setMemoryOpen(true)
  }

  useEffect(() => {
    save(state)
  }, [state])

  const playing = state.status === 'playing' && !state.prompt
  const remaining = EXPLOSION_TIME - state.time
  const label = facingLabel(state)
  const seconds = String(state.time % 60).padStart(2, '0')

  const release = () => {
    input.current.held = null
  }

  const restart = () => {
    if (confirm('記憶も含めて、最初からやり直しますか？')) dispatch({ type: 'restart' })
  }

  return (
    <div className="app">
      <header className="hud">
        <div className="title">
          <h1>午後3時の美術館</h1>
          <span className="place">{placeName(state)}</span>
        </div>
        <div className="hud-stats">
          {state.hasKey && <span className="item">鍵</span>}
          {state.hasHand && <span className="item">長針</span>}
          <button className={`memory-button ${unread > 0 ? 'unread' : ''}`} onClick={openMemory}>
            記憶 {state.clues.length}
            {unread > 0 && <span className="badge">+{unread}</span>}
          </button>
          <span className="loop">{state.loop}周目</span>
          <span className={`clock ${remaining <= 120 && state.status !== 'trueEnd' ? 'danger' : ''}`}>
            {formatTime(state.time)}
            <small>:{seconds}</small>
          </span>
        </div>
      </header>

      <main className="layout">
        <section className="scene">
          <div className={`stage ${STAGE_CLASS[state.status]}`}>
            <GameView state={state} dispatch={dispatch} input={input} zoom={zoom} />
            <div className="zoom">
              <button aria-label="縮小" disabled={zoom === ZOOMS[0]} onClick={() => changeZoom(-1)}>
                －
              </button>
              <button aria-label="拡大" disabled={zoom === ZOOMS.at(-1)} onClick={() => changeZoom(1)}>
                ＋
              </button>
            </div>
          </div>

          <TextBox key={`${state.loop}-${state.log.length}`} entries={state.log.slice(state.mark)} />

          <div className="controls">
            <div className="dpad">
              {DPAD.map(({ dir, label: name, mark }) => (
                <button
                  key={dir}
                  className={dir}
                  aria-label={name}
                  disabled={!playing}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    pressDir(input.current, dir)
                  }}
                  onPointerUp={release}
                  onPointerCancel={release}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {mark}
                </button>
              ))}
            </div>
            <div className="side-buttons">
              <button
                className="interact primary"
                disabled={!playing || label === null}
                onClick={() => dispatch({ type: 'interact' })}
              >
                調べる
                <small>{label ?? '　'}</small>
              </button>
              <div className="wait">
                <button disabled={!playing} onClick={() => dispatch({ type: 'wait', minutes: 1 })}>
                  1分待つ
                </button>
                <button disabled={!playing} onClick={() => dispatch({ type: 'wait', minutes: 5 })}>
                  5分待つ
                </button>
              </div>
            </div>
          </div>
          <p className="keys">矢印キー / WASD：歩く　スペース：調べる</p>
        </section>

        <aside className="notebook">
          <h2>記憶</h2>
          <Memory clues={state.clues} onRestart={restart} />
        </aside>
      </main>

      {memoryOpen && (
        <div className="overlay sheet" role="dialog" aria-modal="true" onClick={() => setMemoryOpen(false)}>
          <div className="notebook sheet-body" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>記憶</h2>
              <button onClick={() => setMemoryOpen(false)}>閉じる</button>
            </div>
            <Memory clues={state.clues} onRestart={restart} />
          </div>
        </div>
      )}

      {state.prompt && state.status === 'playing' && (
        <CodePad
          key={state.prompt}
          label={state.prompt === 'vaultDoor' ? '鉄の扉' : '四つの溝'}
          time={`${formatTime(state.time)}:${seconds}`}
          message={state.log.at(-1)?.text ?? ''}
          onSubmit={(code) => dispatch({ type: 'enterCode', target: state.prompt!, code })}
          onClose={() => dispatch({ type: 'closePrompt' })}
          onWait={state.prompt === 'device' ? () => dispatch({ type: 'wait', minutes: 1 }) : undefined}
        />
      )}

      {state.status === 'exploded' && (
        <div className="overlay flash" role="dialog" aria-modal="true">
          <div className="dialog">
            <p className="big">――光。</p>
            <button className="primary" autoFocus onClick={() => dispatch({ type: 'wake' })}>
              目を開ける
            </button>
          </div>
        </div>
      )}

      {state.status === 'normalEnd' && (
        <Ending
          kind="normal"
          lines={[
            '時計の音が、止んだ。',
            '光は、もう来ない。',
            '……大時計の針は、二時五十分のまま。',
            '警備員も、学芸員も、動かない。',
            '三時は、もう来ない。',
          ]}
          question="本当に、この答えでよかったのだろうか。"
        >
          <p className="end-title">NORMAL END</p>
          <p className="end-hint">まだ、刻まれていない時刻がある。</p>
          <div className="row">
            <button onClick={restart}>最初から</button>
            <button className="primary" onClick={() => dispatch({ type: 'continue' })}>
              二時五十分へ
            </button>
          </div>
        </Ending>
      )}

      {state.status === 'trueEnd' && (
        <Ending
          kind="true"
          lines={[
            '長針が、十二を越えた。',
            '――三時五分。光は、来なかった。',
            '閉館の音楽が流れはじめる。',
            '学芸員が、肖像画の前に立っていた。',
            '「祖父がずっと見たかったのは、この先だったのね」',
          ]}
        >
          <p className="end-title">TRUE END</p>
          <p className="end-hint">{state.loop}周目</p>
          <div className="row">
            <button className="primary" onClick={() => dispatch({ type: 'restart' })}>
              最初から
            </button>
          </div>
        </Ending>
      )}
    </div>
  )
}
