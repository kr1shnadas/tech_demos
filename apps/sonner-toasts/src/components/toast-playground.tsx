import { PartyPopperIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Alternates so the promise toast demonstrates both the resolve and the
// reject path. Each click gets its own promise, so concurrent in-flight
// clicks stay independent.
let promiseClicks = 0

function loadDemoData() {
  const shouldFail = promiseClicks % 2 === 1
  promiseClicks += 1
  const promise = wait(1500).then(() => {
    if (shouldFail) throw new Error("demo failure")
    return { name: "demo data" }
  })
  // Sonner attaches its own handlers, but keep an explicit catch so the
  // rejection can never surface as an unhandled promise rejection.
  promise.catch(() => {})
  return promise
}

const triggers = [
  {
    label: "Default",
    variant: "secondary",
    fire: () => toast("Event has been created"),
  },
  {
    label: "Success",
    variant: "default",
    fire: () => toast.success("Everything worked!"),
  },
  {
    label: "Error",
    variant: "destructive",
    fire: () => toast.error("Something went wrong"),
  },
  {
    label: "Warning",
    variant: "outline",
    fire: () => toast.warning("Disk space is running low"),
  },
  {
    label: "Info",
    variant: "outline",
    fire: () => toast.info("Here is some information"),
  },
  {
    label: "Promise",
    variant: "default",
    fire: () =>
      toast.promise(loadDemoData(), {
        loading: "Loading demo data…",
        success: (data) => `Loaded ${data.name} successfully`,
        error: "Failed to load demo data",
      }),
  },
  {
    label: "Action",
    variant: "secondary",
    fire: () =>
      toast("File deleted", {
        action: {
          label: "Undo",
          onClick: () => toast.success("Delete undone"),
        },
      }),
  },
  {
    label: "Rich",
    variant: "outline",
    fire: () =>
      toast("New release available", {
        description: "v2.0 ships dark mode, faster builds, and bug fixes.",
        icon: <PartyPopperIcon className="size-4" />,
        duration: 6000,
      }),
  },
] as const

export function ToastPlayground() {
  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {triggers.map(({ label, variant, fire }) => (
          <Button key={label} variant={variant} onClick={fire}>
            {label}
          </Button>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Promise takes ~1.5s and alternates between success and failure.
        Action shows an Undo button.
      </p>
    </section>
  )
}
