# Telegram Receipt Bot for Notion

A serverless Telegram bot that processes receipts (photos or PDFs) and saves the extracted data to Notion.

## Features

- 📸 Process receipt photos and PDFs
- 🔍 Extract text and amounts from receipts
- 📅 Automatically record transaction dates
- 📊 Store data in Notion for easy organization
- ☁️ Hosted on Netlify (serverless)

## Setup Instructions

### 1. Prerequisites

- Node.js 14.x or later
- A Netlify account
- A Notion account with integration access

### 2. Set Up Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "+ New integration"
3. Name it "Receipt Bot" and submit
4. Save the "Internal Integration Token" (you'll need it later)
5. Create a new Notion database with these properties:
   - `Name` (title)
   - `Date` (date)
   - `Type` (select)
   - `Status` (select)
   - `Amount` (number)
   - `Receipt URL` (url)
6. Share the database with your integration (click 'Share' → 'Invite' and select your integration)

### 3. Configure Environment Variables

Create a `.env` file in the project root with:
2. Fill in your credentials:
   - `TELEGRAM_BOT_TOKEN`: Get from [@BotFather](https://t.me/botfather)
   - `NOTION_API_KEY`: Create an integration in Notion and get the token
   - `NOTION_DATABASE_ID`: Create a database in Notion and share it with your integration

### 4. Set Up Notion Database

1. Create a new database in Notion
2. Add these properties:
   - `Name` (Title)
   - `Amount` (Number)
   - `Date` (Date)
   - `Source` (Select)
3. Share the database with your integration
4. Copy the database ID from the URL (the part after the last dash and before the `?v=`)

### 5. Deploy to Netlify

1. Push your code to a GitHub/GitLab repository
2. Connect the repository to Netlify
3. Add the environment variables in Netlify's site settings
4. Deploy the site

### 6. Set Up Telegram Webhook

After deployment, set the webhook URL using this command (replace with your Netlify URL):

```bash
curl -F "url=https://your-site-name.netlify.app/.netlify/functions/telegram-webhook" https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

## Usage

1. Start a chat with your bot on Telegram
2. Send a photo or PDF of a receipt
3. The bot will process it and save to your Notion database

## Development

To run locally:

```bash
# Install Netlify CLI if you haven't
npm install -g netlify-cli

# Start local development server
netlify dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token |
| `NOTION_API_KEY` | Your Notion integration token |
| `NOTION_DATABASE_ID` | ID of your Notion database |
| `URL` | Your Netlify site URL |

## License

MIT
# receiptsapp
