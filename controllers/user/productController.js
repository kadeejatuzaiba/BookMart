const Product=require('../../models/productSchema')
const Category=require('../../models/categorySchema')
const User=require('../../models/userSchema')


const productDetails=async(req,res)=>{
    try {
        const userId=req.session.user;
        const userData=await User.findById(userId)
        const productId=req.query.id;
   

        const product=await Product.findById(productId).populate('category')

        
         if (!product || product.isBlocked ) {
      return res.redirect('/shop');
    }


        const findCategory=product.category;
        const categoryOffer = product.category?.categoryOffer || 0;
const productOffer = product.productOffer || 0;
const totalOffer = Math.max(categoryOffer, productOffer);
const salePrice = product.regularPrice - (product.regularPrice * totalOffer / 100);

        const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isBlocked: false,
    //   quantity: { $gt: 0 },
    })
      .limit(4)
      .lean();
        res.render('product-details',{
            user:userData,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
            salePrice:salePrice,
            relatedProducts,
        })
    } catch (error) {
        console.log('Error for fetching product details',error)
        res.redirect('/pageNotFound')
    }
}

module.exports={
    productDetails,
}