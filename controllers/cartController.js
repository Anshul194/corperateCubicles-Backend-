import Cart from '../models/Cart.js';
import Course from '../models/Course.js';
import CourseBundle from '../models/CourseBundle.js';
import mongoose from 'mongoose';

// Utility to calculate cart totals
const calculateCartTotals = (items, discount = 0) => {
    const subTotal = items.reduce((sum, item) => sum + parseFloat(item.priceSnapshot || 0), 0);
    const grandTotal = subTotal - parseFloat(discount || 0);
    return { subTotal, grandTotal };
};

// Add item to cart
export const addToCart = async (req, res) => {
    try {
        //console.log('Request to add item to cart:', { userId: req.user._id, body: req.body });
        const userId = req.user._id;
        const { courseId, courseBundleId } = req.body;

        if (!courseId && !courseBundleId) {
            return res.status(400).json({ message: 'Either courseId or courseBundleId is required' });
        }
        if (courseId && courseBundleId) {
            return res.status(400).json({ message: 'Only one of courseId or courseBundleId can be provided' });
        }

        let item, price, currency, itemType;

        if (courseId) {
            if (!mongoose.Types.ObjectId.isValid(courseId)) {
                return res.status(400).json({ message: 'Invalid courseId' });
            }
            item = await Course.findById(courseId);
            if (!item) return res.status(404).json({ message: 'Course not found' });
            price = item.salePrice || item.discountPrice || item.price; // <-- Prefer salePrice if set
            currency = item.currency;
            itemType = 'course';
        } else {
            if (!mongoose.Types.ObjectId.isValid(courseBundleId)) {
                return res.status(400).json({ message: 'Invalid courseBundleId' });
            }
            item = await CourseBundle.findById(courseBundleId);
            if (!item) return res.status(404).json({ message: 'Course bundle not found' });
            price = item.discount || item.price;
            currency = item.currency;
            itemType = 'courseBundle';
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            //console.log('No cart found, creating new cart for user:', userId);
            cart = new Cart({ userId, items: [], subTotal: 0, grandTotal: 0 });
        }

        const alreadyInCart = cart.items.find(item => 
            (item.type === 'course' && item.courseId && item.courseId.toString() === courseId) ||
            (item.type === 'courseBundle' && item.courseBundleId && item.courseBundleId.toString() === courseBundleId)
        );
        if (alreadyInCart) {
            return res.status(400).json({ message: `${itemType === 'course' ? 'Course' : 'Course bundle'} already in cart` });
        }

        cart.items.push({
            [itemType === 'course' ? 'courseId' : 'courseBundleId']: item._id,
            type: itemType,
            priceSnapshot: price,
            currency
        });

        const totals = calculateCartTotals(cart.items, parseFloat(cart.discount || 0));
        cart.subTotal = totals.subTotal;
        cart.grandTotal = totals.grandTotal;

        await cart.save();
        //console.log('Cart updated:', cart);
        res.status(200).json({ message: `${itemType === 'course' ? 'Course' : 'Course bundle'} added to cart`, cart });
    } catch (err) {
        console.error('Error adding to cart:', err);
        res.status(500).json({ message: 'Error adding to cart', error: err.message });
    }
};

// Update cart item
export const updateCartItem = async (req, res) => {
    try {
        const userId = req.user._id;
        const { itemId } = req.params;
        // Never trust a client-supplied price. priceSnapshot is set server-side
        // only (in addToCart, from the real Course/CourseBundle price) and must
        // not be updatable here, to prevent price tampering at checkout.
        const { currency } = req.body;
        //console.log('Request to update cart item:', { userId, itemId, currency });

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            //console.log('No cart found, creating new cart for user:', userId);
            cart = new Cart({ userId, items: [], subTotal: 0, grandTotal: 0 });
            await cart.save();
            return res.status(404).json({ message: 'Cart is empty, no items to update' });
        }

        const item = cart.items.id(itemId);
        if (!item) {
            //console.log('Item not found in cart:', itemId);
            return res.status(404).json({ message: 'Cart item not found' });
        }

        if (currency) item.currency = currency;

        const totals = calculateCartTotals(cart.items, parseFloat(cart.discount || 0));
        cart.subTotal = totals.subTotal;
        cart.grandTotal = totals.grandTotal;

        await cart.save();
        //console.log('Cart item updated:', cart);
        res.status(200).json({ message: 'Cart item updated', cart });
    } catch (err) {
        console.error('Error updating cart item:', err);
        res.status(500).json({ message: 'Error updating cart item', error: err.message });
    }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { itemId } = req.params;
        //console.log('Request to remove item from cart:', { userId, itemId });

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            //console.log('No cart found for user:', userId.toString());
            cart = new Cart({ userId, items: [], subTotal: 0, grandTotal: 0 });
            await cart.save();
            return res.status(404).json({ message: 'Cart is empty, no items to remove' });
        }

        // //console.log('Cart items:', cart.items.map(item => ({
        //     id: item._id.toString(),
        //     courseId: item.courseId?.toString(),
        //     courseBundleId: item.courseBundleId?.toString(),
        //     type: item.type
        // })));

        const itemIndex = cart.items.findIndex(i => i._id.toString() === itemId);
        // //console.log('Item index found:', itemIndex);
        if (itemIndex === -1) {
            // //console.log('Item not found in cart:', itemId);
            return res.status(404).json({ message: 'Cart item not found' });
        }

        const removedItem = cart.items[itemIndex];
        cart.items.splice(itemIndex, 1);

        const totals = calculateCartTotals(cart.items, parseFloat(cart.discount || 0));
        cart.subTotal = totals.subTotal;
        cart.grandTotal = totals.grandTotal;

        await cart.save();
        // //console.log('Item removed, updated cart:', cart);
        res.status(200).json({
            message: `Item (${
                removedItem.type === 'course' ? 'Course' : 'Course bundle'
            }) removed from cart`,
            cart
        });
    } catch (err) {
        // console.error('Error removing cart item:', err);
        res.status(500).json({ message: 'Error removing cart item', error: err.message });
    }
};

