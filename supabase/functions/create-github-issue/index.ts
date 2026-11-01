// Supabase Edge Function. Deploy with --no-verify-jwt; this function validates
// the user's access token explicitly via Supabase Auth before doing any work.
import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (status: number, payload: unknown) => new Response(JSON.stringify(payload), {
  status, headers: { ...headers, 'Content-Type': 'application/json' },
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return respond(405, { error: 'POST required' });
  const url = Deno.env.get('SUPABASE_URL');
  // Support both legacy and newer Supabase project key environments.
  const getNamedKey = (name: string): string | undefined => {
    try { const parsed = JSON.parse(Deno.env.get(name) || '{}'); return parsed.default }
    catch { return undefined }
  };
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || getNamedKey('SUPABASE_PUBLISHABLE_KEYS');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY') || getNamedKey('SUPABASE_SECRET_KEYS');
  const token = Deno.env.get('GITHUB_ISSUES_TOKEN');
  const repository = Deno.env.get('GITHUB_ISSUES_REPOSITORY') || 'valentinsvelev/promptfolio';
  if (!url || !publicKey || !serviceKey || !token || !/^[\w.-]+\/[\w.-]+$/.test(repository))
    return respond(503, { error: 'Feedback integration is not configured.' });
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') || '');
  if (!match) return respond(401, { error: 'Please sign in first.' });
  const auth = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await auth.auth.getUser(match[1]);
  if (authError || !user || !user.email_confirmed_at) return respond(401, { error: 'A confirmed account is required.' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: controls, error: controlError } = await admin.from('account_controls')
    .select('disabled,must_change_password').eq('user_id', user.id).maybeSingle();
  if (controlError) {
    console.error('Account controls lookup failed:', {
      code: controlError.code,
      message: controlError.message,
    });

    return respond(503, {
      error: 'Could not verify account permissions. Check function logs.'
    });
  }

  if (controls?.disabled || controls?.must_change_password) {
    return respond(403, {
      error: 'Your account is not permitted to submit feedback.'
    });
  }
  // extract user's first name
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {console.error('Profile lookup failed:', profileError.message);}
  const firstName = profile?.display_name?.trim().split(/\s+/)[0] || 'Unknown';
  let input: { kind?: unknown; title?: unknown; description?: unknown };
  try { input = await req.json() } catch { return respond(400, { error: 'Invalid request.' }) }
  const kind = input.kind === 'bug' ? 'bug' : input.kind === 'enhancement' ? 'enhancement' : null;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (!kind || title.length < 5 || title.length > 120 || description.length < 15 || description.length > 4000)
    return respond(400, { error: 'Enter a valid feedback type, title and description.' });
  // time-out between creating GitHub Issues entries
  const slot = new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString(); // time in milliseconds
  const { error: reserved } = await admin.from('github_issue_feedback_limits').insert({ user_id: user.id, bucket_start: slot });
  if (reserved) return respond(429, { error: 'Please wait before sending another report (limit: one every 5 minutes).' });
  // creating entry
  const issueType = kind === 'bug' ? 'Bug report' : 'Feature suggestion';
  const issueTitle = `[${kind === 'bug' ? 'Bug' : 'Feature'}] ${title}`;
  const text = [
    '## Description',
    '',
    description,
    '',
    '## Details',
    '',
    `**Submitted by:** ${firstName}`,
    '',
    `**Type:** ${issueType}`,
    '',
    '**Source:** Promptfolio',
    '',
    '---',
    '',
    '*Automatically submitted via Promptfolio*'
  ].join('\n');
  let created: Response;
  try {
    created = await fetch(`https://api.github.com/repos/${repository}/issues`, {
      method: 'POST', 
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'Promptfolio-feedback',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: text
      }),
    });
  } catch { created = new Response(null, { status: 502 }) }
  if (!created.ok) {
    // Release the slot for transient GitHub/network failures.
    await admin.from('github_issue_feedback_limits').delete().eq('user_id', user.id).eq('bucket_start', slot);
    return respond(502, { error: 'GitHub could not create the issue. Contact the administrator.' });
  }
  const issue = await created.json();
  if (typeof issue.html_url !== 'string' || !issue.html_url.startsWith(`https://github.com/${repository}/issues/`))
    return respond(502, { error: 'Issue created, but its link was unavailable.' });
  return respond(201, { url: issue.html_url, number: issue.number });
});
