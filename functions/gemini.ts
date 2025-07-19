// /functions/gemini.ts
import { Hono } from 'hono';

const app = new Hono();

app.post('/ask', async (c) => {
  const { prompt } = await c.req.json();
  const apiKey = c.env.GEMINI_API_KEY;

  if (!apiKey) {
    return c.json({ error: 'API_KEY غير مُكوَّن.' }, 500);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();
  return c.json(data);
});

export default app;