const User=require('../../models/userSchema')
const Product=require('../../models/productSchema')
const Cart = require('../../models/cartSchema');



const loadWishlist=async(req,res)=>{
    try {
        const userId=req.session.user;
        // console.log('Session:', req.session);

        const user=await User.findById(userId)
        const products=await Product.find({_id:{$in:user.wishlist}}).populate('category')
        res.render('wishlist',{
            user,
            wishlist:products,
        })
    } catch (error) {
        console.log(error)
        res.redirect('/pageNotFound')
    }
} 

const addToWishlist = async (req, res) => {
  try {
    const productId = req.body.productId;
    const userId = req.session.user;

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId });

    // ✅ Check if product is already in cart
    const isInCart = cart?.items?.some(item => item.productId.toString() === productId);
    if (isInCart) {
      return res.status(200).json({
        status: false,
        message: 'Product already in cart',
      });
    }

    // ✅ Check if product already in wishlist
    if (user.wishlist.includes(productId)) {
      return res.status(200).json({
        status: false,
        message: 'Product already in wishlist',
      });
    }

    user.wishlist.push(productId);
    await user.save();

    return res.status(200).json({
      status: true,
      message: 'Product added to wishlist',
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: 'Server Error',
    });
  }
};
const removeProduct=async(req,res)=>{
    try {
        const productId=req.query.productId;
        const userId=req.session.user
        const user= await User.findById(userId)
        const index=user.wishlist.indexOf(productId)
        user.wishlist.splice(index,1)
        await user.save()
        return res.redirect('/wishlist')
    } catch (error) {
        console.log(error)
        return res.status(500).json({status:false,message:'Server error'})
    }
}
module.exports={
    loadWishlist,
    addToWishlist,
    removeProduct,
}