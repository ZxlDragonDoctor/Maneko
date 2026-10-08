import assert from 'node:assert/strict'
import test from 'node:test'
import { progressForChapter } from '../src/utils/readingProgress.js'

const chapters = [
  { id: 'one', chapter_number: 1 },
  { id: 'two', chapter_number: 2 },
  { id: 'three', chapter_number: 3 },
  { id: 'four', chapter_number: 4 },
]

test('reading progress follows the selected chapter rather than a fixed placeholder', () => {
  assert.equal(progressForChapter(chapters[0], chapters), 0.25)
  assert.equal(progressForChapter(chapters[2], chapters), 0.75)
  assert.equal(progressForChapter(chapters[3], chapters), 1)
})

test('reading progress safely handles missing chapters', () => {
  assert.equal(progressForChapter(null, chapters), 0)
  assert.equal(progressForChapter(chapters[0], []), 0)
  assert.equal(progressForChapter({ id: 'missing' }, chapters), 0)
})
