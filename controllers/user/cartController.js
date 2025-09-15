const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');

// in cartController
const checkBlockedCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId, 'items.status': 'active' })
      .populate("items.productId");

    let blockedProducts = [];

    if (cart && cart.items.length > 0) {
      blockedProducts = cart.items
        .filter(i => i.productId && i.productId.isBlocked)
        .map(i => i.productId._id.toString()); // send product IDs
    }

    res.json({ blockedProducts });
  } catch (err) {
    console.error("Error checking blocked items:", err);
    res.status(500).json({ blockedProducts: [] });
  }
};







const loadCartPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId, 'items.status': 'active' }).populate({
      path: 'items.productId',
      model: Product,
      populate: { path: 'category', model: 'Category' }
    });

    let total = 0;
    let items = cart ? cart.items : [];

    let validItems = [];
    let hasStockIssue = false;

    if (items.length > 0) {
      for (const item of items) {
        const product = item.productId;

        if (!product) continue;

        // If product stock is less than item quantity, mark warning
        if (product.quantity < item.quantity) {
          item.stockWarning = `Only ${product.quantity} left in stock`;
          hasStockIssue = true;
        } else {
          total += item.totalPrice;
        }

        validItems.push(item); // ✅ Always add the item to show in cart
      }
    }

    res.render('cart', {
      user: req.session.user,
      items: validItems,
      total,
      hasStockIssue
    });
  } catch (err) {
    console.error('Error loading cart page:', err);
    res.redirect('/pageNotFound');
  }
};



// const addToCart = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const { productId, quantity } = req.body;

//     let qty = parseInt(quantity);
// if (isNaN(qty)) qty = 1;  // fallback
// if (qty < 1 || qty > 5) {
//   return res.status(400).json({ status: false, message: 'Invalid quantity selected' });
// }


//     const product = await Product.findById(productId).populate('category');

//         if (!userId) {
//       return res.status(200).json({
//         status: false,
//         message: 'You must be logged in to add items to cart.',
//       });
//     }

//     // Validate product and category
//     if (!product || product.isBlocked || !product.isListed || !product.category || product.category.isBlocked) {
//       return res.status(400).json({ status: false, message: 'Product is unavailable' });
//     }

//     if (product.quantity === 0) {
//       return res.status(400).json({ status: false, message: 'Product is out of stock' });
//     }

//     // Get or create user's cart
//     let cart = await Cart.findOne({ userId });

//     if (!cart) {
//       cart = new Cart({ userId, items: [] });
//     }

//     const existingItem = cart.items.find(item => item.productId.toString() === productId);

//     if (existingItem) {
//       // Calculate new total quantity
//       const newQuantity = existingItem.quantity + qty;

//       if (newQuantity > product.quantity || newQuantity > 5) {
//         return res.status(400).json({ status: false, message: 'Not enough stock to add this quantity' });
//       }

//       existingItem.quantity = newQuantity;
//       existingItem.totalPrice = newQuantity * product.salePrice;
//     } else {
//       // New item
//       if (qty > product.quantity || qty > 5) {
//         return res.status(400).json({ status: false, message: 'Not enough stock' });
//       }

//       cart.items.push({
//         productId,
//         quantity: qty,
//         price: product.salePrice,
//         totalPrice: qty * product.salePrice,
//         status: 'active'
//       });
//     }

//     await cart.save();

//     // Remove from wishlist if present
//     await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });

//     return res.status(200).json({
//       status: true,
//       message: 'Product added to cart',
//       cartCount: cart.items.length 
//     });
//   } catch (error) {
//     console.error('Error adding to cart:', error);
//     return res.status(500).json({ status: false, message: 'Server error' });
//   }
// };


const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    let qty = parseInt(quantity);
    if (isNaN(qty)) qty = 1;
    if (qty < 1 || qty > 5) {
      return res.status(400).json({ status: false, message: 'Invalid quantity selected' });
    }

    if (!userId) {
      return res.status(401).json({
        status: false,
        message: 'You must be logged in to add items to cart.',
      });
    }

    const product = await Product.findById(productId).populate('category');
    if (!product || product.isBlocked || !product.isListed || !product.category || product.category.isBlocked) {
      return res.status(400).json({ status: false, message: 'Product is unavailable' });
    }
