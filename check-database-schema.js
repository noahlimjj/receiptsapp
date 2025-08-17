require('dotenv').config();
const { Client } = require('@notionhq/client');

// Initialize the Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function checkDatabaseSchema() {
  try {
    console.log('Fetching database schema...');
    
    const databaseId = process.env.NOTION_DATABASE_ID;
    const response = await notion.databases.retrieve({
      database_id: databaseId,
    });
    
    console.log('\n=== Database Properties ===');
    console.log('Database Name:', response.title[0]?.plain_text || 'Untitled');
    console.log('Database ID:', response.id);
    console.log('\nProperties:');
    
    // List all properties and their types
    const properties = response.properties;
    for (const [key, value] of Object.entries(properties)) {
      console.log(`\n- ${key} (${value.type})`);
      
      // Show additional details based on property type
      switch (value.type) {
        case 'select':
          console.log('  Options:', value.select.options.map(o => o.name).join(', '));
          break;
        case 'number':
          console.log('  Format:', value.number?.format || 'number');
          break;
        case 'date':
          console.log('  Time:', value.date?.include_time ? 'Included' : 'Date only');
          break;
      }
    }
    
  } catch (error) {
    console.error('Error checking database schema:', error.message);
    if (error.response) {
      console.error('Error details:', {
        status: error.status,
        code: error.code,
        headers: error.headers,
        body: error.body
      });
    }
  }
}

// Run the check
checkDatabaseSchema();
