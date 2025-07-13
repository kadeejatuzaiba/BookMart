

/* ───────── dependencies & helpers ───────── */
const Order    = require('../../models/orderSchema');
const Product  = require('../../models/productSchema');
const Address  = require('../../models/addressSchema');
const { creditWallet } = require('../user/walletController');   // ← correct path

const Razorpay = require('razorpay');
const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
const incStock = async (productId, qty) => {
  await Product.findByIdAndUpdate(productId, {
    $inc: { quantity: qty } // 🔁 changed 'stock' to 'quantity'
  });
};


/* refund helper  (price × qty − discounts if any) */
const getItemRefund = (item) => {
  const price     = Number(item.price)     || 0;
  const qty       = Number(item.quantity)  || 1;
  const discount  = Number(item.discount)  || 0;   // % discount per item
  const netPrice  = price * (1 - discount / 100);
  return netPrice * qty;
};

/* ───────── list, detail, invoice ───────── */

const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const q      = req.query.search || '';
    const page   = +req.query.page || 1;
    const limit  = 3;
    const skip   = (page - 1) * limit;

    const filter = { user: userId };
    if (q) filter.orderId = { $regex: q, $options: 'i' };

    const total  = await Order.countDocuments(filter);
    const orders = await Order.find(filter).sort({ createdOn: -1 })
                     .skip(skip).limit(limit).populate('orderedItems.product');

    res.render('orders', {
      orders,
      currentPage: page,
      totalPages:  Math.ceil(total / limit),
      search:      q
    });
  } catch (err) {
    console.error('loadOrders', err);
    res.status(500).send('Internal Server Error');
  }
};

const viewOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const order  = await Order.findOne({ _id: req.params.id, user: userId })
                     .populate('orderedItems.product');
    if (!order) return res.status(404).render('404', { message: 'Order not found' });

    const addressDoc = await Address.findOne({ userId }).lean();
    const selectedAddress = addressDoc?.address.find(
      a => String(a._id) === String(order.address)
    );

    res.render('order-details', {
      order,
      selectedAddress,
      user: req.session.user,
      shippingCharge: 50
    });
  } catch {
    res.status(500).send('Internal Server Error');
  }
};

const getInvoice = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const order  = await Order.findOne({ _id: req.params.id, user: userId })
                     .populate('orderedItems.product');
    if (!order) return res.status(404).render('404', { message: 'Order not found' });

    const addressDoc = await Address.findOne({ userId }).lean();
    const selectedAddress = addressDoc?.address.find(
      a => String(a._id) === String(order.address)
    );

    res.render('invoice', {
      order,
      user: req.session.user,
      selectedAddress,
      shippingCharge: 50
    });
  } catch (err) {
    console.error('getInvoice', err);
    res.status(500).send('Internal Server Error');
  }
};

/* ───────── WHOLE‑ORDER cancel ───────── */

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '', description = '' } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });
    if (order.status === 'Cancelled')
      return res.status(400).json({ ok: false, msg: 'Already cancelled' });

    let refundTotal = 0;

    for (const it of order.orderedItems) {
      if (!['Cancelled', 'returned'].includes(it.status)) {
        await incStock(it.product, it.quantity);
        refundTotal += getItemRefund(it);

        it.status            = 'Cancelled';
        it.cancelReason      = reason;
        it.cancelDescription = description;
      }
    }

    order.status            = 'Cancelled';
    order.cancelReason      = reason;
    order.cancelDescription = description;
    await order.save();

    await creditWallet(
      order.user,
      refundTotal,
      `Refund - cancelled order ${order.orderId || order._id}`,
      order.orderId || order._id
    );

    res.json({ ok: true });

  } catch (err) {
    console.error('cancelOrder', err);
    res.status(500).json({ ok: false, msg: 'Server error' });
  }
};

/* ───────── ITEM‑LEVEL cancel ───────── */

