const MAX_BODY_BYTES = 16 * 1024;
const MAX_TEXT_LENGTH = 4000;

function reply(response, status, payload) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error('payload_too_large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return reply(response, 405, { ok: false, reason: 'method_not_allowed' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    return reply(response, 503, { ok: false, reason: 'relay_not_configured' });
  }

  const authorization = request.headers.authorization || '';
  if (authorization !== `Bearer ${botToken}`) {
    return reply(response, 401, { ok: false, reason: 'unauthorized' });
  }

  let input;
  try {
    input = JSON.parse(await readBody(request));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid_json';
    return reply(response, reason === 'payload_too_large' ? 413 : 400, {
      ok: false,
      reason: reason === 'payload_too_large' ? reason : 'invalid_json',
    });
  }

  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return reply(response, 400, { ok: false, reason: 'invalid_text' });
  }

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    const telegramResult = await telegramResponse.json().catch(() => ({}));
    if (!telegramResponse.ok) {
      const description = String(telegramResult.description || '').toLowerCase();
      const reason = description.includes('chat not found')
        ? 'chat_not_found'
        : description.includes('unauthorized')
          ? 'telegram_unauthorized'
          : description.includes("can't initiate conversation")
            ? 'conversation_not_started'
          : description.includes("can't send messages to the user")
            ? 'cannot_message_user'
          : description.includes("bots can't send messages to bots")
            ? 'recipient_is_bot'
          : description.includes('bot was blocked') || description.includes('bot blocked by user')
            ? 'bot_blocked'
            : description.includes('not enough rights')
              ? 'insufficient_chat_rights'
              : description.includes('not a member of')
                ? 'bot_not_chat_member'
                : description.includes('was kicked from') || description.includes('bot was kicked')
                  ? 'bot_kicked_from_chat'
            : description.includes('user is deactivated')
              ? 'user_deactivated'
              : telegramResponse.status === 403
                ? 'telegram_forbidden'
            : `telegram_http_${telegramResponse.status}`;
      return reply(response, 502, { ok: false, reason });
    }
    return reply(response, 200, { ok: true });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'telegram_timeout'
        : 'telegram_unreachable';
    return reply(response, 502, { ok: false, reason });
  }
}
