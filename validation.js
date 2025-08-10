const { body, validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const loginValidation = [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

const signalValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('coordinates').isObject().withMessage('Coordinates must be an object'),
  body('coordinates.lat').isNumeric().withMessage('Latitude must be a number'),
  body('coordinates.lng').isNumeric().withMessage('Longitude must be a number')
];

const cameraValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('coordinates').isObject().withMessage('Coordinates must be an object'),
  body('coordinates.lat').isNumeric().withMessage('Latitude must be a number'),
  body('coordinates.lng').isNumeric().withMessage('Longitude must be a number')
];

module.exports = {
  validateRequest,
  loginValidation,
  signalValidation,
  cameraValidation
};