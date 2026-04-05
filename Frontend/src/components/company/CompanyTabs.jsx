export default function CompanyTabs({ companies, selectedId, onSelect, onAddClick, onDelete }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {companies.map((company) => (
        <div key={company.id} className="relative inline-flex items-center">
          <button
            onClick={() => onSelect(company)}
            className={`rounded-lg py-2.5 pl-5 pr-10 text-base font-medium transition-colors ${
              selectedId === company.id
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {company.name}
            <span className="ml-2 text-sm font-normal opacity-70">
              {company.currency === 'PHP' ? '(PHP ₱)' : '(USD $)'}
            </span>
          </button>
          <button
            onClick={() => onDelete(company)}
            title="Delete company"
            className={`absolute right-2 flex h-6 w-6 items-center justify-center rounded-full text-sm transition-colors ${
              selectedId === company.id
                ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                : 'text-gray-400 hover:bg-red-100 hover:text-red-600'
            }`}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={onAddClick}
        className="rounded-lg border border-dashed border-gray-400 px-5 py-2.5 text-base font-medium text-gray-500 transition-colors hover:border-gray-600 hover:text-gray-700"
      >
        + Add Company
      </button>
    </div>
  );
}
