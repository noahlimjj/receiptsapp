require('dotenv').config();
const { Client } = require('@notionhq/client');

// Initialize the Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function testNotionIntegration() {
  try {
    console.log('Testing Notion integration...');
    
    // 1. Verify the database exists and is accessible
    console.log('\n1. Checking database access...');
    const databaseId = process.env.NOTION_DATABASE_ID;
    
    if (!databaseId) {
      throw new Error('NOTION_DATABASE_ID is not set in .env file');
    }
    
    if (!process.env.NOTION_API_KEY) {
      throw new Error('NOTION_API_KEY is not set in .env file');
    }
    
    console.log('✅ Environment variables are set');
    
    // 2. Test database connection
    try {
      const database = await notion.databases.retrieve({ database_id: databaseId });
      console.log(`✅ Successfully connected to database: "${database.title[0]?.plain_text || 'Untitled'}"`);
      console.log('Database ID:', database.id);
    } catch (error) {
      console.error('❌ Failed to access database. Please check:');
      console.error('1. The database ID is correct');
      console.error('2. The integration has been shared with the database');
      console.error('3. The integration has the correct permissions');
      throw error;
    }
    
    // 3. Create a test page
    console.log('\n2. Creating a test page...');
    const testPage = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        'Name': {
          title: [
            {
              text: {
                content: 'Test Receipt - $9.99'
              }
            }
          ]
        },
        'Amount': {
          number: 9.99
        },
        'Date': {
          date: { start: new Date().toISOString().split('T')[0] }
        },
        'Status': {
          select: { name: 'Needs Review' }
        },
        'OCR Text': {
          rich_text: [
            {
              text: {
                content: 'This is a test receipt created by the integration test.'
              }
            }
          ]
        }
      }
    });
    
    console.log('✅ Successfully created test page!');
    console.log('Page URL:', testPage.url);
    console.log('\n🎉 Notion integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Notion integration:');
    console.error(error.message);
    
    if (error.response) {
      console.error('\nError details:', {
        status: error.status,
        code: error.code,
        headers: error.headers,
        body: error.body
      });
    }
    
    process.exit(1);
  }
}

// Run the test
testNotionIntegration();
