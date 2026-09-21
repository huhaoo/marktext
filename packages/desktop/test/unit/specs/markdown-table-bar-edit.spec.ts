import { describe, it, expect, vi } from 'vitest'
import ContentState from 'muya/lib/contentState'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = Record<string, any>

// Create a bare content state with only the plain block-tree APIs. We don't
// need a real muya instance because the table edit logic under test only
// operates on the block tree.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createContentState = (): Record<string, any> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs: any = Object.create(ContentState.prototype)
  cs.muya = {
    container: document.createElement('div'),
    dispatchChange: vi.fn(),
    dispatchSelectionChange: vi.fn(),
    dispatchSelectionFormats: vi.fn(),
    eventCenter: {
      dispatch: vi.fn()
    },
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

// Build a document with a 3x3 table (header + two body rows) followed by a
// paragraph, and place the cursor in that paragraph — i.e. outside the table,
// like when the table bar tools are used while the cursor left the table.
const buildDocument = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cs: Record<string, any>
): { figure: Block; paragraph: Block } => {
  const contents = [
    ['h1', 'h2', 'h3'],
    ['r1c1', 'r1c2', 'r1c3'],
    ['r2c1', 'r2c2', 'r2c3']
  ].map((row) => row.map((text) => ({ text, align: '' })))
  const table = cs.createTableInFigure({ rows: 3, columns: 3 }, contents)
  const figure = cs.createBlock('figure', { functionType: 'table' })
  cs.appendChild(figure, table)
  const paragraph = cs.createBlockP('after the table')
  cs.blocks = [figure]
  cs.insertAfter(paragraph, figure)

  cs.cursor = {
    start: { key: paragraph.children[0].key, offset: 0 },
    end: { key: paragraph.children[0].key, offset: 0 },
    isEdit: false
  }
  return { figure, paragraph }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTableRows = (cs: Record<string, any>): Block[] => {
  const table = cs.blocks[0].children[0]
  return [...table.children[0].children, ...(table.children[1] ? table.children[1].children : [])]
}

const getCellContent = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cs: Record<string, any>,
  rowIndex: number,
  columnIndex: number
): Block => {
  return getTableRows(cs)[rowIndex].children[columnIndex].children[0]
}

const getRowTexts = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cs: Record<string, any>,
  rowIndex: number
): string[] => {
  return getTableRows(cs)[rowIndex].children.map((cell: Block) => cell.children[0].text)
}

describe('ContentState.editTable with a cellContentKey anchor', () => {
  it('inserts a row below the anchored row while the cursor is outside the table', () => {
    const cs = createContentState()
    buildDocument(cs)
    const anchor = getCellContent(cs, 1, 0) // first body row

    cs.editTable({ location: 'next', action: 'insert', target: 'row' }, anchor.key)

    // 3 rows -> 4 rows, the new empty row sits below the anchored row.
    expect(getTableRows(cs)).toHaveLength(4)
    expect(getRowTexts(cs, 0)).toEqual(['h1', 'h2', 'h3'])
    expect(getRowTexts(cs, 1)).toEqual(['r1c1', 'r1c2', 'r1c3'])
    expect(getRowTexts(cs, 2)).toEqual(['', '', ''])
    expect(getRowTexts(cs, 3)).toEqual(['r2c1', 'r2c2', 'r2c3'])

    // The cursor is moved into the new row, not left in the paragraph.
    expect(cs.cursor.start.key).toBe(getCellContent(cs, 2, 0).key)
    expect(cs.partialRender).toHaveBeenCalled()
  })

  it('inserts a row above the anchored header row and demotes it to the body', () => {
    const cs = createContentState()
    buildDocument(cs)
    const anchor = getCellContent(cs, 0, 0) // header row

    cs.editTable({ location: 'previous', action: 'insert', target: 'row' }, anchor.key)

    expect(getTableRows(cs)).toHaveLength(4)
    expect(getRowTexts(cs, 0)).toEqual(['', '', ''])
    expect(getTableRows(cs)[0].children[0].type).toBe('th')
    // The old header row became the first body row.
    expect(getRowTexts(cs, 1)).toEqual(['h1', 'h2', 'h3'])
    expect(getTableRows(cs)[1].children[0].type).toBe('td')
  })

  it('inserts a column right of the anchored cell in all rows', () => {
    const cs = createContentState()
    buildDocument(cs)
    const anchor = getCellContent(cs, 2, 1)

    cs.editTable({ location: 'right', action: 'insert', target: 'column' }, anchor.key)

    for (const row of getTableRows(cs)) {
      expect(row.children).toHaveLength(4)
    }
    expect(getRowTexts(cs, 0)).toEqual(['h1', 'h2', '', 'h3'])
    expect(getRowTexts(cs, 2)).toEqual(['r2c1', 'r2c2', '', 'r2c3'])

    expect(cs.cursor.start.key).toBe(getCellContent(cs, 2, 2).key)
  })

  it('removes the column of the anchored cell', () => {
    const cs = createContentState()
    buildDocument(cs)
    const anchor = getCellContent(cs, 1, 2) // last column

    cs.editTable({ location: 'current', action: 'remove', target: 'column' }, anchor.key)

    for (const row of getTableRows(cs)) {
      expect(row.children).toHaveLength(2)
    }
    expect(getRowTexts(cs, 1)).toEqual(['r1c1', 'r1c2'])

    // The removed column contained the anchor, so the cursor moves to the
    // previous cell content.
    expect(cs.cursor.start.key).toBe(getCellContent(cs, 1, 1).key)
  })

  it('removes the row of the anchored cell', () => {
    const cs = createContentState()
    buildDocument(cs)
    const anchor = getCellContent(cs, 1, 0) // first body row

    cs.editTable({ location: 'current', action: 'remove', target: 'row' }, anchor.key)

    expect(getTableRows(cs)).toHaveLength(2)
    expect(getRowTexts(cs, 0)).toEqual(['h1', 'h2', 'h3'])
    expect(getRowTexts(cs, 1)).toEqual(['r2c1', 'r2c2', 'r2c3'])

    expect(cs.cursor.start.key).toBe(getCellContent(cs, 1, 0).key)
  })
})
