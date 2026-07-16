const REQUIRED_LABELS = ['date', 'employee id', 'location', 'task description', 'priority', 'remarks'];

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function parseTaskTemplate(rawBody, isHtml) {
  const text = isHtml ? htmlToText(rawBody) : rawBody;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const fields = {};
  for (const line of lines) {
    const match = line.match(/^([A-Za-z ]+?)\s*:\s*(.*)$/);
    if (!match) continue;
    const label = match[1].trim().toLowerCase();
    if (REQUIRED_LABELS.includes(label) && !(label in fields)) {
      fields[label] = match[2].trim();
    }
  }

  const matchesTemplate = REQUIRED_LABELS.every((label) => label in fields);
  if (!matchesTemplate) {
    return { matchesTemplate: false };
  }

  return {
    matchesTemplate: true,
    fields: {
      date: fields['date'],
      empId: fields['employee id'],
      location: fields['location'],
      description: fields['task description'],
      priority: fields['priority'],
      remarks: fields['remarks'],
    },
  };
}

module.exports = { parseTaskTemplate, htmlToText };
