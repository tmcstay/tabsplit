'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface Attendee {
  display_name: string
  phone: string | null
  email: string | null
}

export async function createSplit(formData: FormData): Promise<string> {
  console.log('createSplit: called')
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('createSplit: auth result —', { userId: user?.id ?? null, authError })
    if (!user) redirect('/login')
    console.log('createSplit: authenticated as', user.id)

    const title    = formData.get('title') as string
    const groupId  = (formData.get('groupId') as string) || null
    const receipt  = formData.get('receipt') as File | null
    const attendees: Attendee[] = JSON.parse(formData.get('attendees') as string)
    const hasReceipt = receipt && receipt.size > 0

    console.log('createSplit: inputs —', {
      title,
      groupId,
      hasReceipt,
      receiptType: receipt?.type ?? null,
      receiptSize: receipt?.size ?? null,
      attendeeCount: attendees.length,
    })

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

    if (splitErr || !split) {
      console.error('createSplit: failed to insert split:', splitErr)
      throw new Error('Failed to create split')
    }
    console.log('createSplit: split created', split.id)

    if (attendees.length > 0) {
      const { error: attendeesErr } = await supabase.from('attendees').insert(
        attendees.map(a => ({
          split_id: split.id,
          display_name: a.display_name,
          phone: a.phone ?? null,
          email: a.email ?? null,
        }))
      )
      if (attendeesErr) {
        console.error('createSplit: failed to insert attendees:', attendeesErr)
      } else {
        console.log('createSplit: attendees inserted', attendees.length)
      }
    }

    if (hasReceipt) {
      const bytes = await receipt.arrayBuffer()
      const ext = receipt.type === 'image/png' ? 'png' : 'jpg'
      const storagePath = `${split.id}/receipt.${ext}`
      console.log('createSplit: uploading receipt to', storagePath)

      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(storagePath, bytes, {
          contentType: receipt.type || 'image/jpeg',
          upsert: true,
        })

      if (uploadErr) {
        console.error('createSplit: failed to upload receipt to storage:', uploadErr)
      } else {
        console.log('createSplit: receipt uploaded successfully')
        const { error: updateErr } = await supabase
          .from('splits')
          .update({ receipt_url: storagePath })
          .eq('id', split.id)
        if (updateErr) {
          console.error('createSplit: failed to update receipt_url on split:', updateErr)
        } else {
          console.log('createSplit: receipt_url saved to split')
        }
      }
    }

    console.log('createSplit: complete, returning', split.id)
    return split.id
  } catch (err) {
    console.error('createSplit: unexpected error:', err)
    throw err
  }
}
