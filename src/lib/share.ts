/* eslint-disable @typescript-eslint/no-explicit-any */
export async function shareText(opts: {
  title: string
  text: string
  url?: string
}): Promise<'shared' | 'copied' | 'dismissed'> {
  const combined = opts.url ? `${opts.text}\n${opts.url}` : opts.text

  try {
    const isNative =
      typeof window !== 'undefined' &&
      !!(window as any).Capacitor?.isNativePlatform?.()

    if (isNative) {
      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: opts.title,
        text: opts.text,
        url: opts.url,
        dialogTitle: opts.title,
      })
      return 'shared'
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url })
      return 'shared'
    }

    await navigator.clipboard.writeText(combined)
    return 'copied'
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : ''
    if (name === 'AbortError' || name === 'NotAllowedError') return 'dismissed'
    try {
      await navigator.clipboard.writeText(combined)
      return 'copied'
    } catch {
      return 'dismissed'
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
