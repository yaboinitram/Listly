import { useState } from 'react';

export default function Popup() {
  const [status, setStatus] = useState('Not checked');

  async function checkApi() {
    try {
      const res = await fetch('http://localhost:3000/health');
      const data = await res.json();
      setStatus(`API: ${data.status}, DB: ${data.database}`);
    } catch {
      setStatus('Cannot reach API');
    }
  }

  return (
    <div style={{ width: 280, padding: 16, fontFamily: 'sans-serif' }}>
      <h3>Listly</h3>
      <button onClick={checkApi}>Check API</button>
      <p>{status}</p>
    </div>
  );
}