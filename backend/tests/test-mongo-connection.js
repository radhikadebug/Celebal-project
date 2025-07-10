require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

console.log('Testing direct MongoDB connection...');
console.log('MongoDB URI:', process.env.MONGO_URI.replace(/:([^:@]+)@/, ':****@')); // Hide password in logs

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✓ Connection successful!');
    console.log('Connected to database:', mongoose.connection.db.databaseName);
    
    // Create a test document
    const TestSchema = new mongoose.Schema({
      testField: String,
      createdAt: { type: Date, default: Date.now }
    });
    
    const TestModel = mongoose.model('connectionTest', TestSchema);
    
    return TestModel.create({ testField: 'Connection test at ' + new Date().toISOString() })
      .then(result => {
        console.log('✓ Test document created:', result._id);
        return TestModel.find().limit(5);
      })
      .then(docs => {
        console.log(`Found ${docs.length} test documents in collection.`);
        console.log('Most recent:', docs[0]);
        return mongoose.connection.close();
      })
      .then(() => console.log('Connection closed.'));
  })
  .catch(err => {
    console.error('✗ Connection failed:', err);
  });
