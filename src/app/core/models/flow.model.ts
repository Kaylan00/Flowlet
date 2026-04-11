// --- Block Categories & Definitions ---

export type BlockCategory = 'trigger' | 'logic' | 'action' | 'output';

export interface BlockDefinition {
  id: string;
  category: BlockCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  properties: BlockPropertyDef[];
}

export interface BlockPropertyDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'textarea' | 'boolean';
  default: any;
  options?: string[];
  placeholder?: string;
}

export interface BlockPosition {
  x: number;
  y: number;
}

export interface BlockProperty {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'textarea' | 'boolean';
  value: any;
  options?: string[];
  placeholder?: string;
}

export interface FlowBlock {
  id: string;
  definitionId: string;
  category: BlockCategory;
  label: string;
  icon: string;
  color: string;
  position: BlockPosition;
  properties: BlockProperty[];
}

export interface FlowConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface Flow {
  id: string;
  name: string;
  description: string;
  blocks: FlowBlock[];
  connections: FlowConnection[];
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
  updatedAt: string;
  executionCount: number;
}

export interface ExecutionLog {
  blockId: string;
  blockLabel: string;
  blockCategory: BlockCategory;
  status: 'success' | 'failed' | 'skipped' | 'running';
  message: string;
  timestamp: string;
  duration: number;
  output?: any;
}

export interface Execution {
  id: string;
  flowId: string;
  flowName: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  completedAt?: string;
  duration: number;
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
  logs: ExecutionLog[];
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  blocks: FlowBlock[];
  connections: FlowConnection[];
}

// ========================================
//  BLOCK CATALOG - all available blocks
// ========================================

