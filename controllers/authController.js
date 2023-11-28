//authController.js
const dotenv = require('dotenv');

dotenv.config();

const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

// Oauth Google function
async function getUserData(accessToken) {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
  );

  //console.log('response',response);
  const data = await response.json();
  console.log('data', data);
}

// CreateActiveAccountToken Function
const createActiveAccountToken = function () {
  const activeToken = crypto.randomBytes(32).toString('hex');

  this.activeAccountToken = crypto
    .createHash('sha256')
    .update(activeToken)
    .digest('hex');
  console.log({ activeToken });

  // this.activeAccountExpires = Date.now() + 10 * 60 * 1000; // 10 min

  return activeToken;
};
// Sign Token Function
const signToken = (_id) => {
  return jwt.sign({ _id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

//Create and send token function
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    // sameSite: 'none',
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  // if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};
// CONFIRM ACCOUNT FUNCTION
const confirmAccount = (Model) =>
  catchAsync(async (req, res, next) => {
    const { activeToken } = req.params;
    console.log('activeToken', activeToken);
    const filter = {
      activeToken: activeToken,
    };
    console.log('filter', filter);
    const update = { status: 'Active', activeToken: null };
    // if (doc.status === 'Active') {
    //   return next(new AppError('The account is already active', 404));
    // }
    const doc = await Model.findOneAndUpdate(filter, update, {
      new: true,
    });
    console.log('doc', doc);

    if (!doc) {
      return next(
        new AppError(
          'the link is incorrect or the account has already been activated',
          404,
        ),
      );
    }

    createSendToken(doc, 200, res);
  });
exports.requestUrlOgoogle = catchAsync(async (req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:4000');
  res.header('Referrer-Policy', 'no-referrer-when-downgrade');
  const redirectUrl = 'http://127.0.0.1:3005/api/v1/users/oauth';
  const oAuth2Client = new OAuth2Client(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    redirectUrl,
  );
  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/userinfo.profile openid',
    prompt: 'consent',
  });
  res.json({ url: authorizeUrl });
});

/* GET home page. */
exports.oauth = catchAsync(async (req, res, next) => {
  const { code } = req.query;

  console.log(code);
  try {
    const redirectURL = 'http://127.0.0.1:3005/api/v1/users/oauth';
    const oAuth2Client = new OAuth2Client(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      redirectURL,
    );
    const r = await oAuth2Client.getToken(code);
    // Make sure to set the credentials on the OAuth2 client.
    await oAuth2Client.setCredentials(r.tokens);
    console.info('Tokens acquired.');
    const user = oAuth2Client.credentials;
    console.log('credentials', user);
    await getUserData(oAuth2Client.credentials.access_token);
  } catch (err) {
    console.log('Error logging in with OAuth2 user', err);
  }

  res.redirect(303, 'http://localhost:4000/');
});

exports.signup = catchAsync(async (req, res, next) => {
  // const token = jwt.sign({ email: req.body.email }, process.env.JWT_SECRET);
  const activeToken = createActiveAccountToken();

  const newUser = await User.create({
    userName: req.body.userName,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    activeToken,
    // createSendToken(newUser, 201, res);
  });
  console.log('new user create and save: ', newUser); // *****************
  const activeAccountURL = `http://127.0.0.1:4000/confirmAccount/${activeToken}`;
  // const resetURL = `${req.protocol}://localhost:4600/confirmAccount/${token}`;

  // const resetURL = `http://127.0.0.1:4600/confirmAccount/${token}`;
  // const resetURL = `${req.protocol}://${req.get(
  //   'host',
  // )}/api/v1/users/confirm/${token}`;
  const messageActive = `${activeAccountURL}\n`;
  const htmlActive = `<body><h1>S2I Quiz</h1><h2>Email Confirmation</h2>
  <h3>Hello ${newUser.userName} ! 🎈</h3>
  <p>Thank you for subscribing. Please confirm your email by clicking on the following link</p>
  <a href=${activeAccountURL}> Click here</a>
  </div><p>If you not subscribe at S2I quiz plese ignore this email</p></body>`;

  try {
    await sendEmail({
      email: newUser.email,
      subject: 'Please activate your account',
      message: messageActive,
      from: 'S2I Quiz',
      html: htmlActive,
    });
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    // user.passwordResetToken = undefined;
    // user.passwordResetExpires = undefined;
    await User.findByIdAndDelete(newUser.id);
    // await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check of email and password exists
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  console.log('***USER*** :', user);

  // const correct = await user.correctPassword(password, user.password);
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect Email or password', 401));
  }
  if (user.status === 'Pending') {
    return next(new AppError('Pending Account.Please verify your Email!', 401));
  }
  if (user.status === 'Ban') {
    return next(new AppError('Banned Account !', 401));
  }
  if (user.status !== 'Active') {
    return next(
      new AppError(
        'Account status is Not Active please contact the support !',
        401,
      ),
    );
  }

  // 3) If everything ok , send token to client
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and Check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to access. ', 401),
    );
  }
  // 2) Verification
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  console.log('decoded', decoded);
  // 3) Check if user still exists
  const currentUser = await User.findById(decoded._id);
  console.log('fresh user', currentUser);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }

  // 4) Check if user changed password after the JWT was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'User recentlty changed password! Please log in again.',
        401,
      ),
    );
  }
  // GRANT ACCES TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles  ["admin","mod","user"]  role="user"
    console.log('req.user.role :', req.user.role);
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with this email address', 404));
  }
  // 2) Generate the random token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host',
  )}/api/v1/users/resetPassword/${resetToken}`;
  const message = `Forgot password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}\nIf you didn't forget password, please ignore this email! `;
  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valide for 10 min)',
      message,
    });
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) If token has not expired,and there is user,set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  // 3) Update changedPasswordAt propertt for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  console.log(
    'test : ',
    await user.correctPassword(req.body.passwordCurrent, user.password),
  );
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }
  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!
  // 4) Log user in , send JWT
  createSendToken(user, 200, res);
});

exports.updateStatus = confirmAccount(User);
