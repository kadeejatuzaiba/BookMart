const User=require('../models/userSchema')
const Cart = require('../models/cartSchema');




const userAuth = async (req, res, next) => {
    const sessionUser = req.session.user;
    const passportUser = req.user;

    let userId = null;

    if (sessionUser) {
        userId = sessionUser._id || sessionUser;
    } else if (passportUser) {
        userId = passportUser._id;
    }

    if (!userId) return res.redirect('/login');

    try {
        const user = await User.findById(userId);
        if (user && !user.isBlocked) {
            req.session.user = user; // Ensure session updated
            res.locals.user = user;
            return next();
        } else {
            return res.redirect('/login');
        }
    } catch (err) {
        console.log('Error in userAuth:', err);
        return res.status(500).send('Internal server error');
    }
};




const adminAuth = (req, res, next) => {
    
    if (req.session.admin && typeof req.session.admin === 'string') {
        User.findById(req.session.admin)
            .then(user => {
                if (user && user.isAdmin && !user.isBlocked) {
                    next();
                } else {
                    res.redirect('/admin/login');
                }
            })
            .catch(error => {
                console.log('Error in adminAuth middleware:', error);
                res.status(500).send('Internal server error');
            });
    } else {
        res.redirect('/admin/login');
    }
};



const setUserCounts = async (req, res, next) => {
  try {
    let wishlistCount = 0;
    let cartCount = 0;

    if (req.session.user) {
      const userId = req.session.user._id || req.session.user;

      const user = await User.findById(userId);
      wishlistCount = user?.wishlist?.length || 0;

      const cart = await Cart.findOne({ userId });
      cartCount = cart?.items?.length || 0;
    }

    // Make available in all views
    res.locals.wishlistCount = wishlistCount;
    res.locals.cartCount = cartCount;

    next();
  } catch (error) {
    console.error("Error in setUserCounts middleware:", error);
    next(); // allow to continue without crashing
  }
};


module.exports={
    userAuth,
    adminAuth,
    setUserCounts,
}