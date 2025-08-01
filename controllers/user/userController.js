const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const creditWallet = require('./walletController').creditWallet;
const env = require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

function generateReferralCode(userName = '') {
  const prefix = userName.trim().slice(0, 2).toUpperCase() || 'XX';
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${randomDigits}`; // e.g. "KA4821"
}

module.exports = generateReferralCode;

const pageNotFound = async (req, res) => {
  try {
    res.render('page-404');
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    const categories = await Category.find({ isListed: true });
    let productData = await Product.find({
      isBlocked: false,
      category: { $in: categories.map((category) => category._id) },
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
};

const loadSignup = async (req, res) => {
  try {
    return res.render('signup');
  } catch (error) {
    console.log('Home page not loadindg:', error);
    res.status(500).send('Server Error');
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: 'verify your account',
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP : ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error('Error sending email', error);
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
};

const signup = async (req, res) => {
  try {
    const { name, phone, email, password, confirmPassword, referralCode } =
      req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.render('signup', { message: 'Passwords do not match' });
    }

    // Strong password validation (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char)
    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!strongPassword.test(password)) {
      return res.render('signup', {
        message:
          'Password must be strong: 8+ characters, mix of uppercase, lowercase, numbers & special characters',
      });
    }

    // Check if user already exists
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render('signup', {
        message: 'User with this email already exists',
      });
    }

    // Generate OTP and send email
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json('email-error');
    }

    // Store OTP and data in session
    req.session.userOtp = otp;
    req.session.userData = {
      name,
      phone,
      email,
      password,
      referralCode: referralCode || null,
    };

    res.render('verify-otp');
    console.log('OTP sent:', otp);
  } catch (error) {
    console.error('Signup error', error);
    res.redirect('/pageNotFound');
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log('Entered OTP:', otp);

    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);

      // Step 1: Generate unique referral code
      let uniqueCode;
      let isDuplicate = true;
      while (isDuplicate) {
        uniqueCode = generateReferralCode(user.name);
        const existing = await User.findOne({ referralCode: uniqueCode });
        if (!existing) isDuplicate = false;
      }

      // Step 2: Create new user with referral fields
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
        referralCode: uniqueCode,
        referredBy: user.referralCode || null,
      });

      await saveUserData.save();

      // Step 3: If user was referred, credit ₹25 to both users
      if (user.referralCode) {
        const referrer = await User.findOne({
          referralCode: user.referralCode,
        });
        if (referrer) {
          await creditWallet(
            referrer._id,
            25,
            'Referral bonus for inviting a friend'
          );
          await creditWallet(
            saveUserData._id,
            25,
            'Referral bonus for using referral code'
          );
        }
      }

      // Step 4: Store session and redirect
      req.session.user = saveUserData; // store full user object
      res.json({ success: true, redirectUrl: '/' });
    } else {
      res
        .status(400)
        .json({ success: false, message: 'Invalid OTP, please try again' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'An error occurred' });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'Email not found in session' });
    }

    const otp = generateOtp();
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log('Resend OTP :', otp);
      res
        .status(200)
        .json({ success: true, message: 'OTP Resend successfully' });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP.Please try again',
      });
    }
  } catch (error) {
    console.error('Error rensending OTP', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error.Please try again ',
    });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render('login');
    } else {
      res.redirect('/');
    }
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Simple check for empty fields
    if (!email || !password) {
      return res.render('login', {
        message: 'Email and password are required',
      });
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

const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log('Session destruction error', err.message);
        return res.redirect('/pageNotFound');
      }
      return res.redirect('/login');
    });
  } catch (error) {
    console.log('Logout error', error);
    res.redirect('/pageNotFound');
  }
};

const loadShoppingPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = userId ? await User.findById(userId) : null;
    const categories = await Category.find({ isListed: true });
    const categoryIds = categories.map((cat) => cat._id.toString());

    // Extract query params
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const search = req.query.search || '';
    const sort = req.query.sort || 'newest';
    const gt = parseInt(req.query.gt) || 0;
    const lt = parseInt(req.query.lt) || 1000000;
    const categoryFilter = req.query.category || null;

    // Build product query
    const query = {
      isBlocked: false,
      category: { $in: categoryIds },
      regularPrice: { $gt: gt, $lt: lt },
    };

    if (categoryFilter) {
      query.category = categoryFilter;
    }

    if (search) {
      query.productName = { $regex: search, $options: 'i' };
    }

    // Sort
    let sortOption = {};
    if (sort === 'price-asc') sortOption.salePrice = 1;
    else if (sort === 'price-desc') sortOption.salePrice = -1;
    else if (sort === 'name-asc') sortOption.productName = 1;
    else if (sort === 'name-desc') sortOption.productName = -1;
    else sortOption.createdAt = -1; // default: newest

    // Fetch and update products
    let products = await Product.find(query)
      .populate('category')
      .sort(sortOption)
      .lean();

    // Apply best offer logic
    products = products.map((product) => {
      const productOffer = product.productOffer || 0;
      const categoryOffer = product.category?.categoryOffer || 0;
      const appliedOffer = Math.max(productOffer, categoryOffer);
      const salePrice =
        product.regularPrice - (product.regularPrice * appliedOffer) / 100;
      return {
        ...product,
        salePrice: Math.round(salePrice),
        appliedOffer,
      };
    });

    const totalProducts = products.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const paginatedProducts = products.slice((page - 1) * limit, page * limit);

    res.render('shop', {
      user: userData,
      products: paginatedProducts,
      category: categories,
      totalPages,
      currentPage: page,
      sort,
      search,
      gt,
      lt,
      selectedCategory: categoryFilter,
    });
  } catch (error) {
    console.log('Error loading shop page:', error);
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
};
