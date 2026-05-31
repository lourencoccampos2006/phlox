'use client'

// auditClient — disparar eventos do Phlox Audit Trail a partir do browser.
// Fire-and-forget; falhas silenciadas para nunca quebrar o UX.

export async function audit(supabase: any, action: string, opts?: { category?: string; resource?: string; resource_id?: string; detail?: any }) {
  try {
    const t = (await supabase.auth.getSession()).data.session?.access_token
    if (!t) return
    await fetch('/api/audit/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ action, ...opts }),
    })
  } catch { /* silent */ }
}
