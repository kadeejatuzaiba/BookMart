const User=require('../../models/userSchema')
const nodemailer=require('nodemailer')
const bcrypt=require('bcrypt')
const env=require('dotenv').config();
const session=require('express-session');
const { text } = require('express');
const Address = require('../../models/addressSchema');
const path = require('path');
const Order = require('../../models/orderSchema');

function generateOtp(){
    const digits='1234567890'
    let otp=''
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp;
}

const sendVerificationEmail=async(email,otp)=>{
    try {
        const transporter=nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })

        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:'Your OTP for password reset',
            text:`you OTP is ${otp}`,
             html: `<b><h4>Your OTP: ${otp}</h4></b>` 
        }

        const info=await transporter.sendMail(mailOptions);
        console.log('Email sent:',info.messageId);
        return true;

    } catch (error) {
        console.error('Error sending email',error)
        return false;
    }
}

const securePassword=async(password)=>{
    try {
        const passwordHash=await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
        
    }
}

const getForgotPassPage=async(req,res)=>{
    try {
        res.render('forgot-password')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const forgotEmailValid=async(req,res)=>{
    try {
        const {email}=req.body 
        const findUser=await User.findOne({email:email})
        if(findUser){
            const otp=generateOtp()
            const emailSent=await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp=otp;
                req.session.email=email,
                res.render('forgotPass-otp')
                console.log('OTP:',otp);
                
            }else{
                res.json({success:false,message:"Failed to send OTP.Please try again"})
            }
        }else{
            res.render('forgot-password',{
                message:'User with this email does not exists'
            })
        }
    } catch (error) {
        res.redirect('/pageNotFound')
        
    }
}




const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp === req.session.userOtp) {
            req.session.resetEmail = req.session.email; // Save for password reset
            res.json({ success: true, redirectUrl: '/reset-password' });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'An error occurred, please try again' });
    }
};



const getResetPassPage = async (req, res) => {
    try {
        res.render('reset-password'); 
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};



const resendOtp = async (req, res) => {
  try {
    const otp = generateOtp();
    req.session.userOtp = otp;
    const email = req.session.email; // ✅ not userData.email

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email not found in session. Please restart password reset process.' });
    }

    console.log('Resending OTP to email:', email);
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log('Resent OTP:', otp);
      res.status(200).json({ success: true, message: 'Resend OTP successful' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send email. Please try again.' });
    }
  } catch (error) {
    console.error('Error in resendOtp:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// const postNewPassword=async(req,res)=>{
//     try {
//         const {newPass1,newPass2}=req.body;
        
//         const email=req.session.email;
//         if(newPass1===newPass2){
//             const passwordHash=await securePassword(newPass1)
//             await User.updateOne(
//                 {email:email},
//                 {$set:{password:passwordHash}}
//             )
//             res.redirect('/login')
//         }else{
//             res.render('reset-password',{message:'passwords dod not match'})
//         }
//     } catch (error) {
//         res.redirect('/pageNotFound')
//     }
// }

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body;

        // Case 1: User is logged in (change password from profile)
        if (req.session.user) {
           const userId = req.session.userId || req.session.user._id;


            if (newPass1 !== newPass2) {
                return res.render('reset-password', { message: 'Passwords do not match' });
            }


            console.log("Session userId:", req.session.userId);


            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { _id: userId },
                { $set: { password: passwordHash } }
            );

            return res.redirect('/userProfile'); // stop execution here
        }

        // Case 2: Forgot password (email in session)
        const email = req.session.email;
        if (newPass1 === newPass2) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            );

            return res.redirect('/login');
        } else {
            return res.render('reset-password', { message: 'Passwords do not match' });
        }
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};


const userProfile=async(req,res)=>{
    try {
        const userId=req.session.user
        const userData=await User.findById(userId)
        const addressData=await Address.findOne({userId:userId});
       res.render('profile', {
  user: {
    ...userData.toObject(),
    addresses: addressData ? addressData.address : []
  }
});

    } catch (error) {
        console.error('Error for retrieve profile data',error)
        res.redirect('/pageNotFound')
    }
}