if (product.quantity === 0) {
  return res.status(200).json({ status: false, message: 'Product is out of stock' });
}


    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    if (existingItem) {
      const newQuantity = existingItem.quantity + qty;
      if (newQuantity > product.quantity || newQuantity > 5) {
        return res.status(400).json({ status: false, message: 'Not enough stock to add this quantity' });
      }
      existingItem.quantity = newQuantity;
      existingItem.totalPrice = newQuantity * product.salePrice;
    } else {
      if (qty > product.quantity || qty > 5) {
        return res.status(400).json({ status: false, message: 'Not enough stock' });
      }
      cart.items.push({
        productId,
        quantity: qty,
        price: product.salePrice,
        totalPrice: qty * product.salePrice,
        status: 'active'
      });
    }

    await cart.save();

    // remove from wishlist
    await User.updateOne({ _id: userId }, { $pull: { wishlist: productId } });

    // calculate total quantity for badge
    const totalItems = cart.items.reduce((acc, item) => acc + item.quantity, 0);

    const updatedUser = await User.findById(userId);


    return res.status(200).json({
      status: true,
      message: 'Product added to cart',
      cartCount: totalItems,
      wishlistCount: updatedUser.wishlist.length

    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
};


// Remove Product
const removeProduct = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.query.productId;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.redirect('/cart');

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    await cart.save();

    return res.redirect('/cart');
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, message: 'Server error' });
  }
};

// const updateQuantity = async (req, res) => {
//   try {
//     const userId = req.session.user;
//     const { itemId, action } = req.body;

//     const cart = await Cart.findOne({ userId }).populate('items.productId');
//     const item = cart.items.id(itemId);

//     if (!item) return res.json({ success: false, message: 'Item not found' });

//     const product = item.productId;

//     if (!product || product.quantity === 0) {
//       // Remove item if completely out of stock
//       item.remove();
//     } else if (action === 'increase') {
//       if (item.quantity < product.quantity && item.quantity < 5) {
//         item.quantity += 1;
//       } else {
//         // Set to max allowed
//         const maxAllowed = Math.min(product.quantity, 5);
//         item.quantity = maxAllowed;
//       }
//     } else if (action === 'decrease') {
//       if (item.quantity > 1) {
//         item.quantity -= 1;
//       }
//     }

//     item.totalPrice = item.quantity * product.salePrice;
//     await cart.save();

//     res.json({ success: true, newQuantity: item.quantity, newTotalPrice: item.totalPrice ,cartTotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0)
// });
//   } catch (error) {
//     console.error('Error in updateQuantity:', error);
//     res.status(500).json({ success: false, message: 'Server Error' });
//   }
// };

const updateQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId, action } = req.body;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const item = cart.items.id(itemId);

    if (!item) return res.json({ success: false, message: 'Item not found' });

    const product = item.productId;
    let warning = null;  // ⚡ collect warning message

    if (!product || product.quantity === 0) {
      // Remove item if completely out of stock
      item.remove();
      warning = "This product is out of stock.";
    }else if (action === 'increase') {
  if (item.quantity < product.quantity && item.quantity < 5) {
    item.quantity += 1;
  } else {
    const maxAllowed = Math.min(product.quantity, 5);
    item.quantity = maxAllowed;

    if (product.quantity < 5) {
      warning = `Only ${product.quantity} items available in stock.`;  // ⚡ will trigger here
    } else {
      warning = "You can buy a maximum of 5 units.";
    }
  }
}
 else if (action === 'decrease') {
      if (item.quantity > 1) {
        item.quantity -= 1;
      }
    }

    item.totalPrice = item.quantity * product.salePrice;
    await cart.save();

    // ✅ Recalculate cart total the same way as loadCartPage
    let cartTotal = 0;
    for (const i of cart.items) {
      if (i.productId && i.productId.quantity >= i.quantity) {
        cartTotal += i.totalPrice;
      }
    }

    res.json({
      success: true,
      newQuantity: item.quantity,
      newTotalPrice: item.totalPrice,
      cartTotal,
      warning   // ⚡ include warning if any
    });
  } catch (error) {
    console.error('Error in updateQuantity:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


module.exports = {
  loadCartPage,
  addToCart,
  removeProduct,
  updateQuantity,
  checkBlockedCart
};
