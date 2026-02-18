// models/User.js
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: null },

  profile: { type: String, trim: true, default: null },
  
  // 👇 New fields for tokens
  refreshToken: { type: String, default: null },

  createdAt: { type: Date, default: Date.now },
})

// 👇 Method to generate Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, phone: this.phone },
    process.env.ACCESS_TOKEN_SECRET,

    { expiresIn: '2d' }
  )
}

// 👇 Method to generate Refresh Token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id, phone: this.phone },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  )
}

export default mongoose.models.User || mongoose.model('User', userSchema);
  
