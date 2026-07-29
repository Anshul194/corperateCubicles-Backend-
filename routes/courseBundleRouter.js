// routes/course-bundle-routes.js
import express from 'express';
import {create,getAll,getOne,update,deleteBundle} from '../controllers/course-bundle-controller.js';
import { upload } from '../middlewares/upload-middleware.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';
import { isAdmin } from '../middlewares/isAdmin.js';

const Bundlerouter = express.Router();

// SECURITY: GETs stay public (bundle list/detail is shown to anonymous shoppers);
// mutations are admin-only.
Bundlerouter.post(
  '/',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.any(),
  create
);
Bundlerouter.get('/', getAll);
Bundlerouter.get('/:id', getOne);
Bundlerouter.put(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  upload.any(),
  update
);
Bundlerouter.delete(
  '/:id',
  accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin,
  deleteBundle
);

export default Bundlerouter;
