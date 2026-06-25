'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function addFavourite(
  display_name: string,
  phone: string | null,
  email: string | null,
): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('favourite_contacts')
    .insert({ user_id: user.id, display_name, phone, email })
    .select('id')
    .single()

  if (error || !data) throw new Error('Failed to add favourite.')
  return data.id
}

export async function removeFavourite(favouriteId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('favourite_contacts').delete().eq('id', favouriteId).eq('user_id', user.id)
}
