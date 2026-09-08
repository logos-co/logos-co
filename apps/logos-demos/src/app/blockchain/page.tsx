import { ChainSearch } from '@/components/chain-search'
import { ChainView } from '@/components/chain-view'
import { LearnMoreButton } from '@/components/learn-more-button'
import { readExplainer } from '@/demos/explainer'
import { demoMetadata } from '@/demos/metadata'
import { findDemo } from '@/demos/registry'

const DEMO_HREF = '/blockchain'

export const metadata = demoMetadata(DEMO_HREF)

export default function Page() {
  const demo = findDemo(DEMO_HREF)
  if (!demo) throw new Error(`No demo registered for ${DEMO_HREF}`)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 md:py-16">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-h3-sans text-brand-dark-green">{demo.label}</h1>
        </div>
        <LearnMoreButton
          body={readExplainer('blockchain')}
          title="How this works"
        />
      </header>

      <ChainSearch />
      <ChainView />
    </div>
  )
}
