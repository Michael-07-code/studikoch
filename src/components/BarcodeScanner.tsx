import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Hint } from './ui'

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
}

// Deklaration, da die BarcodeDetector-Web-API (Chrome/Edge/Android) noch
// nicht in allen TypeScript-DOM-Typings enthalten ist.
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
    }
  }
}

// Kamera-basierter Barcode-Scanner für EAN/UPC-Produktcodes (z. B. auf
// Lebensmittelverpackungen). Nutzt die BarcodeDetector-API, wo verfügbar;
// sonst bleibt nur die manuelle Eingabe des Barcodes darunter.
export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')
  const supported =
    typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    let rafId = 0

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const Detector = window.BarcodeDetector
        if (!Detector) return
        const detector = new Detector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'],
        })

        async function tick() {
          if (cancelled || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              onDetected(codes[0].rawValue)
              return
            }
          } catch {
            // einzelner Frame fehlgeschlagen – einfach weiter versuchen
          }
          rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)
      } catch {
        setError(
          'Kamera konnte nicht gestartet werden. Prüfe die Berechtigung im Browser.',
        )
      }
    }
    start()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = manualCode.trim()
    if (trimmed) onDetected(trimmed)
  }

  return (
    <div className="space-y-3 rounded-2xl border border-stone-200/70 dark:border-stone-700/70 bg-white dark:bg-stone-900 p-4 shadow-card">
      {supported ? (
        <div className="overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="w-full" muted playsInline />
        </div>
      ) : (
        <Hint>
          Automatisches Scannen wird von diesem Browser nicht unterstützt –
          Barcode unten manuell eingeben.
        </Hint>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Barcode manuell eingeben"
          className="flex-1 rounded-xl border border-stone-200 dark:border-stone-700 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <Button type="submit" size="sm">
          Suchen
        </Button>
      </form>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        Abbrechen
      </Button>
    </div>
  )
}
