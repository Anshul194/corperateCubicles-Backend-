import express from 'express';
import * as CartController from '../controllers/cartController.js';
import accessTokenAutoRefresh from '../middlewares/accessTokenAutoRefresh.js';
import passport from 'passport';


const router = express.Router();

router.post('/items', accessTokenAutoRefresh,  passport.authenticate('jwt', { session: false }),
 CartController.addToCart);
router.put('/items/:itemId', accessTokenAutoRefresh,  passport.authenticate('jwt', { session: false }),
 CartController.updateCartItem);
router.delete('/items/:itemId', accessTokenAutoRefresh,  passport.authenticate('jwt', { session: false }),
 CartController.removeFromCart);
router.get('/', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }), CartController.getCartItems);
router.post('/coupon', accessTokenAutoRefresh,   passport.authenticate('jwt', { session: false }),
CartController.applyCoupon);
router.delete('/course/:courseId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }),
  CartController.removeFromCartByCourseId);
router.delete('/:cartId', accessTokenAutoRefresh, passport.authenticate('jwt', { session: false }),
  CartController.deleteCartById);




export default router;
