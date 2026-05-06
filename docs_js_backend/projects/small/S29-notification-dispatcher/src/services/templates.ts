const templates: Record<string, string> = {
  welcome: 'Hello {{name}}, welcome to {{app}}!',
  alert: 'Alert: {{message}}',
};

export async function renderTemplate(name: string, vars: Record<string, string>): Promise<string> {
  const template = templates[name] || name;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] || '');
}
