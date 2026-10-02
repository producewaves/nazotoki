import { describe, expect, it } from 'vitest'
import { facingLabel, initialState, reducer, type Action, type Dir, type GameState } from './engine'
import { CURATOR_AWAY_FROM, LOOP_START } from './scenario'

const play = (state: GameState, actions: Action[]) => actions.reduce(reducer, state)
const steps = (dir: Dir, n: number): Action[] => Array.from({ length: n }, () => ({ type: 'step', dir }))

/** ロビーの開始位置から各場所へ歩く道順 */
const toStorageDoor = steps('up', 5)
const toGallery = [...steps('up', 1), ...steps('right', 5)]
const galleryToOffice = steps('right', 9)
const officeToDesk = [...steps('right', 4), ...steps('up', 1)]
const intoStorage = steps('up', 1)
const storageToDevice = steps('up', 3)

describe('移動', () => {
  it('壁には入れず、向きだけ変わる', () => {
    const s = play(initialState(), steps('down', 3))
    expect(s.pos).toEqual(initialState().pos)
    expect(s.facing).toBe('down')
  })

  it('歩くだけでは時間が進まず、部屋を移ると1分進む', () => {
    let s = play(initialState(), steps('up', 1))
    expect(s.time).toBe(LOOP_START)
    s = play(initialState(), toGallery)
    expect(s.room).toBe('gallery')
    expect(s.time).toBe(LOOP_START + 1)
  })

  it('人や物の前では「調べる」対象の名前がわかる', () => {
    const s = play(initialState(), [...steps('up', 1), ...steps('left', 1), ...steps('up', 1)])
    expect(facingLabel(s)).toBe('警備員')
  })
})

describe('ループ', () => {
  it('15:05になると爆発し、目覚めると知識だけ持って14:50のロビーに戻る', () => {
    let s = play(initialState(), [...steps('up', 1), ...steps('left', 1), ...steps('up', 1), { type: 'interact' }])
    expect(s.clues).toContain('guardCode')
    s = play(s, [{ type: 'wait', minutes: 20 }])
    expect(s.status).toBe('exploded')
    expect(s.clues).toContain('explosion')

    s = reducer(s, { type: 'wake' })
    expect(s.loop).toBe(2)
    expect(s.time).toBe(LOOP_START)
    expect(s.room).toBe('lobby')
    expect(s.pos).toEqual(initialState().pos)
    expect(s.clues).toEqual(expect.arrayContaining(['guardCode', 'explosion']))
  })

  it('開けた扉はループでリセットされる', () => {
    let s = play(initialState(), [...toStorageDoor, { type: 'enterCode', target: 'storageDoor', code: '1887' }])
    expect(s.storageUnlocked).toBe(true)
    s = play(s, [{ type: 'wait', minutes: 20 }, { type: 'wake' }])
    expect(s.storageUnlocked).toBe(false)
  })

  it('爆発中は行動できない', () => {
    const s = play(initialState(), [{ type: 'wait', minutes: 20 }])
    expect(reducer(s, { type: 'step', dir: 'up' })).toBe(s)
  })
})

describe('学芸員', () => {
  const toDesk = [...toGallery, ...galleryToOffice, ...officeToDesk]

  it('学芸員がいる間は手帳を読めない', () => {
    const s = play(initialState(), [...toDesk, { type: 'interact' }])
    expect(s.room).toBe('office')
    expect(s.clues).not.toContain('notebook')
  })

  it('15:00に席を外した隙に手帳を読める', () => {
    let s = play(initialState(), toDesk)
    s = reducer(s, { type: 'wait', minutes: CURATOR_AWAY_FROM - s.time })
    s = reducer(s, { type: 'interact' })
    expect(s.clues).toContain('notebook')
    expect(s.status).toBe('playing')
  })
})

describe('暗証番号', () => {
  it('鍵のかかった扉に触れると入力画面が開き、間違った番号では開かない', () => {
    let s = play(initialState(), toStorageDoor)
    expect(s.room).toBe('lobby')
    expect(s.prompt).toBe('storageDoor')
    s = reducer(s, { type: 'enterCode', target: 'storageDoor', code: '0000' })
    expect(s.storageUnlocked).toBe(false)
    s = reducer(s, { type: 'closePrompt' })
    expect(s.prompt).toBeNull()
  })

  it('入力画面を開いている間は歩けない', () => {
    const s = play(initialState(), toStorageDoor)
    expect(reducer(s, { type: 'step', dir: 'down' })).toBe(s)
  })

  it('正しい手順で装置を止めるとクリアになる', () => {
    let s = play(initialState(), [
      ...toStorageDoor,
      { type: 'enterCode', target: 'storageDoor', code: '1887' },
      ...intoStorage,
    ])
    expect(s.room).toBe('storage')
    s = play(s, [...storageToDevice, { type: 'interact' }])
    expect(s.prompt).toBe('device')
    s = reducer(s, { type: 'enterCode', target: 'device', code: '1450' })
    expect(s.status).toBe('cleared')
  })
})
