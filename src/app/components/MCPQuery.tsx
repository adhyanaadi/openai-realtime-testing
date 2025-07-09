'use client';
import React, { useState } from 'react';
import useMCPClient from '../hooks/useMCPClient';

export default function MCPQuery() {
  const { sendCommand, messages } = useMCPClient();
  const [method, setMethod] = useState('');
  const [params, setParams] = useState('{}');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: any = {};
    try {
      parsed = params ? JSON.parse(params) : {};
    } catch {
      alert('Params must be valid JSON');
      return;
    }
    if (method) sendCommand(method, parsed);
  };

  return (
    <div className="border-t border-gray-200 p-2 text-sm">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-2">
        <input
          className="border px-2 py-1 flex-1"
          placeholder="Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        />
        <input
          className="border px-2 py-1 flex-1"
          placeholder="Params JSON"
          value={params}
          onChange={(e) => setParams(e.target.value)}
        />
        <button className="border px-3 py-1" type="submit">
          Send
        </button>
      </form>
      <div className="max-h-40 overflow-auto bg-gray-50 p-2 text-xs">
        {messages.map((m, i) => (
          <pre key={i} className="mb-1 whitespace-pre-wrap break-words">
            {JSON.stringify(m, null, 2)}
          </pre>
        ))}
      </div>
    </div>
  );
}
