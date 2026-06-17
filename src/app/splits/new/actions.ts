'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface Attendee {
  display_name: string
  phone: string | null
}

export async function createSplit(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title    = formData.get('title') as string
  const groupId  = (formData.get('groupId') as string) || null
  const receipt  = formData.get('receipt') as File | null
  const attendees: Attendee[] = JSON.parse(formData.get('attendees') as string)

  const hasReceipt = receipt && receipt.size > 0

  // Create split — status is 'draft' if a receipt is provided, 'pending' otherwise
  const { data: split, error: splitErr } = await supabase
    .from('splits')
    .insert({
      organiser_id: user.id,
      title: title.trim(),
      group_id: groupId,
      status: hasReceipt ? 'draft' : 'pending',
    })
    .select()
    .single()

  if (splitErr || !split) throw new Error('Failed to create split')

  // Create attendees
  if (attendees.length > 0) {
    await supabase.from('attendees').insert(
      attendees.map(a => ({
        split_id: split.id,
        display_name: a.display_name,
        phone: a.phone ?? null,
      }))
    )
  }

  // Upload receipt to private bucket; store the storage path in receipt_url
  if (hasReceipt) {
    const bytes = await receipt.arrayBuffer()
    const ext = receipt.type === 'image/png' ? 'png' : 'jpg'
    const storagePath = `${split.id}/receipt.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('receipts')
      .upload(storagePath, bytes, {
        contentType: receipt.type || 'image/jpeg',
        upsert: true,
      })

    if (!uploadErr) {
      await supabase
        .from('splits')
        .update({ receipt_url: storagePath })
        .eq('id', split.id)
    }
  }

  return split.id
}
