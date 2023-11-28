//app.js
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser'); // Aggiunto il middleware cookie-parser x jwt
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cors = require('cors'); // Aggiunto il middleware CORS
const hpp = require('hpp');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
// const questionRouter = require('./routes/questionRoutes');
const userRouter = require('./routes/userRoutes');
// const responseRouter = require('./routes/responseRoutes');

const app = express();
// Abilita CORS per tutte le richieste
app.use(cors());

app.use(cookieParser()); // Middleware per il parsing dei cookie

// NOTE 1) GLOBAL MIDLLEWAREs
//Set security HTTP headers
app.use(helmet());
// Development loggin
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
// Limit request
const limiter = rateLimit({
  max: 200,
  windowMs: 60 * 60 * 1000,
  message: 'Too many request from this IP, please try again in an hour',
}); // 429 Error

app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // Middleware add the data from the body to the request object

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitazation agains XSS
app.use(xss());

// Prevent parameter pollution

app.use(
  hpp({
    whitelist: [
      // 'duration',
      // 'ratingsQuantity',
      // 'ratingsAverage',
      // 'maxGroupSize',
      // 'difficulty',
      // 'price',
    ],
  }),
);

// Serving static files
app.use(express.static(`${__dirname}/public`));

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.headers);
  next();
});

// NOTE 2) ROUTES

// app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
// app.use('/api/v1/reviews', reviewRouter);

// set route for all no match routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find${req.originalUrl} on this server`, 404));

  // New versione without function custom error
  // const err = new Error(`Can't find${req.originalUrl} on this server`);
  // err.status = 'fail';
  // err.statusCode = 404;
  // if next receive an argument he assume there is an error and skip all the others middleware and pass the error to the global error middleware

  // OLD VERSION
  // res.status(404).json({
  //   status: 'fail',
  //   message: `Can't find${req.originalUrl} on this server`,
  // });
});

//Global Error Handling Middleware - 4 argument express recognize is a error middleware
app.use(globalErrorHandler);

module.exports = app;
