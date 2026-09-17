import { describe, it, expect, vi } from 'vitest'
import ContentState from 'muya/lib/contentState'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = Record<string, any>

// Create a bare content state with only the plain block-tree APIs. We don't
// need a real muya instance because the paste logic under test only operates
// on the block tree.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createContentState = (): Record<string, any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs: any = Object.create(ContentState.prototype)
  cs.muya = {
    container: document.createElement('div'),
    dispatchChange: vi.fn(),
    dispatchSelectionChange: vi.fn(),
    dispatchSelectionFormats: vi.fn(),
    options: {
      footnote: false,
      isGitlabCompatibilityEnabled: false,
      superSubScript: false,
      trimUnnecessaryCodeBlockEmptyLines: true
    }
  }
  cs.blocks = []
  cs.currentCursor = null
  cs.prevCursor = null
  cs.historyTimer = null
  cs.history = { push: vi.fn(), pushPending: vi.fn(), commitPending: vi.fn() }
  cs.cursor = { start: { key: '', offset: 0 }, end: { key: '', offset: 0 } }
  cs._selectedTableCells = null
  cs.partialRender = vi.fn()
  return cs
}

const buildTable = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cs: Record<string, any>,
  rows: number,
  columns: number,
  contents?: string[][]
): Block => {
  const tableContents = contents?.map((row) => row.map((text) => ({ text, align: '' })))
  const table = cs.createTableInFigure({ rows, columns }, tableContents)
  const figure = cs.createBlock('figure', { functionType: 'table' })
  cs.appendChild(figure, table)
  cs.blocks = [figure]
  return figure
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTableRowBlocks = (cs: Record<string, any>): Block[] => {
  const table = cs.blocks[0].children[0]
  return [
    ...table.children[0].children,
    ...(table.children[1] ? table.children[1].children : [])
  ]
}

const getCellText = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cs: Record<string, any>,
  rowIndex: number,
  columnIndex: number
): string => {
  const rows = getTableRowBlocks(cs)
  return rows[rowIndex].children[columnIndex].children[0].text
}

// The cell content block of a cell used as paste anchor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCellContentBlock = (cs: Record<string, any>, rowIndex: number, columnIndex: number): Block => {
  const rows = getTableRowBlocks(cs)
  return rows[rowIndex].children[columnIndex].children[0]
}

