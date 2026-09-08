'use client'

import { useCallback, useRef, useState } from 'react'

import { CopyButton } from '@/components/copy-button'
import { useCidCompute } from '@/components/use-cid-compute'
import { StorageProofPanel } from '@/components/storage-proof-panel'
import { BLOCK_SIZE, toHex } from '@/lib/storage-cid'

const readableSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

/** One name/value pair. A real term and definition, not two styled spans. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-label text-gray-05">{label}</dt>
      <dd className="text-h4-sans text-brand-dark-green">{value}</dd>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label text-gray-05">{label}</span>
      <code className="text-mono-body break-all text-gray-06">{value}</code>
    </div>
  )
}

/** The merkle levels, leaves at the bottom, so the fold is visible. */
function TreeLevels({ levels }: { levels: Uint8Array[][] }) {
  return (
    <ol className="flex flex-col-reverse gap-2">
      {levels.map((level, index) => (
        <li key={index} className="flex flex-wrap items-baseline gap-2">
          <span className="text-label w-24 shrink-0 text-gray-05">
            {index === 0
              ? `${level.length} leaves`
              : index === levels.length - 1
                ? 'root'
                : `level ${index}`}
          </span>
          <div className="flex flex-wrap gap-1">
            {level.map((digest, position) => {
              const hex = toHex(digest)
              return (
                <code
                  key={`${index}-${position}`}
                  title={hex}
                  className="text-mono-body border border-gray-01 bg-white px-1.5 py-0.5 text-gray-06"
                >
                  {hex.slice(0, 8)}
                </code>
              )
            })}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function StorageCidPanel() {
  const { file, isComputing, error, compute, reset } = useCidCompute()
  const [isOver, setIsOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const take = useCallback(
    (picked: File | undefined) => {
      if (!picked) return
      void compute(picked)
    },
    [compute]
  )

  return (
    <section className="flex flex-col gap-4">
      <div
        data-dropzone
        onDragOver={(event) => {
          event.preventDefault()
          setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsOver(false)
          take(event.dataTransfer.files[0])
        }}
        className={`flex flex-col items-center gap-2 border border-dashed p-8 text-center transition-colors ${
          isOver
            ? 'border-brand-dark-green bg-gray-00'
            : 'border-gray-02 bg-white'
        }`}
      >
        <p className="text-body-sans text-gray-06">
          Drop a file to see the CID Logos Storage would give it.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-body-sans cursor-pointer border border-gray-02 bg-white px-3 py-1.5 text-brand-dark-green hover:bg-gray-00"
        >
          Choose a file
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(event) => take(event.target.files?.[0])}
        />
        <p className="text-body-sans text-gray-05">
          The file is read in this tab and never sent anywhere.
        </p>
      </div>

      {isComputing && <p className="text-body-sans text-gray-05">Hashing…</p>}

      {error && <p className="text-body-sans text-red">{error}</p>}

      {file && (
        <div className="flex flex-col gap-5 border border-gray-01 bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-h4-sans text-brand-dark-green break-all">
              {file.name}
            </span>
            <button
              type="button"
              onClick={reset}
              className="text-body-sans cursor-pointer text-gray-05 underline"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-label text-gray-05">Content address</span>
            <div className="flex items-start gap-2">
              <code className="text-mono-body min-w-0 break-all text-gray-06">
                {file.breakdown.cid}
              </code>
              <CopyButton
                value={file.breakdown.cid}
                label="Copy the content address"
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Size"
              value={readableSize(file.breakdown.datasetSize)}
            />
            <Stat label="Blocks" value={String(file.breakdown.blockCount)} />
            <Stat label="Block size" value={`${BLOCK_SIZE / 1024} KB`} />
            <Stat label="Type" value={file.mimetype ?? 'none'} />
          </dl>

          {file.mimetype === null && (
            <p className="text-body-sans text-gray-05">
              {file.reportedMimetype
                ? `Your browser calls this ${file.reportedMimetype}, which a Logos Storage node refuses: it only accepts a file type it can map to a file extension.`
                : 'Your browser could not name a file type for this.'}{' '}
              Uploading with no type is allowed, and the node then records none,
              so that is the upload this address describes.
            </p>
          )}

          <Row label="Tree root" value={file.breakdown.treeCid} />

          <div className="flex flex-col gap-2">
            <span className="text-label text-gray-05">Merkle tree</span>
            <TreeLevels levels={file.breakdown.levels} />
          </div>

          <StorageProofPanel breakdown={file.breakdown} />
        </div>
      )}
    </section>
  )
}
