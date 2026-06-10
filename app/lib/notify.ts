/**
 * Notifications Telegram temps réel (démo ouverte, clic « Je le veux », paiement).
 *
 * Setup (1 fois) :
 *  1. Parler à @BotFather sur Telegram -> /newbot -> récupérer le token.
 *  2. Envoyer un message au bot, puis ouvrir
 *     https://api.telegram.org/bot<TOKEN>/getUpdates pour lire son chat.id.
 *  3. Renseigner TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID dans .env.local / Vercel.
 *
 * Sans config, no-op silencieux (le tracking continue de fonctionner).
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

export const telegramConfigured = !!(TOKEN && CHAT_ID);

export async function sendTelegram(text: string): Promise<boolean> {
  if (!telegramConfigured) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
