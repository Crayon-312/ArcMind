import { describe, expect, it } from 'vitest'
import { createOpenWorkbenchDocument, parseWorkbenchContent, stripWorkbenchMarkup } from '../../src/renderer/src/ui/workbench'

describe('workbench content parser', () => {
  it('extracts report markdown and opens the workbench', () => {
    const document = parseWorkbenchContent(`:::report
# 调研报告

| 项目 | 结论 |
| --- | --- |
| A | 可行 |
:::`)

    expect(document.shouldOpen).toBe(true)
    expect(document.kind).toBe('report')
    expect(document.title).toBe('调研报告')
    expect(document.markdown).toContain('| 项目 | 结论 |')
  })

  it('turns choice blocks into buttons with model-facing values', () => {
    const document = parseWorkbenchContent(`请确认下一步。

:::choices
[fast] 快速原型 | 选择快速原型路线
[careful] 稳妥验证 | 选择稳妥验证路线
:::`)

    expect(document.shouldOpen).toBe(true)
    expect(document.choices).toEqual([
      { id: 'fast', label: '快速原型', value: '选择快速原型路线' },
      { id: 'careful', label: '稳妥验证', value: '选择稳妥验证路线' }
    ])
  })

  it('infers codex-style trailing choices from normal markdown lists', () => {
    const document = parseWorkbenchContent(`下面有两种路线，请选择一个：

1. 快速原型 | 选择快速原型路线
2. 稳妥验证 | 选择稳妥验证路线`)

    expect(document.shouldOpen).toBe(true)
    expect(document.kind).toBe('choices')
    expect(document.markdown).toBe('下面有两种路线，请选择一个：')
    expect(document.choices).toEqual([
      { id: 'choice-1', label: '快速原型', value: '选择快速原型路线' },
      { id: 'choice-2', label: '稳妥验证', value: '选择稳妥验证路线' }
    ])
  })

  it('does not turn ordinary markdown lists into buttons without a choice cue', () => {
    const document = parseWorkbenchContent(`## 下一步

1. 梳理问题
2. 补充测试`)

    expect(document.kind).toBe('long-answer')
    expect(document.choices).toEqual([])
  })

  it('detects long markdown answers even without explicit blocks', () => {
    const document = parseWorkbenchContent('# 方案\n\n- 第一项\n- 第二项')

    expect(document.kind).toBe('long-answer')
    expect(document.shouldOpen).toBe(true)
  })

  it('strips choice markup from assistant text previews', () => {
    expect(
      stripWorkbenchMarkup(`:::report
# 标题
:::

:::choices
[a] A | 选 A
:::`)
    ).toBe('# 标题')
  })

  it('hides incomplete workbench markers while streaming a preview', () => {
    expect(stripWorkbenchMarkup(':::report\n# 流式标题\n\n正文')).toBe('# 流式标题\n\n正文')
    expect(stripWorkbenchMarkup('正文\n\n:::choices\n[a] A | 选 A')).toBe('正文')
  })

  it('can force short replies into an open workbench document', () => {
    const document = createOpenWorkbenchDocument('收到，我来处理。')

    expect(document.shouldOpen).toBe(true)
    expect(document.kind).toBe('long-answer')
    expect(document.title).toBe('回应')
    expect(document.markdown).toBe('收到，我来处理。')
  })
})
