require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function cleanResponse(text) {
  const patterns = [
    /^here is .+?:/i,
    /^transforming this.+?:/i,
    /^the text, made.+?:/i,
    /^here's .+?:/i,
    /^my attempt.+?:/i
  ];
  
  let cleanedText = text;
  patterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });
  
  return cleanedText.replace(/^["']|["']$/g, '').trim();
}

function getPromptForStage(text, stage) {
  const prompts = {
    1: `Transform this text to be a tiny bit more introspective and personal - like something Julie Delpy's character would say in the Before Sunset trilogy of movies. Be direct and honest, expressing the emotional truth behind the words. Add vulnerability and depth while keeping the core meaning, but not melancholy. Keep it concise. It should sound reasonable and decidedly NOT dramatic or hyperbolic, it should have at maximum just one sentence more than the original prompt. Don't make it hyperbolic or dramatic. It should sound like something someone might say in a conversation or a letter, not an intense poem.Output only the transformed text without any introduction or explanation:

${text}`,
    
    2: `Express this text with some emotional honesty and contemplation, in the style of Julie Delpy's character Celine - mixing personal truth with deeper insights. Do not make it dramatic or hysterical or hyperbolic or too poetic. This should sound like someone with depth having a conversation, but not dramatic or melancholy, it should not read like literature. Output only the transformed text, no introduction or explanation:

${text}`,
    
    3: `Transform this into the kind of deeply honest, emotionally resonant reflection you might hear in an intimate late-night conversation. It has to sound like something someone might say in a conversation or a letter, not an intense poem. Do not make it dramatic or hyperbolic, no hysteria. Keep the core meaning but add layers of personal truth. Output only the transformed text, no introduction or explanation:

${text}`
  };
  
  return prompts[stage] || prompts[1];
}

app.post('/transform', async (req, res) => {
  try {
    const { text, stage = 1 } = req.body;
    console.log(`Received request to transform text (stage ${stage}):`, text);

    // Validate input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text input' });
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1000,
          system: "You are a text transformation tool. You only ever respond with the transformed text - never include any introductory text, explanations, or quotation marks.",
          messages: [{
            role: "user",
            content: getPromptForStage(text, stage)
          }]
        })
      });

      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        return res.status(500).json({ error: `API Error: ${response.status}` });
      }

      const data = await response.json();
      console.log('API Response structure:', Object.keys(data));
      
      if (!data.content || !Array.isArray(data.content) || !data.content[0] || !data.content[0].text) {
        console.error('Unexpected API response format:', data);
        return res.status(500).json({ error: 'Invalid API response format' });
      }

      const cleanedText = cleanResponse(data.content[0].text);
      console.log('Cleaned response:', cleanedText);
      
      return res.json({ text: cleanedText });
    } catch (apiError) {
      console.error('API call error:', apiError);
      return res.status(500).json({ error: `API Error: ${apiError.message}` });
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: error.message });
  }
});
// Export the Express app for Vercel serverless deployment
module.exports = app;

// Only start the server when running locally (not in Vercel production)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}