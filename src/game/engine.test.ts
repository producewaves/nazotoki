import { describe, expect, it } from 'vitest'
import { canStep, facingLabel, initialState, npcPos, placeName, reducer, type Action, type Dir, type GameState } from './engine'
import { at, LOOP_START, START_POS } from './scenario'

const play = (state: GameState, actions: Action[]) => actions.reduce(reducer, state)
const go = (dir: Dir, n = 1): Action[] => Array.from({ length: n }, () => ({ type: 'step', dir }))
const interact: Action = { type: 'interact' }
const waitUntil = (s: GameState, time: number) =>
  reducer(s, { type: 'wait', minutes: Math.ceil((time - s.time) / 60) })

/** 開始位置（ロビー）からの道順 */
const toCounter = [...go('right'), ...go('up', 2), ...go('left', 2)]
/** 受付の前から収蔵庫の扉まで */
const counterToVault = [...go('up', 9), ...go('right', 4)]
/** 開いた収蔵庫の扉からガラスケースの前まで */
const vaultToDevice = [...go('right', 5), ...go('up', 2)]
const toDesk = [...go('right'), ...go('up', 11), ...go('left', 8), ...go('up')]
const toPortrait = [...go('right'), ...go('up', 3), ...go('left', 8), ...go('up', 5)]

describe('移動', () => {
  it('壁には入れず、向きだけ変わる', () => {
    const s = play(initialState(), go('down', 3))
    expect(s.pos).toEqual(START_POS)
    expect(s.facing).toBe('down')
    expect(s.time).toBe(LOOP_START)
  })

  it('1歩ごとに5秒進み、部屋の切り替えなしで館内を歩ける', () => {
    const s = play(initialState(), toPortrait)
    expect(placeName(s)).toBe('絵画室')
    expect(facingLabel(s)).toBe('肖像画')
    // 最後の1回は肖像画にぶつかって向きが変わるだけ
    expect(s.time).toBe(LOOP_START + 5 * 16)
  })

  it('人はふさがっていて通れない', () => {
    const s = initialState()
    expect(facingLabel(s)).toBe('警備員')
    expect(canStep(s, 'up')).toBe(false)
  })
})

describe('ループ', () => {
  it('15:05に爆発し、目覚めると記憶だけ持って開始位置に戻る', () => {
    let s = reducer(initialState(), interact)
    expect(s.clues).toEqual(expect.arrayContaining(['guardCode', 'curatorBreak']))
    s = reducer(s, { type: 'wait', minutes: 20 })
    expect(s.status).toBe('exploded')
    expect(s.clues).toContain('explosion')

    s = reducer(s, { type: 'wake' })
    expect(s.loop).toBe(2)
    expect(s.time).toBe(LOOP_START)
    expect(s.pos).toEqual(START_POS)
    expect(s.clues).toContain('guardCode')
  })

  it('扉・鍵はループでリセットされる', () => {
    let s = play(initialState(), [...toCounter, ...counterToVault])
    s = reducer(s, { type: 'enterCode', target: 'vaultDoor', code: '1887' })
    expect(s.vaultUnlocked).toBe(true)
    s = play(s, [{ type: 'wait', minutes: 20 }, { type: 'wake' }])
    expect(s.vaultUnlocked).toBe(false)
    expect(s.hasKey).toBe(false)
  })

  it('爆発中は行動できない', () => {
    const s = reducer(initialState(), { type: 'wait', minutes: 20 })
    expect(reducer(s, { type: 'step', dir: 'right' })).toBe(s)
  })
})

describe('人物の予定', () => {
  it('学芸員は15:00〜15:04に席を外し、その間だけ手帳を読める', () => {
    let s = play(initialState(), [...toDesk, interact])
    expect(s.clues).not.toContain('notebook')
    s = waitUntil(s, at(15, 0))
    expect(npcPos('curator', s.time)).toBeNull()
    s = reducer(s, interact)
    expect(s.clues).toContain('notebook')
  })

  it('警備員が見回りに出ている間だけ、受付の鍵を取れる', () => {
    let s = play(initialState(), [...toCounter, interact])
    expect(s.hasKey).toBe(false)
    s = waitUntil(s, at(14, 56))
    expect(placeName({ ...s, pos: npcPos('guard', s.time)! })).toBe('彫刻室')
    s = reducer(s, interact)
    expect(s.hasKey).toBe(true)
  })
})

describe('収蔵庫', () => {
  it('扉は正しい番号でしか開かない', () => {
    let s = play(initialState(), [...toCounter, ...counterToVault])
    expect(s.prompt).toBe('vaultDoor')
    expect(reducer(s, { type: 'step', dir: 'left' })).toBe(s)
    s = reducer(s, { type: 'enterCode', target: 'vaultDoor', code: '0000' })
    expect(s.vaultUnlocked).toBe(false)
    s = reducer(s, { type: 'closePrompt' })
    expect(s.prompt).toBeNull()
  })

  it('鍵がないとケースは開かない', () => {
    let s = play(initialState(), [...toCounter, ...counterToVault])
    s = play(s, [{ type: 'enterCode', target: 'vaultDoor', code: '1887' }, ...vaultToDevice, interact])
    expect(placeName(s)).toBe('収蔵庫')
    expect(s.caseOpen).toBe(false)
    expect(s.prompt).toBeNull()
  })

  it('最短の手順なら1周で脱出できる', () => {
    let s = play(initialState(), toCounter)
    s = waitUntil(s, at(14, 56))
    s = play(s, [interact, ...counterToVault, { type: 'enterCode', target: 'vaultDoor', code: '1887' }])
    s = play(s, [...vaultToDevice, interact])
    expect(s.prompt).toBe('device')
    s = reducer(s, { type: 'enterCode', target: 'device', code: '1450' })
    expect(s.status).toBe('cleared')
  })
})
