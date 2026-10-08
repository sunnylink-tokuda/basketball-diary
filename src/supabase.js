import { createClient } from '@supabase/supabase-js'
import { createRecoveryController, recoveryLink } from './passwordRecovery.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const initialRecoveryLink = recoveryLink(window.location)

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !initialRecoveryLink.recovery,
    flowType: initialRecoveryLink.kind === 'code' ? 'pkce' : 'implicit',
  },
})

export const passwordRecovery = createRecoveryController(supabase.auth, window, initialRecoveryLink)
