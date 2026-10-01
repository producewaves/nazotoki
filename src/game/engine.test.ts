import { describe, expect, it } from 'vitest'
import { initialState, reducer, type Action, type GameState } from './engine'
import { CURATOR_AWAY_FROM, EXPLOSION_TIME, LOOP_START } from './scenario'

const play = (state: GameState, actions: Action[]) => actions.reduce(reducer, state)

describe('ループ', () => {
  it('15:05になると爆発し、目覚めると知識だけ持って14:50に戻る', () => {
    let s = play(initialState(), [{ type: 'talk', npc: 'guard' }])
    s = play(s, [{ type: 'wait', minutes: 20 }])
    expect(s.status).toBe('exploded')
    expect(s.clues).toContain('explosion')

    s = reducer(s, { type: 'wake' })
    expect(s.loop).toBe(2)
    expect(s.time).toBe(LOOP_START)
    expect(s.room).toBe('lobby')
    expect(s.clues).toEqual(expect.arrayContaining(['guardCode', 'explosion']))
  })

  it('開けた扉はループでリセットされる', () => {
    let s = play(initialState(), [{ type: 'enterCode', target: 'storageDoor', code: '1887' }])
    expect(s.storageUnlocked).toBe(true)
    s = play(s, [{ type: 'wait', minutes: 20 }, { type: 'wake' }])
    expect(s.storageUnlocked).toBe(false)
  })

  it('爆発中は行動できない', () => {
    const s = play(initialState(), [{ type: 'wait', minutes: 20 }])
    expect(reducer(s, { type: 'move', to: 'gallery' })).toBe(s)
  })
})

describe('学芸員', () => {
  it('学芸員がいる間は手帳を読めない', () => {
    const s = play(initialState(), [
      { type: 'move', to: 'gallery' },
      { type: 'move', to: 'office' },
      { type: 'examine', target: 'desk' },
    ])
    expect(s.clues).not.toContain('notebook')
  })

  it('15:00に席を外した隙に手帳を読める', () => {
    let s = play(initialState(), [
      { type: 'move', to: 'gallery' },
      { type: 'move', to: 'office' },
    ])
    s = reducer(s, { type: 'wait', minutes: CURATOR_AWAY_FROM - s.time })
    s = reducer(s, { type: 'examine', target: 'desk' })
    expect(s.clues).toContain('notebook')
    expect(s.time).toBeLessThan(EXPLOSION_TIME)
  })
})

describe('クリア', () => {
  it('間違った番号では倉庫は開かない', () => {
    const s = play(initialState(), [{ type: 'enterCode', target: 'storageDoor', code: '0000' }])
    expect(s.storageUnlocked).toBe(false)
    expect(reducer(s, { type: 'move', to: 'storage' })).toBe(s)
  })

  it('正しい手順で装置を止めるとクリアになる', () => {
    const s = play(initialState(), [
      { type: 'enterCode', target: 'storageDoor', code: '1887' },
      { type: 'move', to: 'storage' },
      { type: 'examine', target: 'device' },
      { type: 'enterCode', target: 'device', code: '1450' },
    ])
    expect(s.status).toBe('cleared')
  })
})
