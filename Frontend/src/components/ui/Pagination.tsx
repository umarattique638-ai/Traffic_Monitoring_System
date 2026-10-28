type Props = {
  page: number
  totalPages: number
  onChange: (page: number) => void
}

// Previous / Next with "Page 2 of 5". Hidden when there is only one page.
function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null

  return (
    <div className='mt-4 flex items-center gap-3 text-sm'>
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className='rounded border px-3 py-1 disabled:opacity-40 cursor-pointer'
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className='rounded border px-3 py-1 disabled:opacity-40 cursor-pointer'
      >
        Next
      </button>
    </div>
  )
}

export default Pagination
