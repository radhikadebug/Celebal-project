const fetch = require('node-fetch');

// Test user data
const userData = {
  name: "Test User",
  email: `testuser${Math.floor(Math.random() * 10000)}@example.com`, // More randomness
  password: "password123"
};

console.log('==== USER REGISTRATION TEST ====');
console.log(`Attempting to register user with email: ${userData.email}`);

// Make signup request
fetch('http://localhost:5000/api/auth/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(userData),
})
.then(response => {
  console.log('Response status:', response.status, response.statusText);
  
  if (!response.ok) {
    console.log('Response headers:', response.headers.raw());
  }
  
  return response.text().then(text => {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('Failed to parse response as JSON:', text);
      throw new Error('Invalid JSON response');
    }
  });
})
.then(data => {
  console.log('Registration response data:', JSON.stringify(data, null, 2));
  
  if (data.user && data.token) {
    console.log('✓ Registration successful!');
    
    // Now let's verify we can fetch the user list
    console.log('Verifying user was saved by fetching user list...');
    return fetch('http://localhost:5000/api/auth/users');
  } else {
    console.log('✗ Registration failed - unexpected response format');
    throw new Error('Registration failed');
  }
})
.then(response => {
  console.log('Users API response status:', response.status);
  return response.json();
})
.then(users => {
  console.log('Total users in the database:', users.length);
  const ourUser = users.find(user => user.email === userData.email);
  
  if (ourUser) {
    console.log('✓ Success! User found in database:', ourUser);
  } else {
    console.log('✗ User NOT found in database. Available emails:');
    console.log(users.map(u => u.email).join(', '));
  }
})
.catch(error => {
  console.error('✗ Error during registration test:', error.message);
});
