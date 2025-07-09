'use client';
import { useState } from 'react';
import useMCP from '../hooks/useMCP';

export default function MCPDocsPanel() {
  const { search, fetchDocs, results, documents } = useMCP();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) search(query.trim());
  };

  return (
    <div className="border-t border-gray-200 p-2 text-sm">
      <form onSubmit={handleSearch} className="flex gap-2 mb-2">
        <input
          className="border px-2 py-1 flex-1"
          placeholder="Search docs..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="border px-3 py-1" type="submit">
          Search
        </button>
      </form>
      {results.length > 0 && (
        <ul className="mb-2">
          {results.map((id) => (
            <li key={id}>
              <button className="underline text-blue-600" onClick={() => fetchDocs([id])}>
                {id}
              </button>
            </li>
          ))}
        </ul>
      )}
      {documents.map((doc) => (
        <div key={doc.id} className="mb-2">
          <div className="font-semibold">{doc.title}</div>
          <div className="text-xs whitespace-pre-wrap">{doc.content}</div>
        </div>
      ))}
    </div>
  );
}
