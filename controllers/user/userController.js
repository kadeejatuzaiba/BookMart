const User=require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product=require('../../models/productSchema')
const env=require('dotenv').config()
const nodemailer=require('nodemailer')
const bcrypt=require('bcrypt')

const pageNotFound=async(req,res)=>{
    try {
        res.render('page-404')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            // quantity: { $gt: 0 }
        });

        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 4);

        if (user) {
            const userData = await User.findOne({ _id: user._id });
            res.render('home', { user: userData, products: productData }); // ✅ lowercase
        } else {
            res.render('home', { products: productData });
        }

    } catch (error) {
        console.log('Home page not found: ', error);
        res.status(500).send('Server error');
    }
}


const loadSignup=async(req,res)=>{
    try {
        return res.render('signup')
    } catch (error) {
        console.log('Home page not loadindg:',error)
        res.status(500).send('Server Error')
    }
}


function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp) {
    try {
        
        const transporter=nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info=await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP : ${otp}</b>`
        })

        return info.accepted.length >0

    } catch (error) {
        console.error("Error sending email",error)
        return false;
    }
}

const securePassword = async (password) => {
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      return passwordHash;
    } catch (error) {
      console.error('Password hashing failed', error);
    }
  }
  

const signup = async (req, res) => {
    try {
      const { name, phone, email, password, confirmPassword } = req.body;
  
      // Check if passwords match
      if (password !== confirmPassword) {
        return res.render('signup', { message: "Passwords do not match" });
      }
  
      // Strong password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
      const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!strongPassword.test(password)) {
        return res.render('signup', { message: "Password must be strong: 8+ characters, mix of uppercase, lowercase, numbers & special characters" });
      }
  
      // Check if user already exists
      const findUser = await User.findOne({ email });
      if (findUser) {
        return res.render('signup', { message: "User with this email already exists" });
      }
  
      // Generate OTP and send email
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
      if (!emailSent) {
        return res.json('email-error');
      }
  
      // Store OTP and data in session
      req.session.userOtp = otp;
      req.session.userData = { name, phone, email, password };
  
      res.render("verify-otp");
      console.log('OTP sent:', otp);
  
    } catch (error) {
      console.error('Signup error', error);
      res.redirect('/pageNotFound');
    }
  };
  

const verifyOtp=async(req,res)=>{
    try {
        const {otp}=req.body;
        console.log(otp)

        if(otp===req.session.userOtp){
            const user=req.session.userData
            const passwordHash=await securePassword(user.password)

            const saveUserData=new User({
              name:user.name,
              email:user.email,
              phone:user.phone,
             
            password:passwordHash 
            })

            await saveUserData.save();
            //  req.session.user=saveUserData._id;

            req.session.user = saveUserData; // ✅ full user object


            res.json({success:true, redirectUrl:'/'})
        }else{
            res.status(400).json({success:false,message:'Invalid OTP,Please try again'})
        }
    } catch (error) {
        console.error('Error verifying OTP',error);
        res.status(500).json({success:false,message:"An error occured"})
    }
}


const resendOtp=async(req,res)=>{
    try {
        const {email}=req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:'Email not found in session'})
        }

        const otp =generateOtp()
        req.session.userOtp=otp;

        const emailSent=await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log('Resend OTP :',otp)
            res.status(200).json({success:true,message:"OTP Resend successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP.Please try again"})
        }
    } catch (error) {
        console.error("Error rensending OTP",error)
        res.status(500).json({success:false,message:"Internal Server Error.Please try again "})
    }
}


const loadLogin=async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render('login')
        }else{
            res.redirect('/')
        }
    } catch (error) {
    res.redirect('/pageNotFound')
    }
}



const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Simple check for empty fields
    if (!email || !password) {
      return res.render('login', { message: 'Email and password are required' });
    }

    const findUser = await User.findOne({ isAdmin: 0, email: email });
    if (!findUser) {
      return res.render('login', { message: 'User not found' });
    }

    if (findUser.isBlocked) {
      return res.render('login', { message: 'User is blocked by admin' });
    }

    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render('login', { message: 'Incorrect Password' });
    }

   req.session.user = findUser;
  

    res.redirect('/');
  } catch (error) {
    console.error('login error', error);
    res.render('login', { message: 'Login failed. Please try again later' });
  }
};


const logout=async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message)
                return res.redirect('/pageNotFound')
            }
           return res.redirect('/login')
        })
        
    } catch (error) {
        console.log('Logout error',error)
        res.redirect('/pageNotFound')
    }
}

// const loadShoppingPage=async(req,res)=>{
//     try {
//       req.session.filteredProducts=null;
//         const user=req.session.user;
//         const userData=await User.findOne({_id:user})
//         const categories=await Category.find({isListed:true})
//         const categoryIds=categories.map((category)=>category._id.toString())
//         const page=parseInt(req.query.page) || 1;
//         const limit=6;
//         const skip=(page-1)*limit;
     
//         const products = await Product.find({
//     isBlocked: false,
//     category: { $in: categoryIds },
//     // quantity: { $gt: 0 },
// })
// .populate('category')
// .sort({ createdOn: -1 })
// .skip(skip)
// .limit(limit)
// .lean();

        
//         const totalProducts=await Product.countDocuments({
//             isBlocked:false,
//             category:{$in:categoryIds},
//             // quantity:{$gt:0}
//         })
//         const totalPages=Math.ceil(totalProducts/limit)

//         const categoriesWithIds=categories.map(category=>({_id:category._id,name:category.name}))
//         res.render('shop',{
//             user:userData,
//             products:products,
//             category:categoriesWithIds,
//             totalProducts:totalProducts,
//             currentPage:page,
//             totalPages:totalPages
//         })
//     } catch (error) {
//         res.redirect('/page')
//     }
// }


const loadShoppingPage = async (req, res) => {
  try {
    req.session.filteredProducts = null;

    const user = req.session.user;
    const userData = await User.findById(user);

    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map(category => category._id.toString());

    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    // Fetch products
    const products = await Product.find({
      isBlocked: false,
      category: { $in: categoryIds },
      // quantity: { $gt: 0 },
    })
      .populate('category')
      .sort({ createdAt: -1 }) // correct key is createdAt not createdOn
      .skip(skip)
      .limit(limit)
      .lean();

    // Apply best offer (productOffer or categoryOffer) to calculate salePrice dynamically
    const updatedProducts = products.map(product => {
      const productOffer = product.productOffer || 0;
      const categoryOffer = product.category?.categoryOffer || 0;
      const appliedOffer = Math.max(productOffer, categoryOffer);

      const salePrice = product.regularPrice - (product.regularPrice * appliedOffer / 100);

      return {
        ...product,
        salePrice: Math.round(salePrice), // overwrite existing salePrice if needed
        appliedOffer
      };
    });

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      category: { $in: categoryIds },
      // quantity: { $gt: 0 }
    });

    const totalPages = Math.ceil(totalProducts / limit);

    const categoriesWithIds = categories.map(category => ({
      _id: category._id,
      name: category.name
    }));

    res.render('shop', {
      user: userData,
      products: updatedProducts, // use updated products with salePrice
      category: categoriesWithIds,
      totalProducts,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log("Error loading shopping page:", error);
    res.redirect('/page');
  }
};


const filterProduct=async(req,res)=>{
    try {
        const user=req.session.user
        const category=req.query.category
        const findCategory=category?await Category.findOne({_id:category}):null
        const query={
            isBlocked:false,
            // quantity:{$gt:0}
        }
        if(findCategory){
            query.category=findCategory._id;
        }
        // let findProducts=await Product.find(query).lean()
       let findProducts = await Product.find(query).populate('category').lean();

        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))


        const categories=await Category.find({isListed:true})
        let itemsPerPage=6
        let currentPage=parseInt(req.query.page) || 1;
        let startIndex=(currentPage-1)*itemsPerPage
        let endIndex=startIndex+itemsPerPage
        let totalPages=Math.ceil(findProducts.length/itemsPerPage)
        const currentProduct=findProducts.slice(startIndex,endIndex)
        let userData=null;
        if(user){
            userData=await User.findOne({_id:user})
            if(userData){
                const searchEntry={
                    category:findCategory?findCategory._id:null,
                    searchedOn:new Date()

                }
                userData.searchHistory.push(searchEntry)
                await userData.save();
            }
        }
        req.session.filteredProducts=currentProduct;
        res.render('shop',{
            user:userData,
            products:currentProduct,
            category:categories,
            totalPages,
            currentPage,
            selectedCategory:category || null
        })

    } catch (error) {
        console.error('Filter error:', error);
        res.redirect('/pageNotFound')
    }
}

const filterByPrice=async(req,res)=>{
    try {
        const user=req.session.user;
        const userData=await User.findOne({_id:user})
        const categories=await Category.find({isListed:true}).lean();

        

        let findProducts =await Product.find({
            salePrice:{$gt:req.query.gt,$lt:req.query.lt},
            isBlocked:false,
            // quantity:{$gt:0}
        }).lean();

        findProducts.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn))
        let itemsPerPage=6;
        let currentPage=parseInt(req.query.page) || 1;
        let startIndex=(currentPage-1)*itemsPerPage;
        let endIndex=startIndex+itemsPerPage;
        let totalPages=Math.ceil(findProducts.length/itemsPerPage)
        const currentProduct=findProducts.slice(startIndex,endIndex);
        req.session.filteredProducts=findProducts;
        res.render('shop',{
            user:userData,
            products:currentProduct,
            category:categories,
            totalPages,
            currentPage,
        })

    } catch (error) {
        console.log(error)
        res.redirect('/pageNotFound')
        
    }
}

const sortProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    const categories = await Category.find({ isListed: true }).lean();

    const sort = req.query.sort;
const gt = req.query.gt;
const lt = req.query.lt;


    let sortOption = {};
    const sortParam = req.query.sort;

    // Decide sort condition
    if (sortParam === "price-asc") {
      sortOption.salePrice = 1;
    } else if (sortParam === "price-desc") {
      sortOption.salePrice = -1;
    } else if (sortParam === "name-asc") {
      sortOption.productName = 1;
    } else if (sortParam === "name-desc") {
      sortOption.productName = -1;
    } else {
      sortOption.createdOn = -1; // default: newest first
    }

    // Pagination
    const itemsPerPage = 6;
    const currentPage = parseInt(req.query.page) || 1;

    const totalProducts = await Product.countDocuments({
      isBlocked: false,
      // quantity: { $gt: 0 },
    });

    const products = await Product.find({
      isBlocked: false,
      // quantity: { $gt: 0 },
    })
      .sort(sortOption)
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .lean();

    const totalPages = Math.ceil(totalProducts / itemsPerPage);

    
    res.render('shop', {
  user: userData,
  products,
  category: categories,
  totalPages,
  currentPage,
  sort,
  gt,
  lt
});


  } catch (error) {
    console.log(error);
    res.redirect("/pageNotFound");
  }
};


const searchProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });

    let search = req.body.search || ""; // use correct field name from form

    const categories = await Category.find({ isListed: true }).lean();
    const categoryIds = categories.map(c => c._id.toString());

    let searchResult = [];

    if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
      searchResult = req.session.filteredProducts.filter(product =>
        product.productName.toLowerCase().includes(search.toLowerCase())
      );
    } else {
      searchResult = await Product.find({
        productName: { $regex: ".*" + search + ".*", $options: "i" },
        isBlocked: false,
        // quantity: { $gt: 0 },
        category: { $in: categoryIds }
      });
    }

    searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    let itemsPerPage = 6;
    let currentPage = parseInt(req.query.page) || 1;
    let startIndex = (currentPage - 1) * itemsPerPage;
    let endIndex = startIndex + itemsPerPage;
    let totalPages = Math.ceil(searchResult.length / itemsPerPage);
    const currentProduct = searchResult.slice(startIndex, endIndex);

    res.render('shop', {
      user: userData,
      products: currentProduct,
      category: categories,
      totalPages,
      currentPage,
      count: searchResult.length,
    });
  } catch (error) {
    console.log("Error:", error);
    res.redirect('/pageNotFound');
  }
};


module.exports = {
    loadHomepage,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    pageNotFound,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    sortProducts,
    searchProducts,
};
