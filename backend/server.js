const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS properly - be very permissive for development
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true // Allow cookies to be sent
}));

// Parse JSON bodies
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Request Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Override response methods to ensure JSON format
app.use((req, res, next) => {
  // Store the original json method
  const originalJson = res.json;
  
  // Override the json method
  res.json = function(body) {
    // Ensure content type is application/json
    res.setHeader('Content-Type', 'application/json');
    // Call the original json method
    return originalJson.call(this, body);
  };
  
  next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Increase payload limit for file uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import models
const User = require('./models/User');
const Document = require('./models/Document');

// Add this before the MongoDB connection
console.log('Connecting to MongoDB Atlas...');

// Connect to MongoDB with improved error handling and options for Atlas
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/reckon', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  retryWrites: true
})
.then(() => {
  console.log('MongoDB Atlas connected successfully');
  
  // Start the server with better error handling for port conflicts
  startServer();
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // Exit with failure code
});

// Function to start the server with port conflict handling
function startServer(retryPort = PORT) {
  // Convert port to number and validate - this fixes the string concatenation issue
  const portNum = Number(retryPort);
  
  // Check if port is valid (must be between 0 and 65535)
  if (isNaN(portNum) || portNum < 0 || portNum > 65535) {
    console.error(`Invalid port number: ${retryPort}. Must be between 0 and 65535.`);
    // Fall back to alternate port (3002 or 8080)
    retryPort = 3002;
    console.log(`Falling back to port ${retryPort}...`);
  } else {
    // Ensure retryPort is a number, not a string
    retryPort = portNum;
  }
  
  const server = app.listen(retryPort)
    .on('listening', () => {
      const actualPort = server.address().port;
      console.log(`Server running on port ${actualPort}`);
      console.log(`Test the API: http://localhost:${actualPort}/api/health`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Add explicit Number conversion and +1 to ensure numerical addition
        const nextPort = Number(retryPort) + 1;
        
        // Safety check to prevent infinite recursion
        if (nextPort >= 65535) {
          console.error('No available ports found. Please free up ports or specify a different port range.');
          process.exit(1);
          return;
        }
        
        console.warn(`Port ${retryPort} is already in use, trying port ${nextPort}...`);
        
        // Kill the server instance that failed to start
        server.close();
        
        // Try the next port
        startServer(nextPort);
      } else {
        console.error('Error starting server:', err);
        process.exit(1);
      }
    });
  
  // Handle server shutdown gracefully
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    // Create the uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only certain file types
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, PNG, DOC, and DOCX are allowed.'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 8 // Maximum 8 files
  }
});

// Create uploads directory for storing documents
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`Created uploads directory at: ${uploadsDir}`);
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`Serving static files from: ${uploadsDir}`);

// API Health Check endpoint
app.get('/api/health', (req, res) => {
  return res.status(200).json({ 
    status: 'OK',
    message: 'TabCura API is running',
    timestamp: new Date()
  });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Debug endpoint working',
    timestamp: new Date()
  });
});

// IMPORTANT: Place more specific routes before generic ones
// Get user by username route (must be before the :id route)
app.get('/api/users/username/:username', async (req, res) => {
  try {
    const username = req.params.username;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user without sensitive information
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth
      }
    });
    
  } catch (error) {
    console.error('Error fetching user by username:', error);
    return res.status(500).json({ 
      message: 'Error fetching user data',
      error: error.message 
    });
  }
});

// Get user by ID route
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return user without sensitive information
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth
      }
    });
    
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ 
      message: 'Error fetching user data',
      error: error.message 
    });
  }
});

// Get all users route
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password'); // Exclude password field
    
    res.status(200).json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username
      }))
    });
    
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ 
      message: 'Error fetching users',
      error: error.message 
    });
  }
});

