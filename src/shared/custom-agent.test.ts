import { describe, expect, it } from 'vitest'
import {
  createCustomAgentId,
  isCustomAgentId,
  normalizeAgentIds,
  normalizeCustomAgents
} from './custom-agent'

describe('custom agent prompt template quoting', () => {
  const templateBase = {
    id: 'custom:forge' as const,
    name: 'Forge',
    command: 'forge',
    icon: { kind: 'terminal' as const },
    enabled: true,
    promptMode: 'template' as const
  }
  const keptTemplate = (promptTemplate: string): string | undefined =>
    normalizeCustomAgents([{ ...templateBase, promptTemplate }])[0]?.promptTemplate

  it('keeps a placeholder that stands as its own shell word', () => {
    expect(keptTemplate('forge --prompt {prompt}')).toBe('forge --prompt {prompt}')
    expect(keptTemplate('forge --prompt={prompt}')).toBe('forge --prompt={prompt}')
  })

  it('drops a placeholder nested inside quotes, which would defeat the escaping', () => {
    expect(keptTemplate('forge --prompt "{prompt}"')).toBeUndefined()
    expect(keptTemplate("forge --prompt '{prompt}'")).toBeUndefined()
    expect(keptTemplate('forge --prompt `{prompt}`')).toBeUndefined()
  })

  // Why: normalized settings are rewritten to disk, so rejecting the agent would
  // delete a definition the user still owns. Fall back to the safe delivery mode.
  it('keeps the agent and falls back to pty delivery when the template is unsafe', () => {
    const [normalized] = normalizeCustomAgents([
      { ...templateBase, promptTemplate: 'forge --prompt "{prompt}"' }
    ])

    expect(normalized?.id).toBe('custom:forge')
    expect(normalized?.command).toBe('forge')
    expect(normalized?.promptMode).toBe('pty')
  })
})

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
