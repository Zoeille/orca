import { describe, expect, it } from 'vitest'
import { buildAgentStartupPlan } from './tui-agent-startup'
import type { CustomAgentDefinition } from './custom-agent'

const agent: CustomAgentDefinition = {
  id: 'custom:forge',
  name: 'Forge',
  command: 'forge --tui',
  promptMode: 'template',
  promptTemplate: 'forge --prompt {prompt}',
  icon: { kind: 'terminal' },
  enabled: true
}

describe('custom agent expected process', () => {
  const launcherAgent: CustomAgentDefinition = {
    ...agent,
    promptMode: 'pty',
    command: 'doppler run -- forge --tui'
  }

  it('derives the process from the first command token when none is declared', () => {
    const plan = buildAgentStartupPlan({
      agent: launcherAgent.id,
      customAgent: launcherAgent,
      prompt: 'inspect',
      cmdOverrides: {},
      platform: 'linux'
    })
    expect(plan?.expectedProcess).toBe('doppler')
  })

  it('prefers the declared process name over the launcher token', () => {
    const plan = buildAgentStartupPlan({
      agent: launcherAgent.id,
      customAgent: { ...launcherAgent, processName: 'forge' },
      prompt: 'inspect',
      cmdOverrides: {},
      platform: 'linux'
    })
    expect(plan?.expectedProcess).toBe('forge')
  })
})

describe('custom agent startup', () => {
  it('substitutes a safely quoted prompt in a template', () => {
    const plan = buildAgentStartupPlan({
      agent: agent.id,
      customAgent: agent,
      prompt: 'fix “the bug” && test',
      cmdOverrides: {},
      platform: 'linux'
    })
    expect(plan?.launchCommand).toContain('forge --prompt')
    expect(plan?.launchCommand).not.toBe('forge --prompt fix “the bug” && test')
  })

  it('uses the PTY follow-up path for a custom interactive command', () => {
    const plan = buildAgentStartupPlan({
      agent: { ...agent, promptMode: 'pty' }.id,
      customAgents: [{ ...agent, promptMode: 'pty' }],
      prompt: 'inspect this repository',
      cmdOverrides: {},
      platform: 'linux'
    })
    expect(plan?.launchCommand).toBe('forge --tui')
    expect(plan?.followupPrompt).toBe('inspect this repository')
  })
})