// User registration endpoint
app.post('/api/users/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    
    // Check if Content-Type is application/json
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        message: 'Invalid Content-Type. Expected application/json'
      });
    }
    
    const { firstName, lastName, email, username, password, dateOfBirth, gender } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !username || !password) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({
        message: 'Please provide all required fields'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email },
        { username }
      ] 
    });
    
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }
    
    // Create new user
    const newUser = new User({
      firstName,
      lastName,
      email,
      username,
      password,
      dateOfBirth,
      gender
    });
    
    // Save user to database
    const savedUser = await newUser.save();
    console.log('User registered successfully:', savedUser.email);
    
    // Return success response
    return res.status(201).json({
      success: true,
      user: {
        id: savedUser._id,
        name: `${savedUser.firstName} ${savedUser.lastName}`,
        email: savedUser.email,
        username: savedUser.username
      }
    });
    
  } catch (error) {
    console.error('Error registering user:', error);
    return res.status(500).json({ 
      message: 'Error registering user',
      error: error.message 
    });
  }
});

// User login endpoint
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password, isDoctor } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Check if user exists and password matches
    if (!user || user.password !== password) { // In production, use proper password comparison
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if trying to access doctor portal but not a doctor
    if (isDoctor && !user.isDoctor) {
      return res.status(403).json({ message: 'Not authorized as a healthcare provider' });
    }
    
    // Return user data
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        username: user.username,
        isDoctor: user.isDoctor,
        specialty: user.specialty
      }
    });
    
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ 
      message: 'Error logging in',
      error: error.message 
    });
  }
});

// Document upload endpoint with improved error handling
app.post('/api/documents/upload', (req, res) => {
  console.log('Document upload endpoint hit');
  console.log('Headers:', req.headers);
  
  // Use middleware directly here to better handle errors
  const uploadMiddleware = upload.single('document');
  
  uploadMiddleware(req, res, function(err) {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ 
        success: false,
        message: 'File upload error', 
        error: err.message 
      });
    }
    
    // Continue with processing if no error
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    console.log('File received:', req.file);
    console.log('Body:', req.body);
    
    try {
      const { userId, documentType } = req.body;
      
      // Validate userId
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      // Process document
      User.findById(userId)
        .then(user => {
          if (!user) {
            // Clean up file if user not found
            try {
              fs.unlinkSync(req.file.path);
            } catch (err) {
              console.error('Error removing file:', err);
            }
            return res.status(404).json({ message: 'User not found' });
          }
          
          // Create document record
          const newDocument = new Document({
            userId,
            name: req.file.filename,
            originalName: req.file.originalname,
            type: documentType || 'Medical Document',
            size: req.file.size,
            path: req.file.path,
            contentType: req.file.mimetype
          });
          
          return newDocument.save();
        })
        .then(savedDocument => {
          console.log('Document saved:', savedDocument);
          return res.status(201).json({
            success: true,
            document: {
              id: savedDocument._id,
              name: savedDocument.originalName,
              type: savedDocument.type,
              date: savedDocument.uploadDate
            }
          });
        })
        .catch(err => {
          // Clean up file on error
          if (req.file && req.file.path) {
            try {
              fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
              console.error('Error removing file:', unlinkErr);
            }
          }
          
          console.error('Document processing error:', err);
          return res.status(500).json({
            success: false,
            message: 'Error processing document',
            error: err.message
          });
        });
    } catch (error) {
      console.error('Error in document upload handler:', error);
      // Clean up file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('Error removing file:', err);
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Server error processing document',
        error: error.message
      });
    }
  });
});

// Get user documents endpoint
app.get('/api/documents/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Find all documents for the specified user
    const documents = await Document.find({ userId }).sort({ uploadDate: -1 });

    // Transform document data for the frontend
    const documentList = documents.map(doc => ({
      id: doc._id,
      name: doc.originalName,
      type: doc.type,
      date: doc.uploadDate.toISOString().split('T')[0],
      url: `/uploads/${doc.name}`
    }));

    return res.status(200).json({
      success: true,
      documents: documentList
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ 
      message: 'Error fetching documents',
      error: error.message 
    });
  }
});

// Delete document endpoint
app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    // Find the document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Remove the file
    if (fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    // Remove the document from the database
    await Document.findByIdAndDelete(documentId);

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return res.status(500).json({ 
      message: 'Error deleting document',
      error: error.message 
    });
  }
});

