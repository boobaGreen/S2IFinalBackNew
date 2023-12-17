//groupRoutes.js
const express = require('express');
const groupController = require('../controllers/groupController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });
router.use(authController.protect);
// POST /tour/234fad4/reviews
// GET /tour/234fad4/reviews
// POST /reviews
router.route('/').get(groupController.getAllGroups).post(
  //   authController.restrictTo('admin'),
  groupController.setUserDetails,
  groupController.createGroup,
);

router
  .route('/:id')
  .get(groupController.getGroup)
  .patch(groupController.updateGroup)
  .delete(groupController.isFounder, groupController.deleteGroup);

router
  .route('/:id/chat')
  .get(authController.protect, groupController.getGroupChat);

router
  .route('/join/:id')
  .patch(groupController.joinTest, groupController.joinGroup);

module.exports = router;
