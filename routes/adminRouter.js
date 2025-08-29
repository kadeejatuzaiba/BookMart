const express=require('express')
const router=express.Router()
const adminController = require('../controllers/admin/adminController')
const customerController=require('../controllers/admin/customerController')
const categoryController=require('../controllers/admin/categoryController')
const productController=require('../controllers/admin/productController')
const orderController=require('../controllers/admin/orderController')
const couponController=require('../controllers/admin/couponController')
const salesController=require('../controllers/admin/salesController')
const {userAuth,adminAuth}=require('../middlewares/auth')


const multer = require('multer');
const path = require('path');

// Multer storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/product-images'); // your target folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const uploads = multer({ storage: storage });




router.get('/pageerror',adminController.pageerror)
// Login Management

router.get('/',adminController.loadLogin)
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/logout',adminController.logout)

// customer Management
router.get('/users',adminAuth,customerController.customerInfo)
router.get('/blockCustomer',adminAuth,customerController.customerBlocked)
router.get('/unblockCustomer',adminAuth,customerController.customerunBlocked)

// Categoey Management
router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.post('/addCategoryOffer',adminAuth,categoryController.addCategoryOffer)
router.post('/removeCategoryOffer',adminAuth,categoryController.removeCategoryOffer)
router.get('/editCategory',adminAuth,categoryController.getEditCategory)
router.post('/editcategory/:id',adminAuth,categoryController.editCategory)
router.get('/listCategory',adminAuth,categoryController.getListCategory)
router.get('/unlistCategory',adminAuth,categoryController.getUnlistcategory)
router.delete('/deleteCategory/:id',adminAuth,categoryController.deleteCategory)


// Product Management
router.get('/addProduct',adminAuth,productController.getProductAddPage)
router.post('/addProduct',adminAuth,uploads.array('images',4),productController.addProduct)
router.get('/products',adminAuth,productController.getAllProducts)
router.post('/addProductOffer',adminAuth,productController.addProductOffer)
router.post('/removeProductOffer',adminAuth,productController.removeProductOffer)
router.get('/blockproduct',adminAuth,productController.blockProduct)
router.get('/unblockproduct',adminAuth,productController.unblockProduct)
router.get('/editProduct',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id',adminAuth,uploads.array("images",4),productController.editProduct)
router.post('/deleteImage',adminAuth,productController.deleteSingleImage)

router.post('/admin/updateStock', productController.updateStock);


// Coupon Management
router.get('/coupons',adminAuth,couponController.loadCoupon)
router.post('/createCoupon',adminAuth,couponController.createCoupon)
router.post('/coupons/update/:id', adminAuth, couponController.updateCoupon);
router.get('/coupons/edit/:id', adminAuth, couponController.editCouponForm);
router.delete('/coupons/:id', adminAuth, couponController.deleteCoupon);

// Order Management
router.get('/orders',adminAuth,orderController.listOrders)
router.patch('/orders/:id/status',adminAuth, orderController.updateStatus);
router.post('/verify-return/:id', orderController.verifyReturnRequest);
router.get('/viewDetails/:id', adminAuth, orderController.viewAdminOrderDetails);
router.post('/viewDetails/:id/verify-return/:itemId', orderController.verifyProductReturn);



// Sales Management

router.get('/sales',adminAuth,salesController.getSales);
router.get('/salesReport',adminAuth,salesController.getSalesReport);

//dashboard
router.get('/dashboard',adminAuth,salesController.getDashboard)

module.exports=router;