'use client'

import { useEffect } from 'react'
import { initEruda } from '@/lib/debug'

export function ErudaInit() {
  useEffect(() => { initEruda() }, [])
  return null
}
