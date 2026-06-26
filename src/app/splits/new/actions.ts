'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface Attendee {
  display_name: string
  phone: string | null
  email: string | null
  mergeGroupId?: string | null
  mergeLabel?: string | null
}

export async function createSplit(formData: FormData): Promise<string> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const title    = formData.get('title') as string
    const groupId  = (formData.get('groupId') as string) || null
    const receipt  = formData.get('receipt') as File | null
    const attendees: Attendee[] = JSON.parse(formData.get('attendees') as string)
    const hasReceipt = receipt && receipt.size > 0

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

    if (attendees.length > 0) {
      const { data: insertedAttendees, error: attendeesErr } = await supabase.from('attendees').insert(
        attendees.map(a => ({
          split_id: split.id,
          display_name: a.display_name,
          phone: a.phone ?? null,
          email: a.email ?? null,
        }))
      ).select()
      if (attendeesErr) {
        console.error('createSplit: failed to insert attendees:', attendeesErr)
      }

      // Auto-apply merge groups from the group template
      if (insertedAttendees && insertedAttendees.length > 0) {
        const mergeMap: Record<string, { label: string; names: string[] }> = {}
        for (const a of attendees) {
          if (a.mergeGroupId) {
            if (!mergeMap[a.mergeGroupId]) mergeMap[a.mergeGroupId] = { label: a.mergeLabel ?? '', names: [] }
            mergeMap[a.mergeGroupId].names.push(a.display_name)
          }
        }
        for (const merge of Object.values(mergeMap)) {
          if (merge.names.length < 2) continue
          const memberIds = insertedAttendees
            .filter(a => merge.names.includes(a.display_name))
            .map(a => a.id)
          if (memberIds.length < 2) continue
          const { data: ag } = await supabase
            .from('attendee_groups')
            .insert({ split_id: split.id, label: merge.label })
            .select()
            .single()
          if (ag) {
            await supabase.from('attendees').update({ group_id: ag.id }).in('id', memberIds)
          }
        }
      }
    }

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

      if (uploadErr) {
        console.error('createSplit: failed to upload receipt to storage:', uploadErr)
      } else {
        const { error: updateErr } = await supabase
          .from('splits')
          .update({ receipt_url: storagePath })
          .eq('id', split.id)
        if (updateErr) {
          console.error('createSplit: failed to update receipt_url on split:', updateErr)
        }
      }
    }

    return split.id
  } catch (err) {
    console.error('createSplit: unexpected error:', err)
    throw err
  }
}
