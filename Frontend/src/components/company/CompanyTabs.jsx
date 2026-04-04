export default function CompanyTabs({ companies, selectedId, onSelect, onAddClick }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {companies.map((company) => (
        <button
          key={company.id}
          onClick={() => onSelect(company)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            selectedId === company.id
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {company.name}
        </button>
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
