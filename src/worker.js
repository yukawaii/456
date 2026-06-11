export default {
  async fetch(request, env) {
    // Добавляем CORS-заголовки для всех ответов
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Обрабатываем preflight-запрос (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // Разрешаем только POST-запросы
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers });
    }

    try {
      const body = await request.json();
      const { user_id, score, action } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id required' }), { 
          status: 400,
          headers
        });
      }

      const STORAGE_KEY = `score_${user_id}`;

      if (action === 'get') {
        const savedScore = await env.TETRIS_KV.get(STORAGE_KEY);
        return new Response(JSON.stringify({ score: savedScore ? parseInt(savedScore, 10) : 0 }), { headers });
      }

      if (action === 'set' && score !== undefined) {
        const currentScore = parseInt(score, 10);
        const savedScore = await env.TETRIS_KV.get(STORAGE_KEY);
        const oldScore = savedScore ? parseInt(savedScore, 10) : 0;

        if (currentScore > oldScore) {
          await env.TETRIS_KV.put(STORAGE_KEY, String(currentScore));
          return new Response(JSON.stringify({ success: true, old: oldScore, new: currentScore }), { headers });
        } else {
          return new Response(JSON.stringify({ success: false, reason: 'not greater', current: oldScore }), { headers });
        }
      }

      return new Response(JSON.stringify({ error: 'invalid action' }), { status: 400, headers });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
  }
};