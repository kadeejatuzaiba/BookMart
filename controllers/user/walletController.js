const User = require('../../models/userSchema');


// const loadWalletPage = async (req, res) => {
//   try {
//     const userId = req.session.userId || req.session.user;
//     const userData = await User.findById(userId).lean();

//     if (!userData) return res.redirect('/login');

//     const page = parseInt(req.query.page) || 1;
//     const limit = 5; // number of transactions per page
//     const startIndex = (page - 1) * limit;
// const allTransactions = userData.wallet?.transactions || [];
// const reversedTransactions = [...allTransactions].reverse();  // Get newest first
// const paginatedTransactions = reversedTransactions.slice(startIndex, startIndex + limit);


//     const totalPages = Math.ceil(allTransactions.length / limit);

//     res.render('wallet', {
//       user: userData,
//       transactions: paginatedTransactions,
//       currentPage: page,
//       totalPages
//     });

//   } catch (error) {
//     console.error("Error loading wallet:", error);
//     res.redirect('/profile');
//   }
// };




const loadWalletPage = async (req, res) => {
  try {
    const userId = req.session.userId || req.session.user;
    const userData = await User.findById(userId).lean();

    if (!userData) return res.redirect('/login');

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const startIndex = (page - 1) * limit;

    // Clone + reverse before slicing
    const allTransactions = userData.wallet?.transactions || [];
    const sortedTransactions = [...allTransactions].reverse(); // latest first

    const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(sortedTransactions.length / limit);

    res.render('wallet', {
      user: userData,
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.error("Error loading wallet:", error);
    res.redirect('/profile');
  }
};



const creditWallet = async (userId, amount, description, orderId = null) => {
  if (amount <= 0) return;                             // safety check
  const user = await User.findById(userId);
  if (!user) return;

  // initialise wallet object if it doesn’t exist yet
  if (!user.wallet || typeof user.wallet.balance !== 'number')
    user.wallet = { balance: 0, transactions: [] };

  user.wallet.balance += amount;
  user.wallet.transactions.push({
    type: 'credit',
    amount,
    description,
    orderId,
    date: new Date()
  });

  await user.save({ validateBeforeSave: false });
};


const debitWallet = async (userId, amount, description, orderId = null) => {
  try {
    const user = await User.findById(userId);

    if (user.wallet.balance < amount) {
      throw new Error("Insufficient wallet balance");
    }

    // Subtract balance
    user.wallet.balance -= amount;

    // Add transaction entry
    user.wallet.transactions.push({
      type: 'debit',
      amount,
      description,
      orderId
    });

    await user.save();
  } catch (error) {
    console.error("Error debiting wallet:", error);
    throw error;
  }
};



module.exports = {
  loadWalletPage,
  creditWallet,
  debitWallet
};
