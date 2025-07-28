const Product=require('../../models/productSchema')
const Categoey=require('../../models/categorySchema')
const User=require('../../models/userSchema')


const fs=require('fs')
const path=require('path')
const sharp=require('sharp')

const getProductAddPage = async (req, res) => {

    try {
        const category=await Categoey.find({isListed:true})
        
        res.render('product-add',{
            cat:category

        })
    } catch (error) {
        res.redirect('/admin/pageerror')
    }
}

const addProduct=async(req,res)=>{
    try {
        const products=req.body
        const productExists=await Product.findOne({
            productName:products.productName,
        })
        if(!productExists){
            const images=[]
            

            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
            
                    const ext = path.extname(req.files[i].filename); // e.g., .jpg
                    const nameWithoutExt = path.basename(req.files[i].filename, ext);
                    const resizedFilename = `${nameWithoutExt}-resized${ext}`;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', resizedFilename);
            
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
            
                    images.push(resizedFilename);
                }
            }
            

            const categoryId=await Categoey.findOne({name:products.category})
            if(!categoryId){
                return  res.status(400).json('Invalid category name')
            }


            const regularPrice = parseFloat(products.regularPrice);
const category = await Categoey.findById(categoryId._id);
const productOffer = 0; // initially 0
const categoryOffer = category?.categoryOffer || 0;
const bestDiscount = Math.max(productOffer, categoryOffer);
const salePrice = Math.round(regularPrice * (1 - bestDiscount / 100));

const newProduct = new Product({
    productName: products.productName,
    author: products.author,
    description: products.description,
    category: categoryId._id,
    regularPrice,
    salePrice,
    quantity: products.quantity,
    image: images, 
    status: 'active'
});

            
              
              await newProduct.save();
              return res.redirect('/admin/addProduct')
        }else{
            return res.status(400).json({message:"Product already exists,Please try with another name"})
        }
    } catch (error) {
        console.error('Error saving product',error)
        return res.redirect('/admin/pageerror')
    }
}
const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const low = req.query.low === '1'; // checkbox to show low stock products

    const filter = {};

    // Apply search filter
    if (search.trim() !== "") {
      filter.$or = [
        { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
        { author: { $regex: new RegExp(".*" + search + ".*", "i") } }
      ];
    }

    // Apply low stock filter
    if (low) {
      filter.quantity = { $lt: 5 };
    }

    const productData = await Product.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('category')
      .exec();

    const count = await Product.countDocuments(filter);

    const category = await Categoey.find({ isListed: true });

    if (category) {
      res.render('products', {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
        search,
        low
      });
    } else {
      res.render('page-404');
    }

  } catch (error) {
    console.log("❌ Error in getAllProducts:", error);
    res.redirect('/admin/pageerror');
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId, discount } = req.body;
    if (!productId || discount <= 0 || discount > 90)
      return res.status(400).json({ status:false, message:'Invalid data' });

    const product = await Product.findById(productId).populate('category');
    if (!product) return res.status(404).json({ status:false, message:'Not found' });

    product.productOffer = discount;

    // Re‑compute salePrice against category offer
    const best = Math.max(discount, product.category?.categoryOffer || 0);
    product.salePrice = Math.round(product.regularPrice * (1 - best/100));

    await product.save();
    res.json({ status:true });
  } catch (err) {
    console.error('addProductOffer', err);
    res.status(500).json({ status:false, message:'Server error' });
  }
};


const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId).populate('category');
    if (!product) return res.status(404).json({ status:false, message:'Not found' });

    product.productOffer = 0;

    // Re‑compute salePrice based on only category offer
    const best = product.category?.categoryOffer || 0;
    product.salePrice = Math.round(product.regularPrice * (1 - best/100));

    await product.save();
    res.json({ status:true });
  } catch (err) {
    console.error('removeProductOffer', err);
    res.status(500).json({ status:false, message:'Server error' });
  }
};


