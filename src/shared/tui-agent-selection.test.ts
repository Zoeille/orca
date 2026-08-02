import { describe, expect, it } from 'vitest'
import {
  haveSameDisabledTuiAgents,
  isAgentEnabled,
  normalizeDisabledTuiAgents,
  pickTuiAgent
} from './tui-agent-selection'
import type { CustomAgentDefinition } from './custom-agent'

const forge: CustomAgentDefinition = {
  id: 'custom:forge',
  name: 'Forge',
  command: 'forge --tui',
  promptMode: 'pty',
  icon: { kind: 'terminal' },
  enabled: true
}

describe('isAgentEnabled', () => {
  it('gates a built-in agent on the disabled list', () => {
    expect(isAgentEnabled('codex', { disabledTuiAgents: ['claude'] })).toBe(true)
    expect(isAgentEnabled('codex', { disabledTuiAgents: ['codex'] })).toBe(false)
  })

  it('gates a custom agent on its own enabled flag', () => {
    expect(isAgentEnabled('custom:forge', { customAgents: [forge] })).toBe(true)
    expect(isAgentEnabled('custom:forge', { customAgents: [{ ...forge, enabled: false }] })).toBe(
      false
    )
  })

  it('reports a deleted custom agent as disabled rather than defaulting to enabled', () => {
    expect(isAgentEnabled('custom:forge', { customAgents: [] })).toBe(false)
    expect(isAgentEnabled('custom:forge', {})).toBe(false)
  })

  it('ignores the built-in disabled list for custom ids', () => {
    expect(
      isAgentEnabled('custom:forge', { disabledTuiAgents: ['custom:forge'], customAgents: [forge] })
    ).toBe(true)
  })
})

describe('pickTuiAgent', () => {
  it('uses an installed preferred agent', () => {
    expect(pickTuiAgent('codex', ['claude', 'codex'])).toBe('codex')
  })

  it('falls back in desktop catalog order when the preference is absent or stale', () => {
    expect(pickTuiAgent(null, ['cursor', 'codex'])).toBe('codex')
    expect(pickTuiAgent('gemini', ['cursor', 'codex'])).toBe('codex')
    expect(pickTuiAgent(null, ['continue', 'command-code'])).toBe('command-code')
  })

  it('respects the explicit blank terminal preference', () => {
    expect(pickTuiAgent('blank', ['cursor', 'claude'])).toBeNull()
  })

  it('ignores disabled preferred and fallback agents', () => {
    expect(pickTuiAgent('codex', ['claude', 'codex'], ['codex'])).toBe('claude')
    expect(pickTuiAgent(null, ['claude', 'codex'], ['claude', 'codex'])).toBeNull()
  })
})

describe('normalizeDisabledTuiAgents', () => {
  it('dedupes supported agent ids and drops unsupported values', () => {
    expect(normalizeDisabledTuiAgents(['codex', 'unknown', 'codex', null, 'claude'])).toEqual([
      'codex',
      'claude'
    ])
  })
})

describe('haveSameDisabledTuiAgents', () => {
  it('compares the normalized disabled-agent sets', () => {
    expect(haveSameDisabledTuiAgents(['codex', 'claude'], ['claude', 'codex'])).toBe(true)
    expect(haveSameDisabledTuiAgents(['codex', 'unknown'], ['codex'])).toBe(true)
    expect(haveSameDisabledTuiAgents(['codex'], ['claude'])).toBe(false)
  })
})
