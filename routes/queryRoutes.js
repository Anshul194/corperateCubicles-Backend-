import express from 'express';
import { createQuery, getAllQueries, getQueryById, updateQuery } from '../controllers/QueryController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import { isAdmin } from '../middlewares/isAdmin.js';
import passport from 'passport';

const queryRouter = express.Router();

queryRouter.post('/', createQuery);      // Public — create a query
queryRouter.get('/', accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin, getAllQueries);     // Admin — get all queries
queryRouter.get('/:id', accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin, getQueryById);   // Admin — get query by ID
queryRouter.put('/:id', accessTokenAutoRefresh,
  passport.authenticate('jwt', { session: false }),
  isAdmin, updateQuery);    // Admin — update query

export default queryRouter;
