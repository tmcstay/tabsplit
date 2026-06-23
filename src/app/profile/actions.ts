'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function savePayId(payid: string | null, payidLabel: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('users')
    .update({ payid, payid_label: payidLabel })
    .eq('id', user.id)

  revalidatePath('/profile')
}
