module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const { mood, language, industry, duration } = req.body;

  const moodRules = {
    happy: {
      description: 'Feel-good, uplifting, fun, cheerful, comedy, light-hearted, heartwarming movies that make you smile and laugh.',
      include: 'comedies, feel-good dramas, uplifting stories, fun adventures, heartwarming films',
      exclude: 'tragedy, death, grief, depression, dark themes, sad endings, heavy emotional films like Masaan, Devdas, Titanic, Schindler List etc.'
    },
    sad: {
      description: 'Emotional, melancholic, tearjerker movies with heavy themes, loss, grief, heartbreak.',
      include: 'tearjerkers, emotional dramas, tragic love stories, films about loss and grief',
      exclude: 'comedies, action blockbusters, light-hearted films, superhero movies'
    },
    romantic: {
      description: 'Love stories, romance, chemistry between characters, beautiful relationships.',
      include: 'romantic comedies, love stories, films with strong romantic chemistry',
      exclude: 'horror, action without romance, sad endings without love arc'
    },
    nostalgic: {
      description: 'Classic films, retro vibes, coming of age stories, films that remind you of simpler times.',
      include: 'classic films, coming of age stories, films set in past decades, childhood memories',
      exclude: 'recent releases, futuristic films, modern fast-paced action'
    }
  };

  const currentMood = moodRules[mood] || {};

  const prompt = [
    'You are a strict movie recommendation expert. Suggest exactly 5 movies.',
    '',
    mood && `MOOD FILTER (MOST IMPORTANT): ${mood.toUpperCase()}`,
    mood && `What this mood means: ${currentMood.description}`,
    mood && `INCLUDE movies that are: ${currentMood.include}`,
    mood && `STRICTLY EXCLUDE: ${currentMood.exclude}`,
    mood && `If a movie does not match the ${mood} mood, REJECT IT immediately.`,
    '',
    language && `LANGUAGE: ${language} only - REJECT any movie not in ${language}`,
    industry && `INDUSTRY: ${industry} only - REJECT any movie not from ${industry}`,
    industry === 'Hollywood' && 'Do NOT suggest any Hindi/Bollywood movies under any circumstances. Hollywood = English language American/British films ONLY.',
    industry === 'Bollywood' && 'Do NOT suggest any English/Hollywood movies under any circumstances. Bollywood = Hindi language Indian films ONLY.',
    (industry === 'Hollywood' && language === 'Hindi') && 'CONFLICT DETECTED: Hollywood films are in English not Hindi. Treat language as English and suggest Hollywood English films.',
    (industry === 'Bollywood' && language === 'English') && 'CONFLICT DETECTED: Bollywood films are in Hindi not English. Treat language as Hindi and suggest Bollywood Hindi films.',
    language === 'English' && 'Do NOT suggest Hindi, Telugu or any non-English movies',
    language === 'Hindi' && 'Do NOT suggest English, Telugu or any non-Hindi movies',
    duration && duration.includes('Short') && 'DURATION: under 2 hours only',
    duration && duration.includes('Long') && 'DURATION: 2 hours or longer only',
    '',
    'Return ONLY a JSON array with no markdown or explanation.',
    'Each item must have: title, year, rating, genres (array), synopsis, reason.',
    `Be creative and diverse. Explore lesser known gems too. Random seed: ${Math.floor(Math.random() * 99999)}`,
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
        temperature: 1.0,
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
