const TelegramBot = require('node-telegram-bot-api');
const { Client } = require('@notionhq/client');
const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Function starting...');

// Load environment variables
require('dotenv').config();

console.log('Environment variables loaded:', {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? '***' : 'MISSING',
  NOTION_API_KEY: process.env.NOTION_API_KEY ? '***' : 'MISSING',
  NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID ? '***' : 'MISSING'
});

// Initialize Telegram Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in environment variables');
  throw new Error('Telegram bot token is not configured');
}

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Initialize bot with webhook
console.log('Initializing Telegram bot with token:', token ? `${token.substring(0, 10)}...` : 'MISSING');
const bot = new TelegramBot(token, { 
  polling: false,
  onlyFirstMatch: true,
  request: {
    proxy: process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null
  }
});
console.log('Telegram bot initialized with options:', { polling: false });

// Simple command to test if bot is working
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received /start command from chat ${chatId}`);
  
  try {
    console.log(`Attempting to send message to chat ${chatId}...`);
    const sentMessage = await bot.sendMessage(chatId, '👋 Hello! I\'m your receipt bot. This is a test message to confirm I\'m working!');
    console.log(`Message sent successfully! Message ID: ${sentMessage.message_id}`);
  } catch (error) {
    console.error('Error sending message:', error.response?.data || error.message);
    console.error('Error details:', {
      code: error.code,
      response: error.response?.data,
      stack: error.stack
    });
  }
});

// Handle all text messages
bot.on('text', (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received text message from ${chatId}: ${msg.text}`);
  bot.sendMessage(chatId, `📝 You said: "${msg.text}"`);
});

// Handle photo messages - optimized for quick response
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  console.log(`Received photo from ${chatId}`);
  
  // Send immediate acknowledgment to user
  const processingMsg = await bot.sendMessage(chatId, '📸 Got your receipt! Processing it now...');
  
  // Process the receipt asynchronously
  processReceiptAsync(msg, chatId, processingMsg.message_id).catch(console.error);
});

// Process receipt asynchronously to avoid blocking the webhook response
async function processReceiptAsync(msg, chatId, statusMessageId) {
  let tempFilePath = '';
  let processedImagePath = '';
  
  try {
    // Get the photo file (highest quality)
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;
    
    console.log('Processing receipt from photo:', {
      file_id: fileId,
      width: photo.width,
      height: photo.height,
      file_size: photo.file_size
    });
    
    // Update status
    await bot.editMessageText('⬇️ Downloading receipt image...', {
      chat_id: chatId,
      message_id: statusMessageId
    });
    
    // Download the image
    tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}.jpg`);
    await downloadFile(fileId, tempFilePath);
    
    // Update status
    await bot.editMessageText('🔄 Processing receipt (this may take a moment)...', {
      chat_id: chatId,
      message_id: statusMessageId
    });
    
    // Preprocess image for better OCR
    processedImagePath = await preprocessImage(tempFilePath);
    
    // Extract text using Tesseract OCR
    const ocrText = await extractTextFromImage(processedImagePath);
    console.log('Extracted text from receipt:', ocrText.substring(0, 200) + '...');
    
    // Extract receipt data
    const receiptData = extractReceiptData(ocrText);
    console.log('Extracted receipt data:', receiptData);
    
    // Update status
    await bot.editMessageText('📝 Saving to Notion...', {
      chat_id: chatId,
      message_id: statusMessageId
    });
    
    // Create Notion page
    const pageId = await createNotionPage(receiptData);
    
    // Send success message with Notion link if available
    const notionLink = pageId 
      ? `https://www.notion.so/${pageId.replace(/-/g, '')}`
      : 'Notion page';
    
    let responseText = '✅ Receipt processed successfully!\n\n';
    if (receiptData.amount) responseText += `Amount: $${receiptData.amount}\n`;
    if (receiptData.date) responseText += `Date: ${receiptData.date}\n`;
    
    await bot.editMessageText(responseText, {
      chat_id: chatId,
      message_id: statusMessageId,
      parse_mode: 'Markdown',
      reply_markup: pageId ? {
        inline_keyboard: [[
          { text: 'View in Notion', url: notionLink }
        ]]
      } : undefined
    });
    
  } catch (error) {
    console.error('Error processing receipt:', error);
    
    // Try to update the status message with error
    try {
      await bot.editMessageText('❌ Sorry, I had trouble processing that receipt. Please try again with a clearer photo.', {
        chat_id: chatId,
        message_id: statusMessageId
      });
    } catch (editError) {
      console.error('Failed to update status message:', editError);
      await bot.sendMessage(chatId, '❌ Sorry, I had trouble processing that receipt. Please try again with a clearer photo.');
    }
  } finally {
    // Clean up temporary files
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      if (processedImagePath && fs.existsSync(processedImagePath)) fs.unlinkSync(processedImagePath);
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
  }
}