// Get cart items
export const getCartItems = async (req, res) => {
    try {
        const userId = req.user._id;
        // //console.log('Request to get cart items for user:', userId.toString());

        let cart = await Cart.findOne({ userId })
            .populate('items.courseId')
            .populate('items.courseBundleId');
        if (!cart) {
            // //console.log('No cart found, creating new cart for user:', userId.toString());
            cart = new Cart({ userId, items: [], subTotal: 0, grandTotal: 0 });
            await cart.save();
        }

        // //console.log('Cart retrieved:', cart);
        res.status(200).json(cart);
    } catch (err) {
        // console.error('Error fetching cart:', err);
        res.status(500).json({ message: 'Error fetching cart', error: err.message });
    }
};

// Apply coupon to cart
export const applyCoupon = async (req, res) => {
    try {
        const userId = req.user._id;
        const { code } = req.body;
        // //console.log('Request to apply coupon:', { userId, code });

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            // //console.log('No cart found, creating new cart for user:', userId.toString());
            cart = new Cart({ userId, items: [], subTotal: 0, grandTotal: 0 });
            await cart.save();
            return res.status(404).json({ message: 'Cart is empty, no items to apply coupon to' });
        }

        let discount = 0;
        if (code === 'DISCOUNT10') {
            discount = parseFloat(cart.subTotal) * 0.1;
        } else {
            return res.status(400).json({ message: 'Invalid coupon code' });
        }

        cart.discount = discount;
        cart.couponCode = code;

        const totals = calculateCartTotals(cart.items, discount);
        cart.grandTotal = totals.grandTotal;

        await cart.save();
        // //console.log('Coupon applied, updated cart:', cart);
        res.status(200).json({ message: 'Coupon applied', cart });
    } catch (err) {
        // console.error('Error applying coupon:', err);
        res.status(500).json({ message: 'Error applying coupon', error: err.message });
    }
};

// Remove item from cart by courseId
export const removeFromCartByCourseId = async (req, res) => {
    try {
        const userId = req.user._id;
        const { courseId } = req.params;
        // //console.log('Request to remove course from cart:', { userId, courseId });

        if (!mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ message: 'Invalid courseId' });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            // //console.log('No cart found for user:', userId.toString());
            cart = new Cart({ userId, items: [], subTotal: 0, grandTotal: 0 });
            await cart.save();
            return res.status(404).json({ message: 'Cart is empty, no items to remove' });
        }

        // //console.log('Cart items:', cart.items.map(item => ({
        //     id: item._id.toString(),
        //     courseId: item.courseId?.toString(),
        //     courseBundleId: item.courseBundleId?.toString(),
        //     type: item.type
        // })));

        const itemIndex = cart.items.findIndex(item => 
            item.type === 'course' && item.courseId && item.courseId.toString() === courseId
        );

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Course not in cart' });
        }

        const removedItem = cart.items[itemIndex];
        cart.items.splice(itemIndex, 1);
        const totals = calculateCartTotals(cart.items, parseFloat(cart.discount || 0));
        cart.subTotal = totals.subTotal;
        cart.grandTotal = totals.grandTotal;

        await cart.save();
        // //console.log('Course removed, updated cart:', cart);
        res.status(200).json({ message: 'Course removed from cart', cart });
    } catch (err) {
        console.error('Error removing course from cart:', err);
        res.status(500).json({ message: 'Error removing item by courseId', error: err.message });
    }
};

// Delete cart by cartId
export const deleteCartById = async (req, res) => {
    try {
        const userId = req.user._id;
        const { cartId } = req.params;
        // //console.log('Request to delete cart:', { userId, cartId });

        if (!mongoose.Types.ObjectId.isValid(cartId)) {
            return res.status(400).json({ message: 'Invalid cart ID' });
        }

        const cart = await Cart.findOneAndDelete({ _id: cartId, userId });
        if (!cart) {
            //console.log('No cart found for cartId:', cartId);
            return res.status(404).json({ message: 'Cart not found' });
        }

        //console.log('Cart deleted:', cart);
        res.status(200).json({ message: 'Cart deleted successfully', cart });
    } catch (err) {
        console.error('Error deleting cart:', err);
        res.status(500).json({ message: 'Error deleting cart by ID', error: err.message });
    }
};