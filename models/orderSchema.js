const mongoose=require('mongoose')
const {Schema}=mongoose
const {v4:uuidv4}=require('uuid')


const orderSchema = new Schema({
    orderId: {
      type: String,
      default: ()=>uuidv4,
      unique: true
    },
    orderedItems: [
        {
          product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
          },
          quantity: {
            type: Number,
            required: true,
            min: 1
          },
          price: {
            type: Number,
            required: true
          }
}],
totalPrice:{
    type :Number,
    required:true
},
discount:{
    type :Number,
    default:0
},
finalAmount:{
    type:Number,
    required:true
},
address:{
    type:Schema.Types.ObjectId,
    ref:'User',
    required:true
},
inVoiceDate:{
    type:Date
},
status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled','Return Request','returned'],
    default: 'Pending'
  },
  createdOn: {
    type: Date,
    default: Date.now,
    required:true
  },
  couponStatus: {
    type: Boolean,
    default: false
  },
  });

  const Order=mongoose.model('Order',orderSchema)
  module.exports=Order;