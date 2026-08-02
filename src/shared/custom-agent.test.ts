import { describe, expect, it } from 'vitest'
import {
  createCustomAgentId,
  isCustomAgentId,
  normalizeAgentIds,
  normalizeCustomAgents
} from './custom-agent'

describe('custom agent process name', () => {
  const base = {
    id: 'custom:forge',
    name: 'Forge',
    command: 'npx forge --tui',
    icon: { kind: 'terminal' as const },
    enabled: true
  }

  it('keeps a trimmed process name', () => {
    expect(normalizeCustomAgents([{ ...base, processName: '  forge  ' }])[0]?.processName).toBe(
      'forge'
    )
  })

  it('omits the field when the process name is blank or not a string', () => {
    expect(normalizeCustomAgents([{ ...base, processName: '   ' }])[0]).not.toHaveProperty(
      'processName'
    )
    expect(normalizeCustomAgents([{ ...base, processName: 42 }])[0]).not.toHaveProperty(
      'processName'
    )
  })
})

describe('custom agents', () => {
  it('creates stable readable ids without collisions', () => {
    expect(createCustomAgentId('My Agent')).toBe('custom:my-agent')
    expect(createCustomAgentId('My Agent', ['custom:my-agent'])).toBe('custom:my-agent-2')
  })

  it('normalizes valid definitions and drops malformed entries', () => {
    expect(
      normalizeCustomAgents([
        {
          id: 'custom:forge',
          name: ' Forge ',
          command: 'forge --tui',
          promptMode: 'template',
          promptTemplate: 'forge --prompt {prompt}',
          icon: { kind: 'terminal' },
          enabled: true
        },
        { id: 'custom:broken', name: '', command: 'x' }
      ])
    ).toEqual([
      {
        id: 'custom:forge',
        name: 'Forge',
        command: 'forge --tui',
        promptMode: 'template',
        promptTemplate: 'forge --prompt {prompt}',
        icon: { kind: 'terminal' },
        enabled: true
      }
    ])
  })

  it('accepts native and custom ids while filtering unknown values', () => {
    expect(isCustomAgentId('custom:forge')).toBe(true)
    expect(normalizeAgentIds(['codex', 'custom:forge', 'custom:forge', 'unknown', null])).toEqual([
      'codex',
      'custom:forge'
    ])
  })
})
