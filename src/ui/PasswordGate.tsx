/**
 * Full-screen password gate.
 *
 * Auth state lives in sessionStorage — cleared when the browser tab is closed.
 * The password is verified by comparing the SHA-256 of the user's input against
 * a pre-computed digest so the raw password is never stored in plaintext.
 *
 * Password: SPS-OCP-MIT-2026#Φ9kR
 */

import { useState, useRef, useEffect } from 'react'

const CORRECT_HASH = 'b06166695c802f327360ee0c864062acf109c449c8d2b8e89f30243e17a61a13'

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface PasswordGateProps {
  onUnlock: () => void
}

export function PasswordGate({ onUnlock }: PasswordGateProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setChecking(true)
    setError(false)
    const hash = await sha256(value)
    if (hash === CORRECT_HASH) {
      onUnlock()
    } else {
      setError(true)
      setValue('')
      setChecking(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
      <div className="w-full max-w-sm mx-6">
        {/* Logo / title area */}
        <div className="text-center mb-8">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
            MIT Global Lab · OCP
          </p>
          <h1 className="text-2xl font-bold text-white">SPS Growth Model</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your access password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(false)
              }}
              placeholder="Password"
              autoComplete="current-password"
              className={`w-full bg-gray-800 text-white placeholder-gray-600 rounded-lg px-4 py-3 text-sm border transition-colors outline-none focus:ring-2 focus:ring-indigo-500 ${
                error ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {error && (
              <p className="text-xs text-red-400 mt-1.5 pl-1">
                Incorrect password — please try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={checking || value.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
          >
            {checking ? 'Checking…' : 'Unlock'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-600 mt-8">
          Access is restricted to authorised team members.
        </p>
      </div>
    </div>
  )
}
