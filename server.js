import express from 'express';
import Mailjet from 'node-mailjet';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Mailjet client - will use env vars
const mailjet = Mailjet.apiConnect(
  process.env.MAILJET_API_KEY || 'your-api-key',
  process.env.MAILJET_SECRET_KEY || 'your-secret-key'
);

// Email endpoint
app.post('/api/feedback', async (req, res) => {
  const { type, name, email, message } = req.body;

  if (!type || !message) {
    return res.status(400).json({ error: 'Type and message are required' });
  }

  const subject = type === 'bug'
    ? 'CurlingPro Bug Report'
    : 'CurlingPro Feature Request';

  const htmlContent = `
    <h2>${subject}</h2>
    <p><strong>From:</strong> ${name || 'Anonymous'} ${email ? `(${email})` : ''}</p>
    <hr>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  const textContent = `${subject}\n\nFrom: ${name || 'Anonymous'} ${email ? `(${email})` : ''}\n\n${message}`;

  try {
    const result = await mailjet
      .post('send', { version: 'v3.1' })
      .request({
        Messages: [
          {
            From: {
              Email: process.env.MAILJET_FROM_EMAIL || 'noreply@curlingpro.game',
              Name: 'CurlingPro Feedback'
            },
            To: [
              {
                Email: 'jonathan@pksols.com',
                Name: 'Jonathan'
              }
            ],
            Subject: subject,
            TextPart: textContent,
            HTMLPart: htmlContent,
            ReplyTo: email ? { Email: email, Name: name || 'Player' } : undefined
          }
        ]
      });

    console.log('Email sent:', result.body);
    res.json({ success: true, message: 'Feedback sent successfully!' });
  } catch (error) {
    console.error('Mailjet error:', error);
    res.status(500).json({ error: 'Failed to send feedback. Please try again.' });
  }
});

// Development mode with Vite
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
