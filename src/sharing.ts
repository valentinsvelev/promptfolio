/** Pure helpers for clipboard and user-initiated email sharing. No credentials or network requests. */
export function combineClipboardText(existing: string, promptText: string): string {
  const previous = existing.trimEnd();
  const next = promptText.trim();
  return previous ? `${previous}\n\n---\n\n${next}` : next;
}

export function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function mailtoLink(recipient: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(recipient.trim()).replace(/%40/gi, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function accessRequestMailto(sender: string, title: string): string {
  return mailtoLink(sender, 'Request access to Promptfolio',
    `Hello,\n\nYou shared the prompt “${title}” with me. Could you help me request a Promptfolio account and the necessary library access?\n\nThank you.`);
}

export function promptEmailDraft(args: {
  recipient: string; sender: string; title: string; description: string;
  content: string; promptUrl: string; includeContent: boolean;
}): { subject: string; body: string; mailto: string } {
  const {recipient, sender, title, description, content, promptUrl, includeContent} = args;
  if (!isEmailAddress(recipient) || !isEmailAddress(sender)) throw new Error('A valid recipient and sender email are required.');
  if (includeContent && content.length > 3000) {
    throw new Error('This prompt is too long for a reliable email draft. Export it as Markdown and attach that file instead.');
  }
  const subject = `Promptfolio prompt: ${title}`;
  const requestAccess = accessRequestMailto(sender, title);
  const body = [
    `I'd like to share this prompt with you:`,
    '', `Title: ${title}`, description ? `Summary: ${description}` : '',
    '', 'View in Promptfolio (sign-in and library permissions required):', promptUrl,
    '', 'Need access? Reply to this email or use this request-access link:', requestAccess,
    '', 'Receiving this email does not grant access to restricted prompts.',
    ...(includeContent ? ['', '---', 'Prompt text (included by the sender):', content] : []),
  ].filter((line, index, a) => !(line === '' && index > 0 && a[index - 1] === '')).join('\n');
  return { subject, body, mailto: mailtoLink(recipient, subject, body) };
}
