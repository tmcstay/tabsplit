// Initialise Eruda floating debug console.
// ON by default. Set NEXT_PUBLIC_ENABLE_ERUDA=false to disable.
export function initEruda(): void {
  if (process.env.NEXT_PUBLIC_ENABLE_ERUDA === 'false') return
  import('eruda').then(({ default: eruda }) => eruda.init())
}
