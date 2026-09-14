import { ToastPlayground } from "@/components/toast-playground"

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-8 text-foreground">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Sonner toasts
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Click a button to fire a toast.
        </p>
      </div>
      <ToastPlayground />
    </main>
  )
}

export default App
