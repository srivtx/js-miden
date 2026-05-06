import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, type IUser } from '../models/user.js';
import { Organization } from '../models/organization.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_EXPIRES_IN = '7d';

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }) {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const org = await Organization.create({
      name: data.organizationName,
      slug: data.organizationName.toLowerCase().replace(/\s+/g, '-'),
    });

    const hashedPassword = await bcrypt.hash(data.password, 12);
    const user = await User.create({
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      organizationId: org._id.toString(),
      role: 'owner',
    });

    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  async login(email: string, password: string) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  async getOrganizationUsers(organizationId: string) {
    return User.find({ organizationId }).select('-password');
  }

  async updateUserRole(userId: string, role: 'admin' | 'member', requestingUser: IUser) {
    if (requestingUser.role !== 'owner' && requestingUser.role !== 'admin') {
      throw new Error('Insufficient permissions');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.organizationId !== requestingUser.organizationId) {
      throw new Error('User not in organization');
    }

    if (user.role === 'owner') {
      throw new Error('Cannot modify owner role');
    }

    user.role = role;
    await user.save();
    return this.sanitizeUser(user);
  }

  generateToken(user: IUser): string {
    return jwt.sign(
      {
        userId: user._id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  verifyToken(token: string): jwt.JwtPayload {
    return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
  }

  sanitizeUser(user: IUser) {
    const obj = user.toObject ? user.toObject() : user;
    const { password, ...rest } = obj as any;
    return rest;
  }
}

export const authService = new AuthService();
