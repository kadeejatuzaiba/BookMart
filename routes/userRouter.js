const express=require('express')
const router = express.Router()
const userController=require('../controllers/user/userController')
const passport = require('passport')
const profileController=require('../controllers/user/profileController')
const { userAuth, adminAuth,setUserCounts } = require('../middlewares/auth')
const productController=require('../controllers/user/productController')
const wishlistController=require('../controllers/user/wishlistController')
const cartController=require('../controllers/user/cartController')
const checkoutController=require('../controllers/user/checkoutController')
const orderController=require('../controllers/user/orderController')
const walletController=require('../controllers/user/walletController')
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images');
  },
  filename: function (req, file, cb) {
    const userId = req.session.user?._id || req.session.user;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
   cb(null, req.session.user._id + '-' + uniqueSuffix + ext);

  }
});

const upload = multer({ storage: storage });

router.use(setUserCounts);

router.get('/pageNotFound',userController.pageNotFound)


// Sign up Management

router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
})


//login Management
router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get('/logout',userController.logout)

//Home page && Shopping page
router.get('/',userController.loadHomepage)
router.get('/shop',userAuth,userController.loadShoppingPage)

//Profile Management
router.get('/forgot-password',profileController.getForgotPassPage);
router.post('/forgot-email-valid',profileController.forgotEmailValid)
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp)
router.get('/reset-password',profileController.getResetPassPage)
router.post('/resend-forgot-otp',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPassword)
router.get('/userProfile',userAuth,profileController.userProfile)
router.get('/editProfile',userAuth,profileController.getEditProfile)
router.post('/upload-picture', userAuth, upload.single('profilePicture'), profileController.profileUpload);


router.get('/changeEmail',userAuth,profileController.changeEmail)
router.post('/changeEmail',userAuth,profileController.changeEmailValid)
router.post('/verifyEmailOtp',userAuth,profileController.verifyEmailOtp)
router.get('/updateEmail',userAuth,profileController.getNewEmailPage);
router.post('/updateEmail',userAuth,profileController.updateEmail)
router.get('/reset-password', userAuth, profileController.getResetPasswordPage);
router.get('/change-name', userAuth, profileController.getChangeNamePage);
router.post('/change-name', userAuth, profileController.updateName);


// Address Management
router.get('/address', userAuth, profileController.getAddressPage);
router.post('/addAddress',userAuth,profileController.postAddAddress)
router.post('/edit-address/:id',userAuth, profileController.updateAddress);
router.post('/delete-address/:id',userAuth,profileController.deleteAddress)


// Product Managment
router.get('/productDetails',userAuth,productController.productDetails)

// Wishlist Management
router.get('/wishlist',userAuth,wishlistController.loadWishlist);
router.post('/toggleWishlist', userAuth,wishlistController.toggleWishlist);
router.get('/removeFromWishlist',userAuth,wishlistController.removeProduct)

// Cart Management
router.get('/cart', userAuth, cartController.loadCartPage);
router.post('/addToCart', userAuth, cartController.addToCart);
router.get('/removeFromCart',userAuth,cartController.removeProduct)
router.post('/update-quantity',userAuth,cartController.updateQuantity)
router.get("/cart/check-blocked", cartController.checkBlockedCart);


// checkout Management
router.get('/checkout',userAuth,checkoutController.checkoutPage)
router.post('/place-order',userAuth,checkoutController.placeOrder)
router.get('/order-success',userAuth,checkoutController.orderSuccess)
router.get('/payment-failure',userAuth,checkoutController. paymentFailure);
router.post('/verify-payment',userAuth,checkoutController.verifyPayment);
router.post('/apply-coupon', userAuth, checkoutController.applyCoupon);
router.delete('/remove-coupon', userAuth, checkoutController.removeCoupon);



// Order Management
router.get('/orders',userAuth,orderController.loadOrders)
router.patch('/cancel-order/:id',userAuth,orderController.cancelOrder)
router.post('/return-order/:id', userAuth, upload.array('images', 3), orderController.returnOrder);
router.get('/view-order/:id', userAuth, orderController.viewOrderDetails);
router.get('/download-invoice/:id',userAuth,orderController.getInvoice)


router.patch('/cancel-product/:orderId/:itemId', userAuth, orderController.cancelProduct);
router.patch('/return-product/:orderId/:itemId', userAuth, upload.array('images', 3), orderController.returnProduct);
router.get('/retry-payment/:orderId',userAuth,orderController.getretryPayment);



// retry payment
router.put('/retry-payment/cod/:orderId', userAuth, orderController.retryCOD);
router.put('/retry-payment/wallet/:orderId', userAuth, orderController.retryWallet);
router.post('/retry-payment/razorpay', userAuth, orderController.retryRazorpay);
router.post('/retry-payment/verify', userAuth, orderController.verifyRetryPayment);


// Wallet Management
router.get('/wallet',userAuth,walletController.loadWalletPage)
router.post('/wallet/createOrder',userAuth,walletController.createOrder)
router.post("/wallet/verifyPayment",userAuth, walletController.verifyPayment);
router.put("/wallet/withdrawMoney",userAuth,walletController.withdrawMoney);



module.exports = router;