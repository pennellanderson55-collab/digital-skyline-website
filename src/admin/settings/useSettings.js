// ============================================================================
// useSettings — load/save a singleton settings row (`data` jsonb) for a table.
// Tracks the saved snapshot vs. the working draft so the UI can show an
// "unsaved changes" state, dirty guard, reset and last-saved time.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase.js'

export function useSettings(table, defaults = {}) {
  const defaultsRef = useRef(defaults)
  const [saved, setSaved] = useState(defaults)
  const [draft, setDraft] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    if (!supabase) { setLoading(false); return }
    const { data, error: e } = await supabase.from(table).select('data, updated_at').eq('id', true).maybeSingle()
    if (e) {
      setError(/relation .* does not exist|could not find the table/i.test(e.message)
        ? `“${table}” not found — run supabase/sprint8_settings.sql, then Refresh.`
        : e.message)
    } else {
      const merged = { ...defaultsRef.current, ...(data?.data || {}) }
      setSaved(merged); setDraft(merged); setLastSaved(data?.updated_at || null)
    }
    setLoading(false)
  }, [table])

  useEffect(() => { load() }, [load])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved])
  const set = useCallback((k, v) => setDraft((d) => ({ ...d, [k]: v })), [])
  const reset = useCallback(() => setDraft(saved), [saved])

  const save = useCallback(async () => {
    if (!supabase) return false
    setSaving(true); setError('')
    const { data, error: e } = await supabase.from(table).upsert({ id: true, data: draft }).select('updated_at').single()
    setSaving(false)
    if (e) { setError(e.message); return false }
    setSaved(draft); setLastSaved(data?.updated_at || new Date().toISOString())
    return true
  }, [table, draft])

  return { draft, saved, set, setDraft, dirty, loading, saving, lastSaved, error, save, reset, reload: load }
}