// Helper function to download a file from Telegram
async function downloadFile(fileId, filePath) {
  const fileLink = await bot.getFileLink(fileId);
  const response = await axios({
    method: 'GET',
    url: fileLink,
    responseType: 'stream'
  });
  
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);
  });
}

// Helper function to preprocess image for better OCR
async function preprocessImage(imagePath) {
  const image = await Jimp.read(imagePath);
  
  // Basic image preprocessing for better OCR
  await image
    .greyscale() // Convert to grayscale
    .contrast(0.5) // Increase contrast
    .normalize(); // Normalize the colors
    
  const processedPath = path.join(os.tmpdir(), `processed_${path.basename(imagePath)}`);
  await image.writeAsync(processedPath);
  return processedPath;
}

// Helper function to extract text from image using Tesseract
async function extractTextFromImage(imagePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'eng',
      { logger: m => console.log(m.status) }
    );
    return text;
  } catch (error) {
    console.error('Error in OCR processing:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Helper function to extract receipt data from text
function extractReceiptData(text) {
  // This is a simple regex-based extractor
  // In a real app, you might want to use more sophisticated NLP or patterns
  const amountMatch = text.match(/\$?\s*\d+\.\d{2}/);
  const dateMatch = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/);
  
  return {
    amount: amountMatch ? amountMatch[0].replace(/[^\d.]/g, '') : null,
    date: dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0],
    rawText: text.substring(0, 2000), // Store first 2000 chars of OCR text
    processed: false // Mark as unprocessed for manual review if needed
  };
}

// Helper function to create a Notion page
async function createNotionPage(receiptData) {
  if (!process.env.NOTION_DATABASE_ID) {
    console.error('NOTION_DATABASE_ID is not set');
    return null;
  }

  try {
    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID },
      properties: {
        'Name': {
          title: [
            {
              text: {
                content: `Receipt ${receiptData.amount ? `- $${receiptData.amount}` : ''}`
              }
            }
          ]
        },
        'Amount': {
          number: receiptData.amount ? parseFloat(receiptData.amount) : null
        },
        'Date': {
          date: { start: receiptData.date }
        },
        'Status': {
          select: { name: receiptData.processed ? 'Processed' : 'Needs Review' }
        },
        'OCR Text': {
          rich_text: [
            {
              text: {
                content: receiptData.rawText || 'No text extracted'
              }
            }
          ]
        }
      }
    });
    
    console.log('Created Notion page:', response.id);
    return response.id;
  } catch (error) {
    console.error('Error creating Notion page:', error);
    throw error;
  }
}

// Handle incoming webhook updates
exports.handler = async (event, context) => {
  console.log('=== Incoming Request ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Path:', event.path);
  console.log('Headers:', JSON.stringify(event.headers, null, 2));
  console.log('Environment Variables:', {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? '***' : 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'development'
  });
  
  // Handle preflight OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Check if this is a Telegram webhook update
  if (event.httpMethod === 'POST' && event.path.endsWith('/telegram-bot')) {
    try {
      console.log('Raw body:', event.body);
      const update = JSON.parse(event.body);
      console.log('Parsed update:', JSON.stringify(update, null, 2));
      
      // Process the update with error handling
      try {
        console.log('Processing update with bot...');
        await bot.processUpdate(update);
        console.log('Successfully processed update');
      } catch (processError) {
        console.error('Error in processUpdate:', processError);
        throw processError; // Re-throw to be caught by outer try-catch
      }
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ok' })
      };
    } catch (error) {
      console.error('Error processing update:', error);
      
      // Try to send error message to user if possible
      try {
        const update = JSON.parse(event.body);
        const chatId = update.message?.chat?.id;
        if (chatId) {
          await bot.sendMessage(chatId, '⚠️ Oops! Something went wrong. Please try again later.');
        }
      } catch (sendError) {
        console.error('Failed to send error message to user:', sendError);
      }
      
      return {
        statusCode: 200, // Still return 200 to prevent Telegram from retrying
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error', message: error.message })
      };
    }
  }
  
  // For all other requests, return 404
  console.log('404 Not Found - Path:', event.path);
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Not Found - This is a Telegram webhook endpoint' })
  };
};
