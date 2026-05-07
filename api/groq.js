// Vercel Serverless Function — Proxy Groq API
// Résout le problème CORS et sécurise la clé API Groq côté serveur

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  var apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Clé API Groq non configurée (variable GROQ_API_KEY manquante)'
    });
  }

  try {
    var body = req.body;

    // Convertir le format Anthropic → format Groq si nécessaire
    // (ton predict envoie au format Anthropic, on traduit ici)
    var groqBody;

    if (body.messages && body.model) {
      // Déjà au format OpenAI/Groq — on passe tel quel
      groqBody = body;
    } else {
      // Format Anthropic → convertir en format Groq (compatible OpenAI)
      var messages = [];

      // Ajouter le system prompt si présent
      if (body.system) {
        messages.push({ role: 'system', content: body.system });
      }

      // Convertir les messages Anthropic
      (body.messages || []).forEach(function (m) {
        if (typeof m.content === 'string') {
          messages.push({ role: m.role, content: m.content });
        } else if (Array.isArray(m.content)) {
          // Extraire le texte des blocs de contenu Anthropic
          var text = m.content
            .filter(function (b) { return b.type === 'text'; })
            .map(function (b) { return b.text; })
            .join('\n');
          messages.push({ role: m.role, content: text });
        }
      });

      groqBody = {
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: body.max_tokens || 1024,
        temperature: 0.3
      };
    }

    var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(groqBody)
    });

    var data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Convertir la réponse Groq (format OpenAI) → format Anthropic
    // (pour que ton predict puisse lire la réponse sans modification)
    var anthropicCompatible = {
      id: data.id || 'groq-response',
      type: 'message',
      role: 'assistant',
      model: groqBody.model,
      content: [
        {
          type: 'text',
          text: data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : ''
        }
      ],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: data.usage ? data.usage.prompt_tokens : 0,
        output_tokens: data.usage ? data.usage.completion_tokens : 0
      }
    };

    return res.status(200).json(anthropicCompatible);

  } catch (err) {
    console.error('[groq proxy] Erreur:', err.message);
    return res.status(502).json({
      error: 'Erreur lors de l\'appel à Groq: ' + err.message
    });
  }
}
