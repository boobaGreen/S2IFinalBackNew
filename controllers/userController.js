//userController.js
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  console.log('req.user.id', req.user.id);
  next();
};

exports.validateToken = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Token is valid',
    userName: req.user.userName, // Includi il nome utente nella risposta
  });
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Plese use /updateMyPassword',
        400,
      ),
    );
  }
  // 2) Filter out the fileds that we don't allow to change
  const filteredBody = filterObj(req.body, 'name', 'email');
  // 2) Update user document
  const updateUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    validation: true,
  });

  res.status(200).json({
    status: 'success',
    data: { user: updateUser },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  res.status(204).json({ status: 'success', data: null });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This Route is not defined! Please use sign up instead',
  });
};
// NEW VERSION WITH FACTORY FILE
exports.getAllUser = factory.getAll(User);
exports.getUser = factory.getOne(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
