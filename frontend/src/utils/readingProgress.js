export function progressForChapter(chapter, chapters = []) {
  if (!chapter || !chapters.length) return 0
  const index = chapters.findIndex((item) => item.id === chapter.id)
  return index < 0 ? 0 : (index + 1) / chapters.length
}
