// Clean browser fetch shim to prevent cross-fetch ponyfill conflicts and gracefully handle telemetry endpoints
const nativeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch;

function isTelemetryUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('pulse.walletconnect') ||
    url.includes('cca-lite') ||
    url.includes('coinbase.com') ||
    url.includes('analytics') ||
    url.includes('telemetry') ||
    url.includes('traces') ||
    url.includes('events') ||
    url.includes('datadog')
  );
}

export const fetch: typeof globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input?.url || '';
  
  // Return successful dummy response for third-party telemetry to prevent network failures in sandboxed iframes
  if (isTelemetryUrl(url)) {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    return await nativeFetch(input, init);
  } catch (err) {
    if (isTelemetryUrl(url) || url.includes('walletconnect') || url.includes('web3modal')) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw err;
  }
};

export const Headers = typeof window !== 'undefined' ? window.Headers : globalThis.Headers;
export const Request = typeof window !== 'undefined' ? window.Request : globalThis.Request;
export const Response = typeof window !== 'undefined' ? window.Response : globalThis.Response;

export default fetch;