const getEditProduct = async (req, res) => {
    try {
      const id = req.query.id;
      const productDoc = await Product.findOne({ _id: id }).populate('category');
  
      const product = productDoc.toObject(); // Convert to plain object
  
      const category = await Categoey.find({});
  
      res.render('edit-product', {
        product: {
          ...product,
          images: product.image || [], // Ensure `images` exists
        },
        cat: category,
      });

    } catch (error) {
      console.error(error);
      res.redirect('/admin/pageerror');
    }
  };



const editProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const existingProduct = await Product.findOne({
      productName: data.productName,
      _id: { $ne: id }
    });

    if (existingProduct) {
      return res.status(400).json({ error: 'Product with this name already exists.' });
    }

    // Add new images if any
    const newImages = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        newImages.push(file.filename);
      });
    }

    const product = await Product.findById(id);
    if (!product) return res.redirect('/admin/pageerror');

    // Handle image deletion from form
    const imagesToDelete = Array.isArray(req.body.imagesToDelete) ? req.body.imagesToDelete : (req.body.imagesToDelete ? [req.body.imagesToDelete] : []);

    if (imagesToDelete.length > 0) {
      imagesToDelete.forEach(img => {
        const imagePath = path.join(__dirname, '../public/uploads/product-images', img);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

        const index = product.image.indexOf(img);
        if (index > -1) {
          product.image.splice(index, 1); // remove from array
        }
      });
    }

    // Add new images to existing image array
    if (newImages.length > 0) {
      product.image.push(...newImages);
    }

    // Update other fields
    product.productName = data.productName;
    product.author = data.author;
    product.description = data.description;
    product.category = data.category;
    product.regularPrice = data.regularPrice;
    // product.salePrice = data.salePrice;

    const categoryDoc = await Categoey.findById(product.category);
const productOffer = product.productOffer || 0;
const categoryOffer = categoryDoc?.categoryOffer || 0;
const bestDiscount = Math.max(productOffer, categoryOffer);
product.salePrice = Math.round(product.regularPrice * (1 - bestDiscount / 100));


    product.quantity = data.quantity;

    await product.save();

    res.redirect('/admin/products');
  } catch (error) {
    console.error("Edit product error:", error);
    res.redirect('/admin/pageerror');
  }
};


  const deleteSingleImage = async (req, res) => {
  try {
    const { imageNameToServer, productIdToServer } = req.body;

    // Remove image from product
    await Product.findByIdAndUpdate(productIdToServer, {
      $pull: { image: imageNameToServer }
    });

    // Build image path
    const imagePath = path.join(__dirname, '../public/uploads/product-images', imageNameToServer);

    // Delete image from filesystem
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }

    // Respond with JSON
    res.json({ status: true });
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ status: false, message: "Server error while deleting image" }); // ✅ Return JSON, not redirect
  }
};
  
const blockProduct=async(req,res)=>{
  try {
    let id=req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:true}})
    res.redirect('/admin/products')
  } catch (error) {
    res.redirect('/admin/pageerror')
  }
}

const unblockProduct=async(req,res)=>{
  try {
    let id=req.query.id;
    await Product.updateOne({_id:id},{$set:{isBlocked:false}})
    res.redirect('/admin/products')
  } catch (error) {
    res.redirect('/admin/pageerror')
  }
}


const updateStock = async (req, res) => {
  try {
    const { id, qty } = req.body;
    const quantity = Number(qty);

    if (!id || isNaN(quantity) || quantity < 0) {
      return res.json({ ok: false, msg: 'Invalid data' });
    }

    await Product.findByIdAndUpdate(id, { quantity });
    res.json({ ok: true });
  } catch (err) {
    console.error('updateStock error:', err);
    res.status(500).json({ ok: false, msg: 'Server error' });
  }
};


module.exports={
    getProductAddPage,
    addProduct,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    updateStock
}