import { Toaster, toast } from 'sonner'
import './App.css'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function App() {
  const firePromise = () =>
    toast.promise(wait(1500).then(() => ({ name: 'demo data' })), {
      loading: 'Loading demo data…',
      success: (data) => `Loaded ${data.name} successfully`,
      error: 'Failed to load demo data',
    })

  return (
    <main className="playground">
      <h1>Sonner playground</h1>
      <p className="subtitle">
        Click a button to fire a toast. Promise resolves after ~1.5s.
      </p>
      <div className="buttons">
        <button
          type="button"
          className="btn success"
          onClick={() => toast.success('Everything worked!')}
        >
          Success
        </button>
        <button
          type="button"
          className="btn error"
          onClick={() => toast.error('Something went wrong')}
        >
          Error
        </button>
        <button
          type="button"
          className="btn info"
          onClick={() => toast.info('Here is some information')}
        >
          Info
        </button>
        <button type="button" className="btn promise" onClick={firePromise}>
          Promise
        </button>
      </div>
      <Toaster position="bottom-right" richColors />
    </main>
  )
}

export default App
