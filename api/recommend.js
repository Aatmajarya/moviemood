export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mood, language, industry, genre, duration, social } = req.body;

  const industryMap = {
    'Bollywood': 'Indian Hindi-language film industry. Movies must be in Hindi and made in India.',
    'Hollywood': 'American English-language film industry. Movies must be in English and made in USA/UK.',
    'Tollywood': 'Telugu-language Indian film industry. Movies must be in Telugu and made in India.'
  };

  const durationRule = duration
    ? duration.includes('Short')
      ? 'Movie runtime MUST be less than 120 minutes (under 2 hours).'
      : 'Movie runtime MUST be 120 minutes or more (2 hours or longer).'
    : '';

  const prompt = `You are a movie recommendation engine. Return exactly 5 movie recommendations as a JSON array.

==== ACTIVE FILTERS (YOU MUST FOLLOW ALL OF THESE STRICTLY) ====
${mood ? `MOOD: ${mood} — All movies must suit a ${mood} mood.` : ''}
${language ? `LANGUAGE: ${language} — Every single movie MUST be in ${language} language ONLY. Reject any movie not in ${language}.` : ''}
${industry ? `INDUSTRY: ${industry} — Every single movie MUST be from ${industry} ONLY. ${industryMap[industry] || ''} Reject any movie from a different industry.` : ''}
${genre ? `GENRE: ${genre} — Every single movie MUST be ${genre} genre. Reject any movie that is not ${genre}.` : ''}
${durationRule ? `DURATION: ${durationRule}` : ''}
${social ? `SOCIAL CONTEXT: ${social} — Movies must be appropriate for ${social}.` : ''}

==== VALIDATION CHECKLIST (apply to EVERY movie before including it) ====
${language ? `✓ Is this movie in ${language}? If NO → REJECT IT.` : ''}
${industry ? `✓ Is this movie from ${industry}? If NO → REJECT IT.` : ''}
${genre ? `✓ Is this movie ${genre} genre? If NO → REJECT IT.` : ''}
${durationRule ? `✓ Does this movie match the duration rule? If NO → REJECT IT.` : ''}

==== EXAMPLES OF WHAT NOT TO DO ====
${industry === 'Hollywood' ? '- Do NOT suggest Bollywood movies like DDLJ, Kabir Singh, 3 Idiots, Zindagi Na Milegi Dobara etc.' : ''}
${industry === 'Bollywood' ? '- Do NOT suggest Hollywood movies like Titanic, Avengers, The Notebook etc.' : ''}
${language === 'English' ? '- Do NOT suggest Hindi, Telugu, Tamil or any non-English language movies.' : ''}
${language === 'Hindi' ? '- Do NOT suggest English, Telugu, Tamil or any non-Hindi language movies.' : ''}

==== OUTPUT FORMAT ====
Respond with ONLY a raw JSON array. No markdown, no explanation, no code blocks.
Each object must have: title (string), year (string), rating (string like "8.2"), genres (array of strings), synopsis (2-3 sentences), reason (1 sentence why it matches all the selected filters).

OUTPUT ONLY THE JSON ARRAY STARTING WITH [ AND ENDING WITH ].`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1500 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(500).json({ error: `Gemini error: ${geminiRes.status}`, details: errText });
    }

    const data = await geminiRes.json();
    const text = data.candidates[0].content.parts[0].text.trim();

    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array in response');

    const movies = JSON.parse(text.substring(start, end + 1));
    return res.status(200).json({ movies });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
