import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react'
import { facingLabel, initialState, placeName, reducer, type Dir, type GameState, type LogEntry } from './game/engine'
import { CLUES, CLUE_ORDER, EXPLOSION_TIME, formatTime } from './game/scenario'
import { GameView } from './ui/GameView'
import { pressDir, type Input } from './ui/input'

const STORAGE_KEY = 'nazotoki:save:v3'

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
  onSubmit,
  onClose,
}: {
  label: string
  onSubmit: (code: string) => void
  onClose: () => void
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
        <div className="row">
          <button type="button" onClick={onClose}>
            離れる
          </button>
          <button type="submit" className="primary" disabled={code.length !== 4}>
            入力
          </button>
        </div>
      </form>
    </div>
  )
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
          {state.hasKey && (
            <span className="item" title="小さな真鍮の鍵">
              🗝️
            </span>
          )}
          <span className="loop">{state.loop}周目</span>
          <span className={`clock ${remaining <= 120 ? 'danger' : ''}`}>
            {formatTime(state.time)}
            <small>:{seconds}</small>
          </span>
        </div>
      </header>

      <main className="layout">
        <section className="scene">
          <div className={`stage ${state.status === 'exploded' ? 'shake' : ''}`}>
            <GameView state={state} dispatch={dispatch} input={input} />
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
          {state.clues.length === 0 ? (
            <p className="empty">まだ、何も。</p>
          ) : (
            <ul>
              {CLUE_ORDER.filter((id) => state.clues.includes(id)).map((id) => (
                <li key={id}>
                  <strong>{CLUES[id].title}</strong>
                  <span>{CLUES[id].text}</span>
                </li>
              ))}
            </ul>
          )}
          <button className="restart" onClick={restart}>
            最初からやり直す
          </button>
        </aside>
      </main>

      {state.prompt && state.status === 'playing' && (
        <CodePad
          key={state.prompt}
          label={state.prompt === 'vaultDoor' ? '鉄の扉' : '四つの溝'}
          onSubmit={(code) => dispatch({ type: 'enterCode', target: state.prompt!, code })}
          onClose={() => dispatch({ type: 'closePrompt' })}
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

      {state.status === 'cleared' && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="dialog">
            <p className="big">時計の音が、止んだ。</p>
            <p>
              {state.loop}周目　{formatTime(state.time)}
            </p>
            <button className="primary" autoFocus onClick={() => dispatch({ type: 'restart' })}>
              もう一度
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
