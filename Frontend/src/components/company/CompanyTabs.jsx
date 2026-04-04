export default function CompanyTabs({ companies, selectedId, onSelect, onAddClick, onDelete }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {companies.map((company) => (
        <div key={company.id} className="relative inline-flex items-center">
          <button
            onClick={() => onSelect(company)}
            className={`rounded-lg py-2 pl-4 pr-8 text-sm font-medium transition-colors ${
              selectedId === company.id
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {company.name}
          </button>
          <button
            onClick={() => onDelete(company)}
            title="Delete company"
            className={`absolute right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-xs transition-colors ${
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
        className="rounded-lg border border-dashed border-gray-400 px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-gray-600 hover:text-gray-700"
      >
        + Add Company
      </button>
    </div>
  );
}
