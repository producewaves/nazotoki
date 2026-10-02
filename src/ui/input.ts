import type { Dir } from '../game/engine'

/** 押されている方向キー。十字ボタンとキーボードの両方から書き込む */
export interface Input {
  held: Dir | null
  /** 押した瞬間の1歩（短く押しても必ず1歩・向きを変える）。連打は2歩まで先に受け付ける */
  queue: Dir[]
}

export const pressDir = (input: Input, dir: Dir) => {
  if (input.queue.length < 2) input.queue.push(dir)
  input.held = dir
}
