const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema'); // Add this
const Order = require('../../models/orderSchema');
const Razorpay = require('razorpay');
const crypto   = require('crypto');
const Coupon = require('../../models/couponSchema');
const mongoose = require('mongoose');
const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


const getCartTotal = (cartItems) => {
  return cartItems.reduce((total, item) => {
    return total + item.quantity * item.product.salePrice;
  }, 0);
};




const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user;

    /* ---------- 1️⃣  Get / populate cart first ---------- */
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    /* ---------- 2️⃣  Auto‑adjust quantities ---------- */
    let cartChanged = false;

    for (const item of cart.items) {
      const stock      = item.productId.quantity;       // current stock
      const maxAllowed = Math.min(stock, 5);            // 5‑per‑item limit

      if (stock === 0) {
        // product out of stock  → remove it from cart
        item.remove();
        cartChanged = true;
        continue;
      }

      if (item.quantity > maxAllowed) {
        item.quantity   = maxAllowed;                   // reset quantity
        item.totalPrice = maxAllowed * item.productId.salePrice;
        cartChanged     = true;
      }
    }

    if (cartChanged) await cart.save();                 // save only if modified

    /* ---------- 3️⃣  Re‑fetch fresh cart data as plain objects ---------- */
    const freshCart = cart.toObject();
    const cartItems = freshCart.items.map(i => ({
      ...i,
      product: i.productId
    }));

    /* ---------- 4️⃣  Addresses, coupons, totals ---------- */
    const addressDoc = await Address.findOne({ userId }).lean();
    const addresses  = addressDoc?.address || [];
    if (addresses.length && !addresses.some(a => a.isDefault)) addresses[0].isDefault = true;

    let subtotal = 0;
    cartItems.forEach(i => (subtotal += i.totalPrice));
    const shippingCharge = 50;
    const discount       = req.session.discountAmount || 0;
    const finalTotal     = subtotal + shippingCharge - discount;

    /* ---------- 5️⃣  Valid coupons ---------- */
    const now     = new Date();
    const coupons = await Coupon.find({ startDate: { $lte: now }, endDate: { $gte: now }, isBlocked: false });

    /* ---------- 6️⃣  Render ---------- */
    return res.render('checkout', {
      user:         await User.findById(userId).lean(),
      userAddresses: addresses,
      cartItems,
      subtotal,
      shippingCharge,
      discount,
      finalTotal,
      coupons,
      appliedCoupon: req.session.appliedCoupon || null,
      quantityAdjusted: cartChanged              // ⬅ flag to show a notice, if you want
    });

  } catch (err) {
    console.error('Error loading checkout page:', err);
    return res.redirect('/pageNotFound');
  }
};



const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { selectedAddress, paymentMethod } = req.body;

    if (!userId || !selectedAddress || !paymentMethod) {
      return res.status(400).json({ status:false, message:'Missing order information.' });
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ status:false, message:'Cart is empty.' });
    }

    /* ───────── 1.  build orderedItems ───────── */
    const orderedItems = cart.items.map(i => ({
      product  : i.productId._id,
      quantity : i.quantity,
      price    : i.productId.salePrice        
    }));


    const SHIPPING = 50;

    // regular price * qty (what the book costs without any offer)
    const regularTotal = cart.items.reduce(
      (sum, i) => sum + i.quantity * i.productId.regularPrice, 0);

    // sale price * qty (already contains product / category offer)
    const saleTotal    = cart.items.reduce(
      (sum, i) => sum + i.quantity * i.productId.salePrice , 0);

    const offerDiscount   = regularTotal - saleTotal;          // product / category offer
    const couponDiscount = req.session.discountAmount || 0;  // coupon in session
    const totalDiscount   = offerDiscount + couponDiscount;

    const totalPrice  = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    const finalAmount = totalPrice + SHIPPING - couponDiscount;

    /* ───────── 3.  create Order doc ───────── */
    const order = new Order({
      orderedItems,
      totalPrice,              // ₹ before coupon
      discount: couponDiscount,
      finalAmount,
      shippingCharge: SHIPPING,
      user   : userId,
      address: selectedAddress,
      status : paymentMethod === 'cod' ? 'Confirmed' : 'Pending',
      paymentMethod,
      createdOn: new Date(),
      couponStatus: !!couponDiscount          // just a flag
    });

    /* ───────── 4.  Razorpay or COD ───────── */
    if (paymentMethod === 'razorpay') {
      const rzOrder = await rzp.orders.create({
        amount  : finalAmount * 100,
        currency: 'INR',
        receipt : `rcpt_${order._id}`
      });
      order.razorpayOrderId = rzOrder.id;
      await order.save();
      return res.json({
        status : true,
        payment: 'razorpay',
        key    : process.env.RAZORPAY_KEY_ID,
        amount : finalAmount * 100,
        orderId: order._id,
        razorpayOrderId: rzOrder.id
      });
    }

    // plain COD
    await order.save();

    /* mark coupon as used & clear session */
/* ---- coupon bookkeeping ---- */
/* ───── coupon bookkeeping (COD) ───── */
if (req.session.appliedCoupon) {
  const coupon = await Coupon.findOne({ couponName: req.session.appliedCoupon });
  if (coupon) {
    const uid = toObjectId(userId);                  // ← convert once
    const already = coupon.usedUsers.some(u => u.equals(uid));

    if (!already) {
      coupon.usedUsers.push(uid);                    // always push as ObjectId
      await coupon.save();
    }
  }
  delete req.session.appliedCoupon;
  delete req.session.discountAmount;
}


    /* stock‑down + clear cart */
    for (const i of cart.items) {
      await Product.findByIdAndUpdate(i.productId._id, { $inc: { quantity: -i.quantity } });
    }
    await Cart.deleteOne({ userId });

    res.json({ status:true, cod:true, orderId:order._id });

  } catch (err) {
    console.error('placeOrder', err);
    res.status(500).json({ status:false, message:'Server error' });
  }
};




