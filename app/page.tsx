import { AudioRecorder } from '@/components/audio-recorder'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-4">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Dictanote</h1>
          <p className="text-slate-500">AI-powered Dictation & Correction</p>
        </header>

        <AudioRecorder />
      </div>
    </main>
  )
}
