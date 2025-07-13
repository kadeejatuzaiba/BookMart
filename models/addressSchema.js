const mongoose = require("mongoose");
const {Schema}=mongoose;

const addressSchema = new Schema(
    {
        address :[{
        name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  alternatePhone: { type: String, trim: true },
  locality: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
        }],

        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User Schema
        
    }
);



const Address = mongoose.model("Address", addressSchema);
module.exports = Address;