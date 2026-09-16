(() => {
  const endpoint = 'https://app.agentanium.ru/api/leads';
  const trackingKeys = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'yclid',
    'gclid',
  ];

  function tracking() {
    const query = new URLSearchParams(location.search);
    const values = {};
    trackingKeys.forEach((key) => {
      const value = query.get(key);
      if (value) values[key] = value;
    });
    return values;
  }

  async function send(payload) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        keepalive: true,
        // text/plain keeps this a simple CORS request and avoids a fragile OPTIONS preflight.
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({
          pageUrl: location.href,
          referrer: document.referrer || '',
          ...payload,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`CRM_${response.status}`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  window.AgentaniumLeads = { send, tracking };
})();
