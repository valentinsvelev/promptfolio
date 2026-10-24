// Deploy with: supabase functions deploy admin-accounts
// Authenticated callers only; the service-role key stays inside Supabase Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2';
const ORIGIN = Deno.env.get('APP_ORIGIN') || '';
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Vary': 'Origin',
};
const send = (code:number, payload:unknown) => new Response(JSON.stringify(payload),{status:code,headers:cors});
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
const randomPassword = () => Array.from(crypto.getRandomValues(new Uint32Array(24)), v=>alphabet[v%alphabet.length]).join('');
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
  if (req.method !== 'POST' || (ORIGIN && req.headers.get('origin') !== ORIGIN)) return send(403,{error:'Forbidden'});
  const url = Deno.env.get('SUPABASE_URL');
  const publishable = Deno.env.get('SUPABASE_ANON_KEY');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishable || !secret) return send(500,{error:'Server is not configured'});
  const bearer = req.headers.get('Authorization') || '';
  if (!bearer.startsWith('Bearer ')) return send(401,{error:'Login required'});
  const auth = createClient(url,publishable,{global:{headers:{Authorization:bearer}}});
  const {data:{user},error:authError}=await auth.auth.getUser();
  if (authError || !user) return send(401,{error:'Session expired'});
  const admin = createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  try {
    const input = await req.json() as Record<string, unknown>;
    const action = String(input.action || '');
    if (action === 'complete_temp_password') {
      const newPassword = String(input.password || '');
      if (newPassword.length < 12 || newPassword.length > 128) return send(400,{error:'Use a password of at least 12 characters'});
      const {data:control,error} = await admin.from('account_controls').select('*').eq('user_id',user.id).maybeSingle();
      if (error || !control || control.disabled || !control.must_change_password) return send(403,{error:'No pending temporary password change'});
      if (control.temporary_password_expires_at && new Date(control.temporary_password_expires_at).getTime() < Date.now()) return send(403,{error:'Temporary password has expired. Ask an administrator to issue a replacement.'});
      const updated = await admin.auth.admin.updateUserById(user.id,{password:newPassword});
      if (updated.error) throw updated.error;
      const cleared = await admin.from('account_controls').update({must_change_password:false,temporary_password_expires_at:null,updated_at:new Date().toISOString()}).eq('user_id',user.id);
      if (cleared.error) throw cleared.error;
      await admin.from('audit_events').insert({actor_id:user.id,event_type:'temporary_password_changed',description:'Required password change completed'});
      return send(200,{ok:true});
    }
    const {data:permission,error:roleError} = await admin.from('app_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(roleError || !permission) return send(403,{error:'Application Administrator required'});
    const userId = String(input.user_id || '');
    if(action==='create_user') {
      const email = String(input.email || '').trim().toLowerCase();
      const name = String(input.display_name || 'Contributor').slice(0,100);
      if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(400,{error:'Valid email required'});
      const {data:settings} = await admin.from('app_settings').select('temporary_password_hours').eq('id',true).single();
      const ttl = settings?.temporary_password_hours ?? 48;
      const password = randomPassword();
      const created = await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:name}});
      if(created.error || !created.data.user) throw created.error || Error('Creation failed');
      const id = created.data.user.id;
      const expiresAt = new Date(Date.now()+ttl*3600_000).toISOString();
      const c=await admin.from('account_controls').upsert({user_id:id,must_change_password:true,temporary_password_expires_at:expiresAt,disabled:false});
      if(c.error) {await admin.auth.admin.deleteUser(id);throw c.error;}
      await admin.from('audit_events').insert({actor_id:user.id,event_type:'admin_user_created',description:`Created ${email} with temporary credential`});
      return send(200,{ok:true,user_id:id,temporary_password:password,expires_at:expiresAt});
    }
    if(!userId || userId===user.id) return send(400,{error:'Choose another user'});
    const {data:target,error:targetError}=await admin.from('profiles').select('id,email').eq('id',userId).single();
    if(targetError||!target) return send(404,{error:'User not found'});
    if(action==='disable_user'||action==='enable_user') {
      const disable=action==='disable_user';
      const x=await admin.auth.admin.updateUserById(userId,{ban_duration:disable?'876000h':'none'});
      if(x.error) throw x.error;
      const c=await admin.from('account_controls').upsert({user_id:userId,disabled:disable,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(c.error) throw c.error;
      await admin.from('audit_events').insert({actor_id:user.id,event_type:disable?'user_disabled':'user_reenabled',description:target.email});
      return send(200,{ok:true});
    }
    if(action==='reset_temp_password') {
      const password=randomPassword();
      const {data:settings}=await admin.from('app_settings').select('temporary_password_hours').eq('id',true).single();
      const expiry = new Date(Date.now()+(settings?.temporary_password_hours??48)*3600_000).toISOString();
      const x=await admin.auth.admin.updateUserById(userId,{password});
      if(x.error) throw x.error;
      const c=await admin.from('account_controls').upsert({user_id:userId,must_change_password:true,temporary_password_expires_at:expiry,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(c.error) throw c.error;
      await admin.from('audit_events').insert({actor_id:user.id,event_type:'admin_temporary_reset',description:target.email});
      return send(200,{ok:true,temporary_password:password,expires_at:expiry});
    }
    return send(400,{error:'Unknown operation'});
  } catch(err) {return send(400,{error:err instanceof Error?err.message:'Unexpected error'});}
});
