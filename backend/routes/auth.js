const express = require('express');
const router = express.Router();
const { signup } = require('../controllers/authController');

// Route for user registration
router.post('/signup', signup);

module.exports = router;