export const BLOCK_CATALOG: BlockDefinition[] = [
  // --- TRIGGERS ---
  {
    id: 'manual-trigger',
    category: 'trigger',
    name: 'Manual Trigger',
    description: 'Start the flow manually with a click',
    icon: 'cursor-click',
    color: '#10b981',
    properties: [
      { key: 'payload', label: 'Input Payload (JSON)', type: 'textarea', default: '{\n  "message": "Hello World"\n}', placeholder: '{ "key": "value" }' },
    ],
  },
  {
    id: 'webhook-trigger',
    category: 'trigger',
    name: 'Webhook',
    description: 'Trigger via incoming HTTP request',
    icon: 'globe',
    color: '#10b981',
    properties: [
      { key: 'method', label: 'Method', type: 'select', default: 'POST', options: ['GET', 'POST', 'PUT'] },
      { key: 'payload', label: 'Sample Payload (JSON)', type: 'textarea', default: '{\n  "event": "test"\n}', placeholder: '{ "key": "value" }' },
    ],
  },
  {
    id: 'schedule-trigger',
    category: 'trigger',
    name: 'Schedule',
    description: 'Run on a timed interval',
    icon: 'clock',
    color: '#10b981',
    properties: [
      { key: 'interval', label: 'Interval', type: 'select', default: 'every_hour', options: ['every_minute', 'every_hour', 'every_day', 'every_week'] },
      { key: 'payload', label: 'Payload (JSON)', type: 'textarea', default: '{}', placeholder: '{}' },
    ],
  },

  // --- LOGIC ---
  {
    id: 'if-else',
    category: 'logic',
    name: 'If / Else',
    description: 'Branch based on a condition',
    icon: 'git-branch',
    color: '#f59e0b',
    properties: [
      { key: 'field', label: 'Field path', type: 'text', default: 'status', placeholder: 'e.g. data.status' },
      { key: 'operator', label: 'Operator', type: 'select', default: 'equals', options: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'] },
      { key: 'value', label: 'Compare value', type: 'text', default: '', placeholder: 'Value to compare' },
    ],
  },
  {
    id: 'delay',
    category: 'logic',
    name: 'Delay',
    description: 'Wait before continuing',
    icon: 'timer',
    color: '#f59e0b',
    properties: [
      { key: 'seconds', label: 'Delay (seconds)', type: 'number', default: 2 },
    ],
  },
  {
    id: 'set-variable',
    category: 'logic',
    name: 'Set Variable',
    description: 'Store a value for later steps',
    icon: 'pen-line',
    color: '#f59e0b',
    properties: [
      { key: 'name', label: 'Variable name', type: 'text', default: 'myVar', placeholder: 'Variable name' },
      { key: 'value', label: 'Value', type: 'text', default: '', placeholder: 'Value or {{data.field}}' },
    ],
  },
  {
    id: 'filter',
    category: 'logic',
    name: 'Filter',
    description: 'Stop flow if condition is not met',
    icon: 'filter',
    color: '#f59e0b',
    properties: [
      { key: 'field', label: 'Field path', type: 'text', default: '', placeholder: 'e.g. data.active' },
      { key: 'operator', label: 'Operator', type: 'select', default: 'equals', options: ['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty'] },
      { key: 'value', label: 'Expected value', type: 'text', default: 'true', placeholder: '' },
    ],
  },

  // --- ACTIONS ---
  {
    id: 'http-request',
    category: 'action',
    name: 'HTTP Request',
    description: 'Make a real HTTP request to any URL',
    icon: 'link',
    color: '#4f46e5',
    properties: [
      { key: 'method', label: 'Method', type: 'select', default: 'GET', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'url', label: 'URL', type: 'text', default: 'https://jsonplaceholder.typicode.com/posts/1', placeholder: 'https://api.example.com/...' },
      { key: 'headers', label: 'Headers (JSON)', type: 'textarea', default: '{\n  "Content-Type": "application/json"\n}', placeholder: '{}' },
      { key: 'body', label: 'Body (JSON)', type: 'textarea', default: '', placeholder: 'Request body for POST/PUT' },
    ],
  },
  {
    id: 'slack-message',
    category: 'action',
    name: 'Slack',
    description: 'Send a message to Slack via webhook',
    icon: 'slack',
    color: '#e01e5a',
    properties: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', default: '', placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'message', label: 'Message', type: 'textarea', default: 'Hello from Flowlet! {{data.message}}', placeholder: 'Supports {{data.field}}' },
      { key: 'channel', label: 'Channel override', type: 'text', default: '', placeholder: '#general' },
      { key: 'username', label: 'Bot name', type: 'text', default: 'Flowlet Bot', placeholder: '' },
    ],
  },
  {
    id: 'discord-message',
    category: 'action',
    name: 'Discord',
    description: 'Send a message to Discord via webhook',
    icon: 'discord',
    color: '#5865f2',
    properties: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'text', default: '', placeholder: 'https://discord.com/api/webhooks/...' },
      { key: 'content', label: 'Message', type: 'textarea', default: 'Hello from Flowlet!', placeholder: 'Supports {{data.field}}' },
      { key: 'username', label: 'Bot name', type: 'text', default: 'Flowlet Bot', placeholder: '' },
      { key: 'avatarUrl', label: 'Avatar URL', type: 'text', default: '', placeholder: 'https://...' },
    ],
  },
  {
    id: 'telegram-message',
    category: 'action',
    name: 'Telegram',
    description: 'Send a message via Telegram Bot API',
    icon: 'telegram',
    color: '#0088cc',
    properties: [
      { key: 'botToken', label: 'Bot Token', type: 'text', default: '', placeholder: '123456:ABC-DEF...' },
      { key: 'chatId', label: 'Chat ID', type: 'text', default: '', placeholder: 'Chat or group ID' },
      { key: 'message', label: 'Message', type: 'textarea', default: 'Hello from Flowlet!', placeholder: 'Supports {{data.field}}' },
      { key: 'parseMode', label: 'Parse mode', type: 'select', default: 'HTML', options: ['HTML', 'Markdown', 'MarkdownV2'] },
    ],
  },
  {
    id: 'openai-chat',
    category: 'action',
    name: 'OpenAI (ChatGPT)',
    description: 'Generate text with GPT models',
    icon: 'openai',
    color: '#000000',
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', default: '', placeholder: 'sk-...' },
      { key: 'model', label: 'Model', type: 'select', default: 'gpt-4o-mini', options: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-nano', 'gpt-4.1-mini'] },
      { key: 'prompt', label: 'Prompt', type: 'textarea', default: 'Summarize this data: {{data}}', placeholder: 'Supports {{data.field}}' },
      { key: 'systemPrompt', label: 'System prompt', type: 'textarea', default: 'You are a helpful assistant.', placeholder: '' },
      { key: 'temperature', label: 'Temperature (0-2)', type: 'number', default: 0.7 },
    ],
  },
  {
    id: 'github-issue',
    category: 'action',
    name: 'GitHub Issue',
    description: 'Create an issue on a GitHub repository',
    icon: 'github',
    color: '#24292e',
    properties: [
      { key: 'token', label: 'Personal Access Token', type: 'text', default: '', placeholder: 'ghp_...' },
      { key: 'repo', label: 'Repository (owner/repo)', type: 'text', default: '', placeholder: 'user/repo' },
      { key: 'title', label: 'Issue title', type: 'text', default: '{{data.title}}', placeholder: 'Supports {{data.field}}' },
      { key: 'body', label: 'Issue body', type: 'textarea', default: '', placeholder: 'Markdown supported' },
      { key: 'labels', label: 'Labels (comma-separated)', type: 'text', default: '', placeholder: 'bug, enhancement' },
    ],
  },
  {
    id: 'webhook-send',
    category: 'action',
    name: 'Send Webhook',
    description: 'POST data to any webhook endpoint',
    icon: 'send',
    color: '#4f46e5',
    properties: [
      { key: 'url', label: 'Webhook URL', type: 'text', default: '', placeholder: 'https://...' },
      { key: 'sendPreviousOutput', label: 'Send previous step data?', type: 'boolean', default: true },
      { key: 'customBody', label: 'Custom body (JSON)', type: 'textarea', default: '', placeholder: '{ "key": "value" }' },
    ],
  },
  {
    id: 'transform-data',
    category: 'action',
    name: 'Transform Data',
    description: 'Map and transform data between steps',
    icon: 'shuffle',
    color: '#4f46e5',
    properties: [
      { key: 'expression', label: 'JavaScript Expression', type: 'textarea', default: '// Access previous step data via `data`\nreturn { processed: true, original: data }', placeholder: 'return { ... }' },
    ],
  },
  {
    id: 'javascript-code',
    category: 'action',
    name: 'Run JavaScript',
    description: 'Execute custom JavaScript code',
    icon: 'code',
    color: '#4f46e5',
    properties: [
      { key: 'code', label: 'Code', type: 'textarea', default: '// `data` = previous step output\n// `variables` = stored variables\nconsole.log("Running custom code", data);\nreturn { success: true };', placeholder: '// Your code here' },
    ],
  },

  // --- OUTPUT ---
  {
    id: 'console-log',
    category: 'output',
    name: 'Console Log',
    description: 'Log data to browser console',
    icon: 'terminal',
    color: '#8b5cf6',
    properties: [
      { key: 'label', label: 'Log label', type: 'text', default: 'Flowlet Output', placeholder: 'Label' },
      { key: 'logData', label: 'What to log', type: 'select', default: 'full_context', options: ['full_context', 'previous_output', 'variables_only'] },
    ],
  },
  {
    id: 'browser-notification',
    category: 'output',
    name: 'Notification',
    description: 'Show a real browser notification',
    icon: 'bell',
    color: '#8b5cf6',
    properties: [
      { key: 'title', label: 'Title', type: 'text', default: 'Flowlet', placeholder: 'Notification title' },
      { key: 'message', label: 'Message', type: 'text', default: 'Flow completed successfully!', placeholder: 'Notification message' },
    ],
  },
  {
    id: 'alert-dialog',
    category: 'output',
    name: 'Alert Dialog',
    description: 'Show a browser alert with data',
    icon: 'message-circle',
    color: '#8b5cf6',
    properties: [
      { key: 'message', label: 'Message', type: 'text', default: 'Flow executed!', placeholder: 'Alert message' },
      { key: 'showData', label: 'Include data?', type: 'boolean', default: true },
    ],
  },
  {
    id: 'save-to-storage',
    category: 'output',
    name: 'Save to Storage',
    description: 'Save data to browser localStorage',
    icon: 'database',
    color: '#8b5cf6',
    properties: [
      { key: 'storageKey', label: 'Storage key', type: 'text', default: 'flowlet-output', placeholder: 'Key name' },
      { key: 'saveWhat', label: 'What to save', type: 'select', default: 'previous_output', options: ['full_context', 'previous_output', 'variables_only'] },
    ],
  },
];

