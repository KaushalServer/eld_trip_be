import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const signToken = (user) => {
    return jwt.sign({
        sub: user._id.toString(), 
        username: user.username }, 
        process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '8h'
        }
    );
}

export const setAuthCookie = (res, token) => {
    res.cookie('eld_auth', token, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  });
}

export const authRequired = async (req,res,next) => {
      try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || req.cookies?.eld_auth;
    if (!token) return res.status(401).json({ detail: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('_id username');
    if (!user) return res.status(401).json({ detail: 'User no longer exists.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid or expired authentication token.' });
  }
}