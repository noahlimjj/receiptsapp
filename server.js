require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const { Client } = require('@notionhq/client');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const axios = require('axios');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Middleware
app.use(bodyParser.json());

// Webhook handler for Railway
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.handleUpdate(req.body, res);
  return res.status(200).send('OK');
});

// Start command
bot.command('start', (ctx) => {
  return ctx.reply('👋 Hello! Send me a receipt photo and I\'ll save it to Notion!');
});

// Handle photo messages
bot.on('photo', async (ctx) => {
  const chatId = ctx.message.chat.id;
  const message = await ctx.reply('📸 Got your receipt! Processing...');
  
  try {
    // Get the photo file (highest quality)
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;
    
    // Get file URL for Notion
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    // Download the image for OCR processing
    const tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}.jpg`);
    const writer = require('fs').createWriteStream(tempFilePath);
    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream',
    });
    
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Process the image
    await message.editText('🔍 Extracting receipt details...');
    
    // Preprocess image
    const image = await Jimp.read(tempFilePath);
    const processedImage = await image
      .greyscale()
      .contrast(0.5)
      .normalize();
    
    const processedPath = path.join(os.tmpdir(), `processed_${Date.now()}.jpg`);
    await processedImage.writeAsync(processedPath);
    
    // Extract text using Tesseract
    const { data: { text } } = await Tesseract.recognize(
      processedPath,
      'eng',
      { logger: m => console.log(m.status) }
    );
    
    // Extract receipt data
    const receiptData = extractReceiptData(text);
    
    // Save to Notion
    await message.editText('💾 Saving to Notion...');
    
    const properties = {
      'Name': {
        title: [
          { text: { content: receiptData.amount ? `Receipt - $${receiptData.amount.toFixed(2)}` : 'New Receipt' }}
        ]
      },
      'amount': { number: receiptData.amount || 0 },
      'Date': { date: { start: receiptData.date }},
      'type': {
        rich_text: [{ text: { content: 'receipt' }}]
      },
      'receipt url': {
        rich_text: [{
          text: { content: fileUrl, link: { url: fileUrl }}
        }]
      }
    };
    
    const page = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: properties
    });
    
    // Send success message
    const notionLink = `https://www.notion.so/${page.id.replace(/-/g, '')}`;
    await message.editText(
      `✅ Receipt saved to Notion!\n\n` +
      (receiptData.amount ? `Amount: $${receiptData.amount.toFixed(2)}\n` : '') +
      `Date: ${receiptData.date}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'View in Notion', url: notionLink }]]
        }
      }
    );
    
    // Clean up
    await Promise.all([
      fs.unlink(tempFilePath).catch(console.error),
      fs.unlink(processedPath).catch(console.error)
    ]);
    
  } catch (error) {
    console.error('Error processing receipt:', error);
    await message.editText('❌ Sorry, I had trouble processing that receipt. Please try again with a clearer photo.');
  }
});

// Helper function to extract receipt data
function extractReceiptData(text) {
  try {
    // Extract amount (look for $XX.XX pattern)
    const amountMatch = text.match(/\$?\s*\d+\.\d{2}/);
    
    // Extract date (look for MM/DD/YYYY or similar)
    const dateMatch = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    
    // Format date as YYYY-MM-DD
    let formattedDate = new Date().toISOString().split('T')[0];
    if (dateMatch) {
      const [_, month, day, year] = dateMatch;
      const fullYear = year.length === 2 ? `20${year}` : year;
      formattedDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return {
      amount: amountMatch ? parseFloat(amountMatch[0].replace(/[^\d.]/g, '')) : null,
      date: formattedDate,
      rawText: text.substring(0, 2000)
    };
  } catch (error) {
    console.error('Error extracting receipt data:', error);
    return {
      amount: null,
      date: new Date().toISOString().split('T')[0],
      rawText: ''
    };
  }
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Set webhook in production
  if (process.env.RAILWAY_STATIC_URL) {
    const webhookUrl = `${process.env.RAILWAY_STATIC_URL}/webhook/${process.env.TELEGRAM_BOT_TOKEN}`;
    bot.telegram.setWebhook(webhookUrl)
      .then(() => console.log('Webhook set successfully'))
      .catch(console.error);
  }
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = app;
