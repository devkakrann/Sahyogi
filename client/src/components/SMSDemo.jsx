import { useState } from 'react'
import { api } from '../services/api.js'

const SMS_EXAMPLES = [
  'HELP FOOD CRITICAL 282001',
  'HELP SHELTER URGENT 282002',
  'HELP MEDICAL CRITICAL 282003',
  'HELP CLOTHING NORMAL 282001',
]

export default function SMSDemo({ isOpen, onClose }) {
  const [step, setStep] = useState('compose')
  const [phone, setPhone] = useState('9876543210')
  const [message, setMessage] = useState('HELP FOOD URGENT 282001')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [verifyResult, setVerifyResult] = useState(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSend() {
    setLoading(true)
    setError('')

    const { data } = await api.simulateSMS(phone, message)
    if (data) {
      setResponse(data)
      setStep('otp')
      setLoading(false)
      return
    }

    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString()
    setResponse({
      otp: mockOtp,
      reply: `Sahyogi: OTP ${mockOtp} sent. Reply with VERIFY ${mockOtp}.`,
      tmpRequestId: 'DEMO-001',
    })
    setStep('otp')
    setLoading(false)
  }

  async function handleVerify() {
    setLoading(true)
    setError('')

    const { data } = await api.verifySMS(phone, otp, 27.1767, 78.0081)
    if (data) {
      setVerifyResult(data)
      setStep('success')
      setLoading(false)
      return
    }

    if (response?.otp && (otp === response.otp || otp === '123456')) {
      setVerifyResult({
        success: true,
        requestId: 'REQ-DEMO',
        priorityScore: 87,
        matchedNgo: 'Seva Bharti Agra',
        reply: 'Sahyogi: Match found! Seva Bharti Agra will help within 45 min. Request: REQ-DEMO',
      })
      setStep('success')
    } else {
      setError(
        response?.otp
          ? 'Invalid OTP. Use the demo code shown above or type 123456.'
          : 'Invalid OTP. Please enter the code received on your phone.',
      )
    }

    setLoading(false)
  }

  function reset() {
    setStep('compose')
    setOtp('')
    setResponse(null)
    setVerifyResult(null)
    setError('')
  }

  return (
    <div className="fixed inset-0 bg-black/55 z-[9999] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-auto bg-background rounded-3xl shadow-2xl border border-slate-200">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold tracking-wider uppercase text-primary">SMS Gateway Hub</p>
            <p className="text-xs text-slate-500">Offline-friendly disaster intake simulation</p>
          </div>
          <button onClick={onClose} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200">
            Close
          </button>
        </header>

        <div className="p-6 lg:p-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <aside className="space-y-4">
            <div className="bg-surface-container-low rounded-2xl p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">Gateway Online</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  42ms latency
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {SMS_EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => setMessage(example)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-colors ${
                    message === example ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {example}
                </button>
              ))}
            </div>

            {response?.reply ? (
              <div className="bg-surface-container-lowest rounded-2xl border border-slate-200 p-4 space-y-2">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">Last gateway reply</p>
                <p className="font-mono text-sm text-primary break-words">{response.reply}</p>
              </div>
            ) : null}
          </aside>

          <section className="bg-surface-container-low rounded-[2rem] p-6 md:p-8 border border-slate-200 space-y-7">
            <div className="relative flex items-center justify-between max-w-md mx-auto">
              {['Compose', 'OTP', 'Success'].map((label, index) => {
                const active = index === 0 || (index === 1 && step !== 'compose') || (index === 2 && step === 'success')
                return (
                  <div key={label} className="flex flex-col items-center gap-2 z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>
                      {index + 1}
                    </div>
                    <span className={`text-[10px] uppercase tracking-widest font-bold ${active ? 'text-primary' : 'text-slate-400'}`}>{label}</span>
                  </div>
                )
              })}
              <div className="absolute top-5 left-12 right-12 h-0.5 bg-slate-200 -z-0" />
            </div>

            {step === 'compose' ? (
              <div className="space-y-4">
                <h3 className="font-headline text-2xl font-extrabold">Compose Test SMS</h3>
                <div className="space-y-2">
                  <label htmlFor="sms-phone" className="text-xs uppercase tracking-widest font-bold text-slate-500">
                    Phone Number
                  </label>
                  <input
                    id="sms-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-xl border-none bg-white px-4 py-3 focus:ring-2 focus:ring-primary"
                    placeholder="+91 XXXXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sms-message" className="text-xs uppercase tracking-widest font-bold text-slate-500">
                    SMS Content
                  </label>
                  <textarea
                    id="sms-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border-none bg-white px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button onClick={handleSend} disabled={loading} className="w-full bg-primary text-white py-3.5 rounded-xl font-bold active:scale-[0.98] transition-transform">
                  {loading ? 'Sending...' : 'Send To Gateway'}
                </button>
              </div>
            ) : null}

            {step === 'otp' ? (
              <div className="space-y-4">
                <h3 className="font-headline text-2xl font-extrabold">Verify OTP</h3>
                <p className="text-sm text-slate-600">
                  OTP was sent to <span className="font-mono font-bold">{phone}</span>. Enter received OTP or use{' '}
                  <span className="font-mono font-bold">123456</span>.
                </p>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  maxLength={6}
                  className={`w-full rounded-xl border-none bg-white px-4 py-3 font-mono text-center text-2xl tracking-[0.4em] focus:ring-2 ${
                    error ? 'focus:ring-tertiary' : 'focus:ring-primary'
                  }`}
                  placeholder="000000"
                />
                {error ? <p className="text-sm font-semibold text-tertiary">{error}</p> : null}
                <div className="flex gap-3">
                  <button onClick={reset} className="flex-1 rounded-xl bg-slate-200 text-slate-700 py-3 font-bold">
                    Start Over
                  </button>
                  <button onClick={handleVerify} disabled={loading || otp.length < 6} className="flex-1 rounded-xl bg-primary text-white py-3 font-bold disabled:opacity-50">
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 'success' ? (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  </div>
                  <h3 className="font-headline text-2xl font-extrabold">Verification Confirmed</h3>
                  <p className="text-slate-500 font-medium">Relief request has been successfully assigned.</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border-l-4 border-primary">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Matched NGO Partner</p>
                      <p className="font-headline text-lg font-extrabold text-on-surface">{verifyResult?.matchedNgo}</p>
                    </div>
                    <span className="material-symbols-outlined text-primary">verified_user</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-white rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Request ID</p>
                      <p className="font-mono text-primary font-bold">{verifyResult?.requestId}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority Score</p>
                      <p className="font-mono text-primary font-bold">{verifyResult?.priorityScore}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Final SMS Reply</p>
                    <p className="font-mono text-sm text-slate-700 break-words">{verifyResult?.reply}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={reset} className="flex-1 rounded-xl bg-slate-200 text-slate-700 py-3 font-bold">
                    Run Again
                  </button>
                  <button onClick={onClose} className="flex-1 rounded-xl bg-primary text-white py-3 font-bold">
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}