describe('ContentState.getMarkdownTableMatrix', () => {
  it('extracts the cell matrix of a markdown table', () => {
    const cs = createContentState()
    const matrix = cs.getMarkdownTableMatrix('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
    expect(matrix).toEqual([
      ['a', 'b'],
      ['1', '2']
    ])
  })

  it('returns null for non-table text', () => {
    const cs = createContentState()
    expect(cs.getMarkdownTableMatrix('hello world')).toBeNull()
    expect(cs.getMarkdownTableMatrix('a | b')).toBeNull()
    expect(cs.getMarkdownTableMatrix('')).toBeNull()
  })

  it('returns null when the table is mixed with other blocks', () => {
    const cs = createContentState()
    const text = '| a | b |\n| --- | --- |\n| 1 | 2 |\n\nsome paragraph'
    expect(cs.getMarkdownTableMatrix(text)).toBeNull()
  })
})

describe('ContentState.pasteMarkdownTableAsCells', () => {
  it('fills cells from the anchor cell keeping the copied shape', () => {
    const cs = createContentState()
    buildTable(cs, 3, 3, [
      ['h1', 'h2', 'h3'],
      ['r1c1', 'r1c2', 'r1c3'],
      ['r2c1', 'r2c2', 'r2c3']
    ])
    const anchor = getCellContentBlock(cs, 1, 1)
    const markdown = '| A | B |\n| --- | --- |\n| C | D |'

    expect(cs.pasteMarkdownTableAsCells(markdown, anchor)).toBe(true)

    expect(getCellText(cs, 1, 1)).toBe('A')
    expect(getCellText(cs, 1, 2)).toBe('B')
    expect(getCellText(cs, 2, 1)).toBe('C')
    expect(getCellText(cs, 2, 2)).toBe('D')
    // Cells outside the pasted rectangle are untouched.
    expect(getCellText(cs, 0, 0)).toBe('h1')
    expect(getCellText(cs, 0, 2)).toBe('h3')
    expect(getCellText(cs, 1, 0)).toBe('r1c1')
    expect(getCellText(cs, 2, 0)).toBe('r2c1')

    // Cursor is placed at the end of the last filled cell.
    expect(cs.cursor.start.key).toBe(getCellContentBlock(cs, 2, 2).key)
    expect(cs.cursor.start.offset).toBe(1)
    expect(cs.partialRender).toHaveBeenCalled()
    expect(cs.muya.dispatchChange).toHaveBeenCalled()
  })

  it('discards rows and columns that do not fit into the target table', () => {
    const cs = createContentState()
    buildTable(cs, 2, 2, [
      ['h1', 'h2'],
      ['r1c1', 'r1c2']
    ])
    const anchor = getCellContentBlock(cs, 0, 1)
    const markdown = '| A | B | C |\n| --- | --- | --- |\n| D | E | F |\n| G | H | I |'

    expect(cs.pasteMarkdownTableAsCells(markdown, anchor)).toBe(true)

    // Only one column fits right of the anchor and only two rows exist,
    // everything else is discarded.
    expect(getCellText(cs, 0, 1)).toBe('A')
    expect(getCellText(cs, 1, 1)).toBe('D')
    // Cells outside the pasted rectangle are untouched.
    expect(getCellText(cs, 0, 0)).toBe('h1')
    expect(getCellText(cs, 1, 0)).toBe('r1c1')

    // Cursor is placed at the end of the last filled cell.
    expect(cs.cursor.start.key).toBe(getCellContentBlock(cs, 1, 1).key)
  })

  it('keeps inline markdown syntax as raw cell text', () => {
    const cs = createContentState()
    buildTable(cs, 2, 2, [
      ['h1', 'h2'],
      ['r1c1', 'r1c2']
    ])
    const anchor = getCellContentBlock(cs, 0, 0)
    const markdown = '| **bold** |\n| --- |\n| `code` |'

    expect(cs.pasteMarkdownTableAsCells(markdown, anchor)).toBe(true)
    expect(getCellText(cs, 0, 0)).toBe('**bold**')
    expect(getCellText(cs, 1, 0)).toBe('`code`')
  })

  it('returns false for non-table text without touching cells', () => {
    const cs = createContentState()
    buildTable(cs, 2, 2, [
      ['h1', 'h2'],
      ['r1c1', 'r1c2']
    ])
    const anchor = getCellContentBlock(cs, 0, 0)

    expect(cs.pasteMarkdownTableAsCells('plain text', anchor)).toBe(false)
    expect(getCellText(cs, 0, 0)).toBe('h1')
    expect(cs.partialRender).not.toHaveBeenCalled()
  })

  it('accepts a th/td block as anchor (cell selection case)', () => {
    const cs = createContentState()
    buildTable(cs, 2, 2, [
      ['h1', 'h2'],
      ['r1c1', 'r1c2']
    ])
    // Pass the th/td block, not the cell content span.
    const cellBlock = getTableRowBlocks(cs)[0].children[1]

    expect(cs.pasteMarkdownTableAsCells('| A |\n| --- |\n| B |', cellBlock)).toBe(true)
    expect(getCellText(cs, 0, 1)).toBe('A')
    expect(getCellText(cs, 1, 1)).toBe('B')
  })

  it('deselects cells on paste', () => {
    const cs = createContentState()
    buildTable(cs, 2, 2, [
      ['h1', 'h2'],
      ['r1c1', 'r1c2']
    ])
    cs._selectedTableCells = { tableId: 'x', row: 1, column: 1, cells: [] }
    const anchor = getCellContentBlock(cs, 0, 0)

    expect(cs.pasteMarkdownTableAsCells('| A |\n| --- |\n| B |', anchor)).toBe(true)
    expect(cs.selectedTableCells).toBeNull()
  })
})
