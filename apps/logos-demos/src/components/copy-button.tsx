'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** How long the confirmation stays up before the label goes back. */
const CONFIRM_MS = 2000

/**
 * Copies a value to the clipboard and says so.
 *
 * The clipboard needs a secure context and can be refused outright, so a
 * failure is reported rather than swallowed: a button that silently does
 * nothing is worse than one that admits it cannot.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)

    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('failed')
    }

    timer.current = setTimeout(() => setState('idle'), CONFIRM_MS)
  }, [value])

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="text-caption-sans shrink-0 cursor-pointer border border-gray-02 bg-white px-2 py-1 text-brand-dark-green hover:bg-gray-00"
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Press ⌘C' : 'Copy'}
    </button>
  )
}