const getEditProfile=async(req,res)=>{
    try {
        const userId=req.session.user
        const userData=await User.findById(userId)
        res.render('edit-profile',{
            user:userData
        })
    } catch (error) {
        console.error('Error for retrieve edit profile data',error)
        res.redirect('/pageNotFound')
    }
}



const profileUpload = async (req, res) => {
  try {
    const userId = req.session.user;
    const filePath = '/images/' + req.file.filename;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { image: filePath } },   // ✅ Use $set to avoid overwrite
      { new: true }                    // ✅ Return updated document
    );

    console.log("✅ Image path saved to DB:", updatedUser.image); // Check this

    res.redirect('/editProfile');
  } catch (error) {
    console.log(error);
    res.redirect('/pageNotFound');
  }
};




const changeEmail=async(req,res)=>{
    try {
        res.render('change-email')
    } catch (error) {
        res.redirect('/pageNotFound')
        
    }
}

const changeEmailValid = async (req, res) => {
  try {
    const { email } = req.body;

    // Get current logged-in user's email from session
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect('/login'); // Or redirect to error page
    }

    // Only proceed if entered email matches logged-in user's email
    if (email !== currentUser.email) {
      return res.render('change-email', {
        message: 'Please enter your current email address.'
      });
    }

    // Send OTP only to current user email
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (emailSent) {
              console.log('✅ OTP for email verification:', otp);
      req.session.userOtp = otp;
      req.session.userData = req.body;
      req.session.email = email;


      return res.render('change-email-otp');
    } else {
      return res.render('change-email', {
        message: 'Failed to send OTP. Please try again.'
      });
    }

  } catch (error) {
    console.log(error);
    return res.redirect('/pageNotFound');
  }
};



const verifyEmailOtp = async (req, res) => {
  try {
    const enteredOtp = String(req.body.otp).trim();
    const sessionOtp = String(req.session.userOtp).trim();

    console.log('Entered OTP:', enteredOtp);


    if (enteredOtp === sessionOtp) {
      return res.json({
        success: true,
        redirectUrl: '/updateEmail' 
      });
    } else {
      return res.json({
        success: false,
        message: 'OTP not matching'
      });
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};




const getNewEmailPage=async(req,res)=>{
    try {
        if (!req.session.userOtp) {
    return res.redirect('/changeEmail');   // or wherever the flow starts
  }

  return res.render('new-email', {
    userData:       req.session.userData || {},
    successMessage: 'OTP verified successfully!'
  });
    } catch (error) {
     res.redirect('/pageNotFound')   
    }
}


const updateEmail = async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    const userId = req.body.user || req.session.user?._id;

    if (!userId) {
      throw new Error('User ID not found');
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email: newEmail },
      { new: true }
    );

    // Update session email
    if (req.session.user) {
      req.session.user.email = updatedUser.email;
    }

    res.redirect('/userProfile');
  } catch (error) {
    console.error('Error updating email:', error);
    res.redirect('/pageNotFound');
  }
};

// const changePassword=async(req,res)=>{
//     try {
//         res.render('reset-password')
//     } catch (error) {
//         res.redirect('/pageNotFound')
//     }
// }


// const changePasswordValid = async (req, res) => {
//   try {

//     const email         = req.session.user.email;   
//     const userExists    = await User.findOne({ email });

//     if (!userExists) {
//       return res.render('change-password', {
//         message: 'User not found. Please login again.'
//       });
//     }

//     const otp        = generateOtp();
//     const emailSent  = await sendVerificationEmail(email, otp);

//     if (!emailSent) {
//       return res.render('change-password', {
//         message: 'Unable to send OTP. Please try again.'
//       });
//     }
//     req.session.userOtp = otp;
//     req.session.email   = email;     
//     res.render('change-password-otp');
//     console.log('OTP for password change:', otp);

//   } catch (err) {
//     console.error('changePasswordValid error:', err);
//     res.redirect('/pageNotFound');
//   }
// };


// const verifyChangePassOtp = async (req, res) => {
//   try {
//     const enteredOtp = String(req.body.otp).trim();
//     const sessionOtp = String(req.session.userOtp).trim();

