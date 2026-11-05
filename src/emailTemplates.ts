/** Plain-text templates for the Promptfolio email composer. No email is sent. */
export type PromptEmailTone = 'formal' | 'casual';
export type PromptEmailTemplate = 'share' | 'feedback' | 'collaborate';

export type GeneratedPromptEmail = { subject: string; body: string };

export function generatePromptEmail({
  recipientName, tone, template, title, description, content, versionNumber,
  officialVersionNumber, promptUrl, senderName,
}: {
  recipientName: string;
  tone: PromptEmailTone;
  template: PromptEmailTemplate;
  title: string;
  description: string;
  content: string;
  versionNumber: number;
  officialVersionNumber: number;
  promptUrl: string;
  senderName: string;
}): GeneratedPromptEmail {
  const name = recipientName.trim();
  if (!name) throw new Error('Enter the recipient’s name first.');

  const formal = tone === 'formal';
  const greeting = formal ? `Dear ${name},` : `Hi ${name},`;
  const closing = formal ? 'Kind regards,' : 'Cheers,';
  const sender = senderName.trim() || 'A Promptfolio colleague';

  const introductions: Record<PromptEmailTemplate, { formal: string; casual: string }> = {
    share: {
      formal: 'I would like to share a Promptfolio prompt that may be useful for your work.',
      casual: 'Thought you might find this Promptfolio prompt useful!',
    },
    feedback: {
      formal: 'I would appreciate your feedback on the prompt below, especially its clarity and usefulness.',
      casual: 'Could you take a look at this prompt and let me know what you think?',
    },
    collaborate: {
      formal: 'I would like to invite you to collaborate on improving the following Promptfolio prompt.',
      casual: 'Want to help me make this prompt even better?',
    },
  };
  const subjects: Record<PromptEmailTemplate, string> = {
    share: `Sharing a Promptfolio prompt: ${title}`,
    feedback: `Your feedback on a Promptfolio prompt: ${title}`,
    collaborate: `Let's improve a Promptfolio prompt: ${title}`,
  };
  const request: Record<PromptEmailTemplate, { formal: string; casual: string }> = {
    share: {
      formal: 'I hope you find it useful.',
      casual: 'Hope it helps!',
    },
    feedback: {
      formal: 'I would be grateful for any suggestions or questions you may have.',
      casual: 'Let me know what works and what you would change!',
    },
    collaborate: {
      formal: 'Please let me know if you would be interested in discussing possible improvements.',
      casual: 'Let me know if you have ideas we can try together!',
    },
  };

  const sections = [
    greeting,
    introductions[template][tone],
    `Prompt: ${title}\nVersion: v${versionNumber}`,
    ...(description.trim() ? [`About this prompt:\n${description.trim()}`] : []),
    `Prompt text (v${versionNumber}):\n${content}`,
    `Open the prompt in Promptfolio:\n${promptUrl}`,
    ...(versionNumber !== officialVersionNumber
      ? ['Note: The link opens the currently published version in Promptfolio. The prompt text above is from the version selected for this email.']
      : []),
    'If you do not have a Promptfolio account or cannot open the link, reply to this email to request access. Access is subject to approval.',
    request[template][tone],
    `${closing}\n${sender}`,
  ];
  return { subject: `${subjects[template]} (v${versionNumber})`, body: sections.join('\n\n') };
}