const cancelProduct = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason = '', description = '' } = req.body;

    if (!reason) return res.status(400).json({ ok: false, msg: 'Reason required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, msg: 'Order not found' });

    const item = order.orderedItems.id(itemId);
    if (!item)   return res.status(404).json({ ok: false, msg: 'Item not found' });
    if (item.status === 'Cancelled') return res.json({ ok: true }); // already done

    await incStock(item.product, item.quantity);

    item.status            = 'Cancelled';
    item.cancelReason      = reason;
    item.cancelDescription = description;

    if (order.orderedItems.every(i => i.status === 'Cancelled'))
      order.status = 'Cancelled';

    await order.save();
const refundAmount = getItemRefund(item);
console.log('💰 Refunding to wallet:', refundAmount); // ✅ add this

await creditWallet(
  order.user,
  refundAmount,
  `Refund - cancelled item ${itemId}`,
  order.orderId || order._id
);

    res.json({ ok: true });
  } catch (err) {
    console.error('cancelProduct', err);
    res.status(500).json({ ok: false, msg: 'Server error' });
  }
};


const returnProduct = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason, description } = req.body;
    const imagePaths = (req.files || []).map(f => f.path);

    if (!reason || !description)
      return res.status(400).json({ ok:false, msg:'Reason & description required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok:false, msg:'Order not found' });

    const item = order.orderedItems.id(itemId);
    if (!item)  return res.status(404).json({ ok:false, msg:'Item not found' });
    if (['Return Request','returned'].includes(item.status))
      return res.json({ ok:true });

    item.status = 'Return Request';
    item.returnReason = reason;
    item.returnDescription = description;
    item.returnImages = imagePaths;

    if (order.orderedItems.every(i => ['Return Request','returned'].includes(i.status)))
      order.status = 'Return Request';

    await order.save();
    res.json({ ok:true });
  } catch (err) {
    console.error('returnProduct', err);
    res.status(500).json({ ok:false, msg:'Server error' });
  }
};




const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    console.log('retryPayment req.body:', req.body);

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ status: false, message: 'Order not found' });
    }

    if (order.status === 'Confirmed') {
      return res.status(400).json({ status: false, message: 'Order already paid' });
    }

    console.log('Creating Razorpay order...');
    const razorpayOrder = await rzp.orders.create({
      amount: order.finalAmount * 100,
      currency: 'INR',
      receipt: `retry_rcptid_${orderId}`
    });
    console.log('Razorpay Order Created:', razorpayOrder);

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.json({
      status: true,
      payment: 'razorpay',
      key: process.env.RAZORPAY_KEY_ID,
      amount: order.finalAmount * 100,
      razorpayOrderId: razorpayOrder.id
    });

  } catch (error) {
    console.error('Retry payment error:', error);
    return res.status(500).json({ status: false, message: 'Retry failed' });
  }
};
// POST /return-order/:id
const returnOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, description } = req.body;
    const imagePaths = (req.files || []).map(f => f.path);

    if (!reason || !description)
      return res.status(400).json({ ok: false, msg: 'Reason & description required' });

    const order = await Order.findById(id);
    if (!order || order.status !== 'Delivered')
      return res.status(400).json({ ok: false, msg: 'Invalid return request' });

    /* 1️⃣  flag every item as “Return Request” (unless already returned) */
    for (const it of order.orderedItems) {
      if (!['Return Request', 'returned'].includes(it.status)) {
        it.status           = 'Return Request';
        it.returnReason     = reason;
        it.returnDescription = description;
        it.returnImages      = imagePaths;
      }
    }

    /* 2️⃣  update the order */
    order.status           = 'Return Request';
    order.returnReason     = reason;
    order.returnDescription = description;
    order.returnImages      = imagePaths;

    await order.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('returnOrder', err);
    res.status(500).json({ ok: false, msg: 'Server error' });
  }
};

module.exports = {
  loadOrders,
  viewOrderDetails,
  getInvoice,
  cancelOrder,
  cancelProduct,
  returnOrder,
  returnProduct,
  retryPayment
};
