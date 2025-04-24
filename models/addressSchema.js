const mongoose = require("mongoose");
const {Schema}=mongoose;

const addressSchema = new Schema(
    {
        address :[{
        houseNumber: { type: String, required: true, trim: true },
        street: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        pincode: { type: String, required: true, trim: true }
        }],

        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User Schema
        
    }
);

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;