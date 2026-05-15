// Block all forms of auto-refresh
if (typeof window !== 'undefined') {
  console.log('🚫 Blocking all auto-refresh mechanisms');
  
  // Block WebSocket connections used by Next.js HMR
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    if (url && (url.includes('webpack-hmr') || url.includes('_next'))) {
      console.log('🚫 Blocking WebSocket:', url);
      return {
        close: () => {},
        send: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        readyState: 3, // CLOSED
        CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3
      };
    }
    return new originalWebSocket(url, protocols);
  };
  window.WebSocket.prototype = originalWebSocket.prototype;
  Object.setPrototypeOf(window.WebSocket, originalWebSocket);
  
  // Block EventSource connections
  const originalEventSource = window.EventSource;
  window.EventSource = function(url, eventSourceInitDict) {
    if (url && (url.includes('webpack') || url.includes('hot'))) {
      console.log('🚫 Blocking EventSource:', url);
      return {
        close: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        readyState: 2 // CLOSED
      };
    }
    return new originalEventSource(url, eventSourceInitDict);
  };
  
  // Block automatic page reloads
  const originalReload = window.location.reload;
  window.location.reload = function(forcedReload) {
    console.log('🚫 Blocking automatic page reload');
    return false;
  };
  
  // Block fetch requests that trigger refresh
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    if (url && (url.includes('__webpack') || url.includes('hot') || url.includes('reload'))) {
      console.log('🚫 Blocking refresh request:', url);
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    return originalFetch.call(this, input, init);
  };
  
  console.log('✅ Auto-refresh completely blocked');
}
