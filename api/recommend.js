const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mood, language, industry, genre, duration, social } = req.body;

  const industryMap = {
    'Bollywood': 'Indian Hindi-language film industry. Movies must be in Hindi and made in India.',
    'Hollywood': 'American English-language film industry. Movies must be in English and made in USA/UK.',
    'Tollywood': 'Telugu-language Indian film industry. Movies must be in Telugu and made in India.'
  };

  const durationRule = duration
    ? duration.includes('Short')
      ? 'Movie runtime MUST be less than 120 minutes.'
      : 'Movie runtime MUST be 120 minutes or more.'
    : '';

  const noHollywood = industry === 'Hollywood' ? '- Do NOT suggest any Bollywood/Hindi movies like ZNMD, 3 Idiots, Kabir Singh etc.' : '';
  const noBollywood = industry === 'Bollywood' ? '- Do NOT suggest any Hollywood/English movies like Titanic, Avengers etc.' : '';
  const noNonEnglish = language === 'English' ? '- Do NOT suggest Hindi, Telugu or any non-English movies.' : '';
  const noNonHindi = language === 'Hindi' ? '- Do NOT suggest English, Telugu or any non-Hindi movies.' : '';

  const prompt = `You are a movie recommendation engine. Return exactly 5 movie recommendations as a JSON array.

ACTIVE FILTERS - FOLLOW ALL STRICTLY:
${mood ? 'MOOD: ' + mood + ' - All movies must suit a ' + mood + ' mood.' : ''}
${language ? 'LANGUAGE: ' + language + ' - Every movie MUST be in ' + language + ' ONLY. Reject any movie not in ' + language + '.' : ''}
${industry ? 'INDUSTRY: ' + industry + ' - Every movie MUST be from ' + industry + ' ONLY. ' + (industryMap[industry] || '') + ' Reject any movie from a different industry.' : ''}
${genre ? 'GENRE: ' + genre + ' - Every movie MUST be ' + genre + ' genre.' : ''}
${durationRule ? 'DURATION: ' + durationRule : ''}
${social ? 'CONTEXT: ' + social + ' - Movies must be appropriate for ' + social + '.' : ''}

VALIDATION - CHECK EVERY MOVIE:
${language ? '- Is this movie in ' + language + '? If NO, REJECT IT.' : ''}
${industry ? '- Is this movie from ' + industry + '? If NO, REJECT IT.' : ''}
${noHollywood}
${noBollywood}
${noNonEnglish}
${noNonHindi}

OUTPUT: Respond with ONLY a raw JSON array, no markdown, no explanation.
Each object: title (string), year (string), rating (string like 8.2), genres (array), synopsis (2-3 sentences), reason (1 sentence).
Start with [ and end with ].`;

  const apiKey = process.env.GEMINI_API_KEY;
  const postData = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 1500 }
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  try {
    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error('Gemini error ' + response.statusCode + ': ' + data));
          } else {
            resolve(data);
          }
        });
      });
      request.on('error', reject);
      request.write(postData);
      request.end();
    });

    const parsed = JSON.parse(result);
    const text = parsed.candidates[0].content.parts[0].text.trim();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('No JSON array in response');
    const movies = JSON.parse(text.substring(start, end + 1));
    return res.status(200).json({ movies });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