const orderSuccess = (req, res) => {
  const orderId = req.query.orderId;
  res.render('orderSuccess', { orderId });
};


const paymentFailure = async (req, res) => {
  const { orderId } = req.query;
  try {
    const order = await Order.findById(orderId);
    
    // 🟡 If it's a Razorpay "Pending" order (not paid)
    if (order && order.status === 'Pending') {
      // Delete the user's cart to prevent retrying checkout with same products
      await Cart.deleteOne({ userId: order.user });

      // ✅ Don't delete the order — keep it in "Pending" for admin/user reference
    }

    res.render('paymentFailure', { orderId });
  } catch (err) {
    console.error("Payment failure cleanup error:", err);
    res.render('paymentFailure', { orderId });
  }
};



const verifyPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;
    const userId = req.session.user; // ⬅️ ADD THIS

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ status: false, message: "Signature mismatch" });
    }

    const order = await Order.findById(orderId);
    order.status = "Confirmed";
    order.paymentStatus = "Paid";
    order.paymentMethod = "Online";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpayOrderId = razorpay_order_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();

/* ───── coupon bookkeeping (Razorpay) ───── */
if (req.session.appliedCoupon) {
  const coupon = await Coupon.findOne({ couponName: req.session.appliedCoupon });
  if (coupon) {
    const uid = toObjectId(userId);                  // ← same helper
    const already = coupon.usedUsers.some(u => u.equals(uid));

    if (!already) {
      coupon.usedUsers.push(uid);
      await coupon.save();
    }
  }
  delete req.session.appliedCoupon;
  delete req.session.discountAmount;
}


    const cart = await Cart.findOne({ userId: order.user }).populate('items.productId');

    if (cart && cart.items.length > 0) {
      for (const item of cart.items) {
        const product = item.productId;
        product.quantity -= item.quantity;
        if (product.quantity < 0) product.quantity = 0;
        await product.save();
      }
      await Cart.deleteOne({ userId: order.user });
    }

    return res.json({ status: true });

  } catch (err) {
    console.error("Verify payment error:", err);
    return res.status(500).json({ status: false, message: "Payment verification failed" });
  }
};

const applyCoupon = async (req, res) => {
  const { code } = req.body;
  const userId   = req.session.user;

  try {
    /* 1️⃣  Find coupon */
    const coupon = await Coupon.findOne({ couponName: code.trim(), isBlocked: false });
    if (!coupon) return res.json({ ok: false, msg: 'Invalid coupon' });

    /* 2️⃣  Date validity */
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
      return res.json({ ok: false, msg: 'Coupon is not active' });
    }

/* 3️⃣  One‑time use per user */
const uid = toObjectId(userId);
const alreadyUsed = coupon.usedUsers.some(u => u.equals(uid));
if (alreadyUsed) {
  return res.json({ ok: false, msg: 'You have already used this coupon' });
}



    /* 4️⃣  Load cart */
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      return res.json({ ok: false, msg: 'Cart is empty' });
    }

    /* 5️⃣  Sub‑total */
    const subtotal = cart.items.reduce(
      (sum, i) => sum + i.quantity * (Number(i.productId.salePrice) || 0),
      0
    );
    if (!subtotal) return res.json({ ok: false, msg: 'Could not calculate total' });

    /* 6️⃣  Min order check */
    if (subtotal < coupon.minimumPrice) {
      return res.json({ ok: false, msg: `Minimum order value ₹${coupon.minimumPrice}` });
    }

    /* 7️⃣  Already applied in session? */
    if (req.session.appliedCoupon === code) {
      return res.json({
        ok: true,
        msg: 'Coupon already applied',
        couponName: code,
        newTotal: subtotal + 50 - req.session.discountAmount,

        discountAmount: req.session.discountAmount
      });
    }

    /* 8️⃣  Store in session */
    req.session.appliedCoupon   = code;
    req.session.discountAmount  = coupon.offerPrice;

    res.json({
      ok: true,
      msg: 'Coupon applied successfully',
      couponName: code,
      newTotal: subtotal + 50 - coupon.offerPrice,

      discountAmount: coupon.offerPrice
    });

  } catch (err) {
    console.error('applyCoupon error:', err);
    res.json({ ok: false, msg: 'Server error' });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart   = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.json({ ok: false, msg: 'Cart is empty' });
    }

    const subtotal = cart.items.reduce(
      (sum, i) => sum + i.quantity * (Number(i.productId.salePrice) || 0),
      0
    );

    // wipe session
    delete req.session.appliedCoupon;
    delete req.session.discountAmount;

    res.json({
      ok: true,
      msg: 'Coupon removed',
      newTotal: subtotal + 50

    });
  } catch (err) {
    console.error('removeCoupon error:', err);
    res.json({ ok: false, msg: 'Server error' });
  }
};



module.exports = {
  getCartTotal,
  checkoutPage,
  placeOrder,
  orderSuccess,
  paymentFailure,
  verifyPayment,
  applyCoupon,
  removeCoupon
};
