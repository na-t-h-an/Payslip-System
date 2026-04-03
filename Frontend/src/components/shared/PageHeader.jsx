export default function PageHeader({ title }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
        DMA
      </div>
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
    </div>
  );
}