// Doctor API endpoints
// Get patients with documents mentioning the doctor
app.get('/api/doctor/patients/:doctorId', async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    // Verify this is a doctor account
    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
      return res.status(403).json({ message: 'Not authorized as a healthcare provider' });
    }
    
    // In a real app, we would:
    // 1. Find documents that mention this doctor (using text analysis)
    // 2. Get the patients who own these documents
    // 3. Return patient data with their documents and conditions
    
    // Mock data for demonstration
    const mockPatients = [
      {
        id: '1',
        name: 'John Smith',
        email: 'john@example.com',
        age: 45,
        documents: [
          { id: 'd1', name: 'Blood Test Results', date: '2023-05-10', type: 'Lab Report' },
          { id: 'd2', name: 'ECG Report', date: '2023-06-15', type: 'Diagnostic' }
        ],
        diseases: [
          { name: 'Hypertension', diagnosedOn: '2022-01-15', notes: 'Moderate, controlled with medication' },
          { name: 'Diabetes Type 2', diagnosedOn: '2021-03-22', notes: 'Early stage' }
        ],
        lastVisit: '2023-06-15'
      },
      // ...other mock patient data...
    ];
    
    res.status(200).json({
      success: true,
      patients: mockPatients
    });
    
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    res.status(500).json({
      message: 'Failed to fetch patients',
      error: error.message
    });
  }
});

// Add endpoint to categorize patients (add disease classification)
app.post('/api/doctor/patients/:patientId/categorize', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { doctorId, disease, notes } = req.body;
    
    // Verify this is a doctor account
    const doctor = await User.findById(doctorId);
    if (!doctor || !doctor.isDoctor) {
      return res.status(403).json({ message: 'Not authorized as a healthcare provider' });
    }
    
    // In a real app, we would:
    // 1. Validate the patient exists
    // 2. Add the disease categorization to the patient record
    // 3. Return the updated patient data
    
    res.status(200).json({
      success: true,
      message: 'Patient categorized successfully',
      categorization: {
        disease,
        diagnosedOn: new Date().toISOString(),
        notes
      }
    });
    
  } catch (error) {
    console.error('Error categorizing patient:', error);
    res.status(500).json({
      message: 'Failed to categorize patient',
      error: error.message
    });
  }
});

// Import additional packages for PDF parsing and Gemini API
const pdfParse = require('pdf-parse');
const axios = require('axios');
const { createReadStream } = require('fs');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');

// Gemini API integration - Add this before starting the server
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.0-pro';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Import Gemini SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-pro",
  generationConfig: {
    temperature: 0.1,
    topP: 0.1,
    topK: 16
  },
  systemInstruction: "You are a medical document analyzer. Format lab reports and prescriptions into structured JSON data."
});

// Update the extractTextFromPDF function
async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const text = data.text.trim();
    
    if (!text || text.length < 50) {
      throw new Error('No readable text found in PDF');
    }

    console.log('Successfully extracted text from PDF');
    return text;
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error('Failed to extract text from PDF. Please ensure the PDF contains readable text.');
  }
}

