import { LearnMoreButton } from '@/components/learn-more-button'
import { StorageCidPanel } from '@/components/storage-cid-panel'
import { StorageNetwork } from '@/components/storage-network'
import { readExplainer } from '@/demos/explainer'
import { findDemo } from '@/demos/registry'

const DEMO_HREF = '/storage'

function SectionHeading({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-h4-sans text-brand-dark-green">{title}</h2>
      <p className="text-body-sans text-gray-05">{children}</p>
    </div>
  )
}

export default function Page() {
  const demo = findDemo(DEMO_HREF)
  if (!demo) throw new Error(`No demo registered for ${DEMO_HREF}`)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12 md:py-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-h3-sans text-brand-dark-green">{demo.label}</h1>
        </div>
        <LearnMoreButton
          body={readExplainer('storage')}
          title="How this works"
        />
      </header>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Give a file its address">
          A file&rsquo;s CID is a pure function of its bytes, so this page can
          work it out without asking the network. The answer matches what a
          Logos Storage node returns.
        </SectionHeading>
        <StorageCidPanel />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Who runs the network">
          The published roster, with each node located live.
        </SectionHeading>
        <StorageNetwork />
      </section>
    </div>
  )
}
