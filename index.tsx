
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical Render Error:", error);
  rootElement.innerHTML = `<div style="color: white; padding: 20px; font-family: sans-serif;">
    <h2>System Error</h2>
    <p>Failed to initialize application core. Please check your network connection or API configuration.</p>
    <pre style="font-size: 10px; opacity: 0.5;">${error instanceof Error ? error.message : 'Unknown error'}</pre>
  </div>`;
}
