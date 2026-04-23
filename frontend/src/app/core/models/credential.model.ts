export interface Credential {
  id: string;
  name: string;
  appType: string;
  fields: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AppDefinition {
  id: string;
  label: string;
  color: string;
  icon: string;
  fields: { key: string; label: string; placeholder: string; type?: 'password' | 'text' | 'textarea' }[];
}

export const APP_DEFINITIONS: AppDefinition[] = [
  {
    id: 'slack',
    label: 'Slack',
    color: '#4A154B',
    icon: 'slack',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
    ],
  },
  {
    id: 'discord',
    label: 'Discord',
    color: '#5865F2',
    icon: 'discord',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: 'MTk...', type: 'password' },
      { key: 'webhookUrl', label: 'Webhook URL (opcional)', placeholder: 'https://discord.com/api/webhooks/...' },
    ],
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#229ED9',
    icon: 'telegram',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '1234567890:ABC...', type: 'password' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    color: '#10A37F',
    icon: 'openai',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', type: 'password' },
    ],
  },
  {
    id: 'github',
    label: 'GitHub',
    color: '#24292E',
    icon: 'github',
    fields: [
      { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_...', type: 'password' },
    ],
  },
  {
    id: 'google_sheets',
    label: 'Google Sheets',
    color: '#0F9D58',
    icon: 'google-sheets',
    fields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'AIza...', type: 'password' },
      { key: 'serviceAccountJson', label: 'Service Account JSON (opcional)', placeholder: '{"type":"service_account",...}', type: 'textarea' },
    ],
  },
  {
    id: 'http',
    label: 'HTTP Genérico',
    color: '#6B7280',
    icon: 'globe',
    fields: [
      { key: 'headerKey', label: 'Header Name', placeholder: 'Authorization' },
      { key: 'headerValue', label: 'Header Value', placeholder: 'Bearer token123...', type: 'password' },
    ],
  },
];
