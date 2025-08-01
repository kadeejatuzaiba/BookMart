const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/userSchema');

const migrateWallet = async () => {
  await connectDB();

  const users = await User.find({ wallet: { $type: 'number' } });

  for (const user of users) {
    const oldAmount = user.wallet;

    user.wallet = {
      balance: oldAmount,
      transactions: [],
    };

    await user.save();
    console.log(`✅ Updated wallet for ${user.email}`);
  }

  console.log('🎉 Wallet migration complete.');
  mongoose.disconnect();
};

migrateWallet();