//     console.log("Entered OTP:", enteredOtp);
//     console.log("Session OTP:", sessionOtp);

//     if (enteredOtp === sessionOtp) {
//       res.json({ success: true, redirectUrl: '/reset-password' });
//     } else {
//       res.json({ success: false, message: 'OTP not matching' });
//     }
//   } catch (error) {
//     console.log(error);
//     res.status(500).json({ success: false, message: 'An error occurred, please try again later' });
//   }
// };


const getResetPasswordPage = async (req, res) => {
  try {
   
    res.render('reset-password'); 
  } catch (error) {
    res.redirect('/pageNotFound');
  }
};

const getChangeNamePage = (req, res) => {
  try {
    const userName = req.session.user.name;
    res.render('change-name', { currentName: userName });
  } catch (err) {
    res.redirect('/pageNotFound');
  }
};


const updateName = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const newName = req.body.newName.trim();

    if (!newName || newName.length < 3) {
      return res.render('change-name', {
        currentName: req.session.user.name,
        message: 'Name must be at least 3 characters long'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, {
      name: newName
    }, { new: true });

    // Update session
    req.session.user.name = updatedUser.name;

    res.redirect('/userProfile');
  } catch (err) {
    console.error('Name change failed:', err);
    res.redirect('/pageNotFound');
  }
};



const getAddressPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const addressData = await Address.findOne({ userId });

    const addresses = addressData ? addressData.address : [];

    res.render('address', {
      user: {
        ...userData.toObject(),
        addresses
      }
    });
  } catch (err) {
    console.error('Error loading address page:', err);
    res.redirect('/pageNotFound');
  }
};



const postAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { name, locality, city, state, pincode, mobile, alternatePhone } = req.body;

    const existing = await Address.findOne({ userId });

    const newAddressObj = {
      name,
      locality,
      city,
      state,
      pincode,
      mobile,
      alternatePhone
    };

    if (!existing) {
      const addressDoc = new Address({
        userId,
        address: [newAddressObj]
      });
      await addressDoc.save();
    } else {
      existing.address.push(newAddressObj);
      await existing.save();
    }

    return res.redirect('/address'); 
  } catch (err) {
    console.error("Error in postAddAddress:", err);
    return res.redirect('/pageNotFound');
  }
};



const updateAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const {
      addressId,
      name,
      locality,
      city,
      state,
      pincode,
      mobile,
      alternatePhone
    } = req.body;


    const updated = await Address.updateOne(
      { userId, "address._id": addressId },
      {
        $set: {
          "address.$.name": name,
          "address.$.locality": locality,
          "address.$.city": city,
          "address.$.state": state,
          "address.$.pincode": pincode,
          "address.$.mobile": mobile,
          "address.$.alternatePhone": alternatePhone
        }
      }
    );

    if (updated.modifiedCount === 0) {
      console.log("⚠️ No address was updated. Possibly wrong ID or user.");
    }

    return res.redirect('/address');
  } catch (err) {
    console.error("❌ Error in updateAddress:", err);
    return res.redirect('/pageNotFound');
  }
};

const deleteAddress=async(req,res)=>{
try {
    const userId=req.session.user
    const addressId=req.params.id

    await Address.updateOne({userId},{$pull:{address:{_id:addressId}}})

    res.redirect('/address')
} catch (error) {
    console.log("Error in deleting address",error)
    re.redirect('/pageNotFound')
}
}

const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user._id;
    console.log("Current Logged In User ID:", userId);

    const orders = await Order.find({ user:userId })  // address field stores the user reference
      .populate('orderedItems.product');
console.log("Fetched Orders:", orders);

    res.render('orders', { orders });
  } catch (err) {
    console.error('Error loading orders:', err);
    res.status(500).send('Internal Server Error');
  }
};

module.exports={
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    getEditProfile,
    profileUpload,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    getNewEmailPage,
    // changePassword,
    // changePasswordValid,
    // verifyChangePassOtp,
    getResetPasswordPage,
    getChangeNamePage,
    updateName,
    getAddressPage,
    postAddAddress,
    updateAddress,
    deleteAddress,
}