export const BLOCK_CATEGORIES: { id: BlockCategory; label: string; color: string }[] = [
  { id: 'trigger', label: 'Triggers', color: '#10b981' },
  { id: 'logic', label: 'Logic', color: '#f59e0b' },
  { id: 'action', label: 'Actions', color: '#4f46e5' },
  { id: 'output', label: 'Output', color: '#8b5cf6' },
];

export function getBlockDefinition(id: string): BlockDefinition | undefined {
  return BLOCK_CATALOG.find(b => b.id === id);
}

// ========================================
//  TEMPLATES
// ========================================

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'tpl-http-notify',
    name: 'Fetch & Notify',
    description: 'Fetch data from an API and show a browser notification',
    icon: 'bell',
    blocks: [
      { id: 'b1', definitionId: 'manual-trigger', category: 'trigger', label: 'Manual Trigger', icon: 'cursor-click', color: '#10b981', position: { x: 80, y: 160 }, properties: [
        { key: 'payload', label: 'Input Payload (JSON)', type: 'textarea', value: '{\n  "userId": 1\n}' },
      ]},
      { id: 'b2', definitionId: 'http-request', category: 'action', label: 'Fetch User', icon: 'link', color: '#4f46e5', position: { x: 400, y: 160 }, properties: [
        { key: 'method', label: 'Method', type: 'select', value: 'GET', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        { key: 'url', label: 'URL', type: 'text', value: 'https://jsonplaceholder.typicode.com/users/1' },
        { key: 'headers', label: 'Headers (JSON)', type: 'textarea', value: '{}' },
        { key: 'body', label: 'Body (JSON)', type: 'textarea', value: '' },
      ]},
      { id: 'b3', definitionId: 'console-log', category: 'output', label: 'Log Result', icon: 'terminal', color: '#8b5cf6', position: { x: 720, y: 100 }, properties: [
        { key: 'label', label: 'Log label', type: 'text', value: 'API Response' },
        { key: 'logData', label: 'What to log', type: 'select', value: 'previous_output', options: ['full_context', 'previous_output', 'variables_only'] },
      ]},
      { id: 'b4', definitionId: 'browser-notification', category: 'output', label: 'Notify', icon: 'bell', color: '#8b5cf6', position: { x: 720, y: 260 }, properties: [
        { key: 'title', label: 'Title', type: 'text', value: 'User Fetched!' },
        { key: 'message', label: 'Message', type: 'text', value: 'Data loaded successfully' },
      ]},
    ],
    connections: [
      { id: 'c1', sourceId: 'b1', targetId: 'b2' },
      { id: 'c2', sourceId: 'b2', targetId: 'b3' },
      { id: 'c3', sourceId: 'b2', targetId: 'b4' },
    ],
  },
  {
    id: 'tpl-conditional',
    name: 'Conditional Logic',
    description: 'Fetch data, check a condition, then act accordingly',
    icon: 'git-branch',
    blocks: [
      { id: 'b1', definitionId: 'manual-trigger', category: 'trigger', label: 'Start', icon: 'cursor-click', color: '#10b981', position: { x: 80, y: 160 }, properties: [
        { key: 'payload', label: 'Input Payload (JSON)', type: 'textarea', value: '{\n  "status": "active",\n  "count": 42\n}' },
      ]},
      { id: 'b2', definitionId: 'if-else', category: 'logic', label: 'Check Status', icon: 'git-branch', color: '#f59e0b', position: { x: 400, y: 160 }, properties: [
        { key: 'field', label: 'Field path', type: 'text', value: 'status' },
        { key: 'operator', label: 'Operator', type: 'select', value: 'equals', options: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'] },
        { key: 'value', label: 'Compare value', type: 'text', value: 'active' },
      ]},
      { id: 'b3', definitionId: 'browser-notification', category: 'output', label: 'Notify Active', icon: 'bell', color: '#8b5cf6', position: { x: 720, y: 160 }, properties: [
        { key: 'title', label: 'Title', type: 'text', value: 'Status Active' },
        { key: 'message', label: 'Message', type: 'text', value: 'The system is active!' },
      ]},
    ],
    connections: [
      { id: 'c1', sourceId: 'b1', targetId: 'b2' },
      { id: 'c2', sourceId: 'b2', targetId: 'b3' },
    ],
  },
  {
    id: 'tpl-empty',
    name: 'Blank Flow',
    description: 'Start from scratch',
    icon: 'zap',
    blocks: [],
    connections: [],
  },
];
