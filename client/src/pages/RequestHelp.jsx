import RequestForm from './RequestForm.jsx'
import { useState } from 'react'
import MapView from './MapView.jsx'

export default function RequestHelp({ navigate, socketData }) {
  const requestsToday = socketData?.stats?.requestsToday || 0
  const criticalPending = socketData?.stats?.criticalCount || 0
  const avgResponse = socketData?.stats?.avgResponseMin || 23
  const [previewPoint, setPreviewPoint] = useState(null)
  const [previewZone, setPreviewZone] = useState(null)

  return (
    <section className="bg-background text-on-surface min-h-screen pt-24 pb-8">
      <div className="max-w-screen-2xl mx-auto px-6 xl:px-10 space-y-8">
        <header className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-5">
          <div className="space-y-1">
            <p className="text-primary text-xs tracking-[0.22em] font-extrabold uppercase">Request Operations</p>
            <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-on-surface">Relief Intake Console</h1>
            <p className="text-on-surface-variant text-sm md:text-base">
              Guided intake, AI triage, and rapid dispatch recommendations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => navigate('map')} className="btn-primary">
              Open Live Map
            </button>
            <button onClick={() => navigate('ngo')} className="btn-ghost">
              NGO Command Center
            </button>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,58%)_minmax(0,42%)] items-start">
          <div className="bg-surface-container-lowest rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
            <RequestForm onPreviewLocation={setPreviewPoint} onPreviewZone={setPreviewZone} />
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <article className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Today</p>
                <p className="font-headline text-3xl font-extrabold text-primary">{requestsToday}</p>
                <p className="text-xs text-on-surface-variant">Requests</p>
              </article>
              <article className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Critical</p>
                <p className="font-headline text-3xl font-extrabold text-tertiary">{criticalPending}</p>
                <p className="text-xs text-on-surface-variant">Pending</p>
              </article>
              <article className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Response</p>
                <p className="font-headline text-3xl font-extrabold text-secondary">{avgResponse}m</p>
                <p className="text-xs text-on-surface-variant">Average</p>
              </article>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm">
              <MapView socketData={socketData} previewPoint={previewPoint} previewZone={previewZone} />
            </div>

            <div className="bg-surface-container-low rounded-3xl p-6 border border-slate-200">
              <h3 className="font-headline font-extrabold text-xl mb-2">What happens after submit?</h3>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                <li>1. AI computes urgency score and required resource type.</li>
                <li>2. Nearby NGOs and volunteers are auto-ranked by availability.</li>
                <li>3. You receive status updates by SMS and dashboard tracking.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

