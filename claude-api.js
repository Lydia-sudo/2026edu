'use strict';

// Claude API 호출 유틸리티
// "messages: text content blocks must be non-empty" 오류 방지를 위해
// 빈 text block을 전송 전에 필터링합니다.

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * messages 배열에서 빈 text content block을 제거합니다.
 * @param {Array} messages
 * @returns {Array}
 */
function sanitizeMessages(messages) {
  return messages
    .map(msg => {
      if (typeof msg.content === 'string') {
        return msg;
      }
      if (Array.isArray(msg.content)) {
        const filtered = msg.content.filter(block => {
          if (block.type === 'text') return block.text && block.text.trim() !== '';
          return true;
        });
        if (filtered.length === 0) return null;
        return { ...msg, content: filtered };
      }
      return msg;
    })
    .filter(Boolean);
}

/**
 * Claude API 메시지 전송
 * @param {string} apiKey - Anthropic API 키
 * @param {Array}  messages - 대화 메시지 배열
 * @param {object} options  - 추가 옵션 (model, max_tokens 등)
 * @returns {Promise<object>}
 */
async function sendMessage(apiKey, messages, options = {}) {
  const sanitized = sanitizeMessages(messages);

  if (sanitized.length === 0) {
    throw new Error('전송할 유효한 메시지가 없습니다. (모든 content block이 비어 있습니다)');
  }

  const body = {
    model:      options.model      ?? 'claude-sonnet-4-6',
    max_tokens: options.max_tokens ?? 1024,
    messages:   sanitized,
    ...(options.system ? { system: options.system } : {}),
  };

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API 오류 ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json();
}

// Node.js 환경에서 사용 시 export
if (typeof module !== 'undefined') {
  module.exports = { sendMessage, sanitizeMessages };
}
