module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { mood, language, industry, genre, duration, social } = req.body;

  const prompt = [
    'You are a movie expert. Suggest exactly 5 movies.',
    mood && `Mood: ${mood}`,
    language && `Language: ${language} only - reject any movie not in ${language}`,
    industry && `Industry: ${industry} only - reject any movie not from ${industry}`,
    industry === 'Hollywood' && 'Do NOT suggest any Hindi/Bollywood movies under any circumstances',
    industry === 'Bollywood' && 'Do NOT suggest any English/Hollywood movies under any circumstances',
    industry === 'Tollywood' && 'Do NOT suggest any Hindi or English movies under any circumstances',
    language === 'English' && 'Do NOT suggest Hindi, Telugu or any non-English movies',
    language === 'Hindi' && 'Do NOT suggest English, Telugu or any non-Hindi movies',
    genre && `Genre: ${genre}`,
    duration && duration.includes('Short') && 'Duration: under 2 hours only',
    duration && duration.includes('Long') && 'Duration: 2 hours or longer only',
    social && `Watching with: ${social}`,
    '',
    'Return ONLY a JSON array with no markdown or explanation.',
    'Each item must have: title, year, rating, genres (array), synopsis, reason.',
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a movie recommendation expert. Always respond with only a valid JSON array, no markdown, no explanation.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: `Groq ${response.status}: ${data?.error?.message || 'Unknown error'}` });
    }

    const text = data.choices[0].message.content.trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array in response');

    const movies = JSON.parse(text.substring(start, end + 1));
    return res.status(200).json({ movies });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