// Update image extraction function for better quality
async function extractTextFromImage(imagePath) {
  try {
    // Preprocess image
    const processedImagePath = `${imagePath}_processed.png`;
    await sharp(imagePath)
      .resize(2480, 3508, { // A4 size at 300 DPI
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 }
      })
      .modulate({
        brightness: 1.1,
        contrast: 1.2,
      })
      .sharpen()
      .normalize() // Normalize the image
      .toFile(processedImagePath);

    // Use Tesseract.js v4 properly
    const result = await Tesseract.recognize(
      processedImagePath,
      'eng',
      {
        logger: m => console.log(m), // Add logging for debugging
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-%/: ',
        tessedit_pageseg_mode: '6'
      }
    );

    // Clean up processed image
    try {
      fs.unlinkSync(processedImagePath);
    } catch (err) {
      console.error('Error removing processed image:', err);
    }

    if (!result.data.text.trim()) {
      throw new Error('No text could be extracted from the image');
    }

    return result.data.text;
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Function to analyze prescription text with Gemini API
async function analyzePrescriptionWithGemini(documentText, fileCount) {
  try {
    const prompt = {
      contents: [{
        parts: [{
          text: `Analyze this medical document and extract key information into structured JSON format.

Document Text:
${documentText}

Rules:
1. If it's a lab report, include test name, value, range, and status (H for high, L for low, or null for normal)
2. If it's a prescription, include medication details
3. Always identify the document type, date, and doctor's name
4. Format results based on document type

Return a JSON object with this exact structure:
{
  "type": "lab_report" or "prescription",
  "date": "document date",
  "doctor": "doctor name",
  "lab_results": [
    { "test": "test name", "value": "result value", "range": "normal range", "status": "H/L/null" }
  ],
  "medications": [
    { "name": "", "dosage": "", "frequency": "", "duration": "", "instructions": "" }
  ],
  "documents_analyzed": ${fileCount},
  "summary": "brief analysis of key findings, especially abnormal values"
}`
        }]
      }]
    };

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      const parsedResult = JSON.parse(jsonStr);

      // Add default values for missing fields
      return {
        type: parsedResult.type || 'unknown',
        date: parsedResult.date || 'Not specified',
        doctor: parsedResult.doctor || 'Not specified',
        lab_results: parsedResult.lab_results || [],
        medications: parsedResult.medications || [],
        documents_analyzed: fileCount,
        summary: parsedResult.summary || 'No summary provided',
        abnormal_flags: parsedResult.lab_results?.filter(test => test.status === 'H' || test.status === 'L').length || 0,
      };
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      return {
        type: documentText.toLowerCase().includes('blood') ? 'lab_report' : 'prescription',
        date: 'Parse error',
        doctor: 'Parse error',
        lab_results: [],
        medications: [],
        documents_analyzed: fileCount,
        summary: 'Error parsing results',
        raw_text: documentText.substring(0, 500),
        error: true
      };
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to analyze documents with AI');
  }
}

// Update prescription analysis endpoint
app.post('/api/analyze/prescription', upload.array('prescription', 8), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No files uploaded' 
      });
    }

    if (req.files.length > 8) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 8 files allowed'
      });
    }

    console.log(`Processing ${req.files.length} files...`);
    let extractedTexts = [];
    const filePaths = [];

    try {
      // Process each file
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        filePaths.push(file.path);
        console.log(`Processing file ${i + 1}/${req.files.length}: ${file.originalname}`);
        
        try {
          let text;
          if (file.mimetype === 'application/pdf') {
            text = await extractTextFromPDF(file.path);
          } else if (file.mimetype.startsWith('image/')) {
            text = await extractTextFromImage(file.path);
          }
          
          if (text && text.trim()) {
            extractedTexts.push(`Document ${i + 1} (${file.mimetype.includes('pdf') ? 'PDF' : 'Image'}): ${text}`);
          } else {
            console.warn(`No text extracted from file ${i + 1}: ${file.originalname}`);
          }
        } catch (processingError) {
          console.error(`Error processing file ${i + 1}:`, processingError);
          // Continue with other files even if one fails
          continue;
        }
      }

      if (extractedTexts.length === 0) {
        throw new Error('Could not extract text from any of the uploaded files');
      }

      // Combine all extracted text with clear document separation
      const combinedText = extractedTexts.join('\n\n=== Next Document ===\n\n');

      if (!combinedText.trim()) {
        throw new Error('No text could be extracted from the uploaded files');
      }

      // Analyze combined text with Gemini
      const analysisResult = await analyzePrescriptionWithGemini(combinedText, req.files.length);

      return res.status(200).json({
        success: true,
        analysis: {
          ...analysisResult,
          number_of_files_processed: req.files.length,
          // Only include original text in development environment
          ...(process.env.NODE_ENV === 'development' && { original_text: combinedText.substring(0, 1000) })
        }
      });

    } catch (error) {
      throw error;
    } finally {
      // Clean up all uploaded files
      for (const path of filePaths) {
        if (fs.existsSync(path)) {
          try {
            fs.unlinkSync(path);
          } catch (err) {
            console.error('Error cleaning up file:', err);
          }
        }
      }
    }
  } catch (error) {
    console.error('Document analysis error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error analyzing documents',
      error: error.toString()
    });
  }
});

// Add error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Ensure we send a proper JSON response for errors
  return res.status(500).json({
    message: 'An unexpected error occurred',
    error: err.message
  });
});

// Handle 404 routes with JSON response
app.use((req, res) => {
  return res.status(404).json({ 
    message: 'API endpoint not found',
    path: req.path
  });
});
