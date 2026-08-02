import type { TuiAgent } from './types'
import { isTuiAgent } from './tui-agent-config'

export type CustomAgentId = `custom:${string}`
export type AgentId = TuiAgent | CustomAgentId

/** Stable empty default so store selectors don't return a fresh array per read. */
export const EMPTY_CUSTOM_AGENTS: readonly CustomAgentDefinition[] = []

export type CustomAgentPromptMode = 'pty' | 'argv' | 'template'

export type CustomAgentIcon =
  | { kind: 'terminal' }
  | { kind: 'letter'; value: string }
  | { kind: 'image'; dataUrl: string; fileName: string }

export type CustomAgentDefinition = {
  id: CustomAgentId
  name: string
  command: string
  /** Process to watch when `command` is a launcher (`npx …`, `doppler run -- …`). */
  processName?: string
  promptMode: CustomAgentPromptMode
  promptTemplate?: string
  icon: CustomAgentIcon
  enabled: boolean
}

export const CUSTOM_AGENT_PROMPT_PLACEHOLDER = '{prompt}'
const TEMPLATE_QUOTE_CHARS = new Set(['"', "'", '`'])
const CUSTOM_AGENT_ID_PATTERN = /^custom:[a-z0-9][a-z0-9-]{0,63}$/
const MAX_CUSTOM_AGENT_NAME_LENGTH = 80
const MAX_CUSTOM_AGENT_COMMAND_LENGTH = 2000
const MAX_CUSTOM_AGENT_TEMPLATE_LENGTH = 4000
const MAX_CUSTOM_AGENT_PROCESS_NAME_LENGTH = 120
const MAX_CUSTOM_AGENT_IMAGE_DATA_URL_LENGTH = 350_000

export function isCustomAgentId(value: unknown): value is CustomAgentId {
  return typeof value === 'string' && CUSTOM_AGENT_ID_PATTERN.test(value)
}

export function isAgentId(value: unknown): value is AgentId {
  return isTuiAgent(value) || isCustomAgentId(value)
}

export function normalizeAgentIds(value: unknown): AgentId[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const result: AgentId[] = []
  for (const item of value) {
    if (isAgentId(item) && !seen.has(item)) {
      seen.add(item)
      result.push(item)
    }
  }
  return result
}

export function createCustomAgentId(name: string, existing: Iterable<string> = []): CustomAgentId {
  const stem =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'agent'
  const used = new Set(existing)
  let candidate = `custom:${stem}`
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `custom:${stem}-${suffix++}`
  }
  return candidate as CustomAgentId
}

/**
 * The substituted prompt is already a self-delimiting shell word, so nesting the
 * placeholder in another quote re-opens expansion (`"'$(id)'"` runs `id`).
 */
export function isCustomAgentPromptTemplateSafe(template: string): boolean {
  let quote: string | null = null
  for (let index = 0; index < template.length; index += 1) {
    if (template.startsWith(CUSTOM_AGENT_PROMPT_PLACEHOLDER, index)) {
      if (quote) {
        return false
      }
      index += CUSTOM_AGENT_PROMPT_PLACEHOLDER.length - 1
      continue
    }
    const char = template[index]
    if (quote) {
      if (char === quote) {
        quote = null
      }
    } else if (TEMPLATE_QUOTE_CHARS.has(char)) {
      quote = char
    }
  }
  return template.includes(CUSTOM_AGENT_PROMPT_PLACEHOLDER)
}

export function normalizeCustomAgents(value: unknown): CustomAgentDefinition[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  const normalized: CustomAgentDefinition[] = []
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }
    const item = candidate as Partial<CustomAgentDefinition>
    if (!isCustomAgentId(item.id) || seen.has(item.id)) {
      continue
    }
    const name =
      typeof item.name === 'string' ? item.name.trim().slice(0, MAX_CUSTOM_AGENT_NAME_LENGTH) : ''
    const command =
      typeof item.command === 'string'
        ? item.command.trim().slice(0, MAX_CUSTOM_AGENT_COMMAND_LENGTH)
        : ''
    if (!name || !command) {
      continue
    }
    const processName =
      typeof item.processName === 'string'
        ? item.processName.trim().slice(0, MAX_CUSTOM_AGENT_PROCESS_NAME_LENGTH)
        : ''
    const declaredMode =
      item.promptMode === 'argv' || item.promptMode === 'template' ? item.promptMode : 'pty'
    const declaredTemplate =
      typeof item.promptTemplate === 'string'
        ? item.promptTemplate.slice(0, MAX_CUSTOM_AGENT_TEMPLATE_LENGTH)
        : undefined
    // Why: normalized settings get rewritten to disk, so an unsafe template must
    // degrade to the safe delivery mode rather than delete the user's agent.
    const templateUsable =
      declaredMode === 'template' &&
      declaredTemplate !== undefined &&
      isCustomAgentPromptTemplateSafe(declaredTemplate)
    const promptMode = declaredMode === 'template' && !templateUsable ? 'pty' : declaredMode
    const promptTemplate = templateUsable ? declaredTemplate : undefined
    const icon = normalizeCustomAgentIcon(item.icon, name)
    if (!icon) {
      continue
    }
    seen.add(item.id)
    normalized.push({
      id: item.id,
      name,
      command,
      ...(processName ? { processName } : {}),
      promptMode,
      ...(promptTemplate ? { promptTemplate } : {}),
      icon,
      enabled: item.enabled !== false
    })
  }
  return normalized
}

function normalizeCustomAgentIcon(value: unknown, name: string): CustomAgentIcon | null {
  if (!value || typeof value !== 'object') {
    return { kind: 'letter', value: name.charAt(0).toUpperCase() }
  }
  const icon = value as Partial<CustomAgentIcon>
  if (icon.kind === 'terminal') {
    return { kind: 'terminal' }
  }
  if (icon.kind === 'letter') {
    const letter = typeof icon.value === 'string' ? icon.value.trim().slice(0, 2) : ''
    return { kind: 'letter', value: letter || name.charAt(0).toUpperCase() }
  }
  if (
    icon.kind === 'image' &&
    typeof icon.dataUrl === 'string' &&
    icon.dataUrl.startsWith('data:image/') &&
    icon.dataUrl.length <= MAX_CUSTOM_AGENT_IMAGE_DATA_URL_LENGTH &&
    typeof icon.fileName === 'string'
  ) {
    return { kind: 'image', dataUrl: icon.dataUrl, fileName: icon.fileName.slice(0, 160) }
  }
  return { kind: 'letter', value: name.charAt(0).toUpperCase() }
}

export function customAgentForId(
  agent: AgentId,
  customAgents: readonly CustomAgentDefinition[] | null | undefined
): CustomAgentDefinition | undefined {
  return isCustomAgentId(agent) ? customAgents?.find((item) => item.id === agent) : undefined
}
