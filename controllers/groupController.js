// groupController.js
const Group = require('../models/groupModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
//const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.setUserDetails = (req, res, next) => {
  //Allow nested routes
  console.log('req.body :', req.body);
  console.log('MIDLLEWARE***************************');
  req.body.user = req.user._id;
  req.body.type = req.user.mail ? 'User' : 'GoogleUser';
  console.log('req.body.type :', req.body.type);
  console.log('*****middleware setuserdetails req.user finish:', req.body);
  next();
};

exports.isFounder = catchAsync(async (req, res, next) => {
  const doc = await Group.findById(req.params.id);

  if (!doc) {
    return next(new AppError('Group not found', 404));
  }

  if (!(doc.founder.user.toString() === req.user._id.toString())) {
    return next(new AppError('Only founder can delete a group', 403));
  }

  next();
});
exports.joinTest = catchAsync(async (req, res, next) => {
  console.log('start test join group');

  const doc = await Group.findById(req.params.id);

  if (!doc) {
    return next(new AppError('Group not found', 404));
  }

  console.log('doc.founder.user', doc.founder.user);
  console.log('doc.founder.type', doc.founder.type);
  console.log('doc.participants', doc.participants);
  console.log('doc.participants.length', doc.participants.length);
  console.log('doc.maxParticipants', doc.maxParticipants);

  console.log('req.user._id :', req.user._id);

  if (doc.founder.user.toString() === req.user._id.toString()) {
    return next(new AppError('Founder cant join his own group !', 403));
  }
  const isUserAlreadyParticipant = doc.participants.some(
    (participant) => participant.user.toString() === req.user._id.toString(),
  );

  if (isUserAlreadyParticipant) {
    console.log('user gia nel gruppo ');
    return next(
      new AppError('User is already a participant in this group', 403),
    );
  }
  if (doc.participants.length > doc.maxParticipants) {
    console.log(
      'errore doc.founder.partecipants.lenght > doc.maxPartecipants ',
    );
    return next(
      new AppError(
        'the group has already reached its maximum number of partecipants ',
        403,
      ),
    );
  }

  //////////////////////////////////////
  const newParticipant = {
    user: req.user._id,
    type: req.user.type,
  };
  console.log('new participant :', newParticipant);
  // Crea un nuovo array con i partecipanti esistenti e il nuovo partecipante
  const updatedParticipants = [...doc.participants, newParticipant];
  console.log('updateParticipants :', updatedParticipants);
  req.body.participants = updatedParticipants;
  console.log('req.body.participants :', req.body.participants);
  next();
});
// exports.createGroup = factory.createOne(Group);
exports.joinGroup = catchAsync(async (req, res, next) => {
  console.log('start join group');
  const doc = await Group.findByIdAndUpdate(
    req.params.id,
    { participants: req.body.participants },
    { new: true },
  );

  if (!doc) {
    return next(new AppError('Group not found', 404));
  }

  // Puoi accedere al documento aggiornato tramite la variabile 'doc'

  // ... Altre operazioni ...

  res.status(200).json({
    status: 'success',
    data: {
      group: doc,
    },
  });
});
exports.createGroup = catchAsync(async (req, res, next) => {
  console.log('group create section!!!!!!!!!!!!!!');
  console.log('req.body in createGroup :', req.body);
  const doc = {
    name: req.body.name,
    course: req.body.course,
    master: req.body.master,
    school: req.body.school,
    founder: {
      user: req.body.user,
      type: req.body.type,
    },
  };
  console.log('doc !!!!!!!', doc);
  const finalDoc = await Group.create(doc);
  res.status(201).json({
    status: 'success',
    data: finalDoc,
  });
});

exports.deleteGroup = factory.deleteOne(Group);
exports.getGroup = factory.getOne(Group);
exports.updateGroup = factory.updateOne(Group);
exports.getAllGroups = factory.getAll(Group);
