/* eslint-disable prettier/prettier */
// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpStatus,
  Get,
  Query,
  Delete,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local.guard';
import { JwtAuthGuard } from './guards/jwt.guard';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedRequest } from './types/express';
import { AuthResponse } from './types/auth.types';
import { $Enums } from '@prisma/client';
import { AdminRegisterDto } from '../auth/dto/admin.reg.dto';
import { AdminLoginDto } from '../auth/dto/admin.login.dto';
import { AdminLocalAuthGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService
  ) {}

  // =====================================================
  // BASIC AUTHENTICATION ENDPOINTS
  // =====================================================

  @Post('register')
  @Throttle(5, 60000) // 5 requests per minute
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User registered successfully',
    schema: {
      example: {
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            emailVerified: false,
            role: 'CUSTOMER',
            createdAt: '2025-01-20T10:30:00Z'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
    schema: {
      example: {
        success: false,
        message: 'User with this email already exists',
        statusCode: 409
      }
    }
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @Throttle(10, 60000) // 10 requests per minute
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Login successful',
    schema: {
      example: {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            role: 'CUSTOMER',
            emailVerified: true
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or email not verified',
    schema: {
      example: {
        success: false,
        message: 'Invalid credentials',
        statusCode: 401
      }
    }
  })
  async login(@Body() loginDto: LoginDto, @Request() req) {
    return this.authService.login(req.user);
  }

  // =====================================================
  // ADMIN AUTHENTICATION ENDPOINTS
  // =====================================================

  @Post('admin/register')
  @Throttle(3, 60000) // 3 requests per minute for admin registration
  @ApiOperation({
    summary: 'Register a new admin user',
    description: 'Creates a new admin account with admin secret key validation. Admin accounts are automatically verified and logged in upon creation.'
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Admin registered successfully and logged in',
    schema: {
      example: {
        success: true,
        message: 'Admin account created successfully. You are now logged in.',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'admin@shoppmooré.com',
            fullName: 'John Admin',
            role: 'ADMIN',
            emailVerified: true,
            isActive: true,
            createdAt: '2025-01-20T10:30:00Z'
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid admin secret key',
    schema: {
      example: {
        success: false,
        message: 'Invalid admin secret key. Access denied.',
        statusCode: 401
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Admin already exists',
    schema: {
      example: {
        success: false,
        message: 'Admin with this email already exists',
        statusCode: 409
      }
    }
  })
  async adminRegister(@Body() adminRegisterDto: AdminRegisterDto) {
    return this.authService.adminRegister(adminRegisterDto);
  }

  @Post('admin/login')
  @UseGuards(AdminLocalAuthGuard)
  @Throttle(5, 60000) // 5 requests per minute for admin login
  @ApiOperation({ 
    summary: 'Admin user login',
    description: 'Authenticates admin users with admin secret key validation. Only users with ADMIN role can login through this endpoint.'
  })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin login successful',
    schema: {
      example: {
        success: true,
        message: 'Admin login successful',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'admin@shoppmooré.com',
            fullName: 'John Admin',
            role: 'ADMIN',
            emailVerified: true
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or admin secret key',
    schema: {
      example: {
        success: false,
        message: 'Invalid admin credentials or access denied',
        statusCode: 401
      }
    }
  })
  async adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    return this.authService.adminLogin(adminLoginDto);
  }

  @Get('admin/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get admin profile',
    description: 'Returns the profile information of the currently authenticated admin user'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Admin profile retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Admin profile retrieved successfully',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'admin@shoppmooré.com',
            fullName: 'John Admin',
            role: 'ADMIN',
            emailVerified: true,
            phoneNumber: '+1234567890',
            isActive: true,
            createdAt: '2025-01-20T10:30:00Z',
            lastLoginAt: '2025-01-27T14:30:00Z'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated or not an admin',
    schema: {
      example: {
        success: false,
        message: 'Access denied. Admin privileges required.',
        statusCode: 401
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User is not an admin',
    schema: {
      example: {
        success: false,
        message: 'Access denied. Admin privileges required.',
        statusCode: 403
      }
    }
  })
  async getAdminProfile(@Request() req): Promise<AuthResponse> {
    const user = req.user;
  
    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    // Get complete admin profile
    const adminProfile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        emailVerified: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        updatedAt: true,
      },
    });

    if (!adminProfile) {
      throw new UnauthorizedException('Admin profile not found');
    }

    return {
      success: true,
      message: 'Admin profile retrieved successfully',
      data: {
        user: adminProfile,
        accessToken: '',
        refreshToken: ''
      }
    };
  }



  // =====================================================
  // GOOGLE OAUTH ENDPOINTS
  // =====================================================

  @Get('google')
  @ApiOperation({ 
    summary: 'Initiate Google OAuth login',
    description: 'Redirects user to Google OAuth consent screen. This endpoint cannot be tested in Swagger as it requires browser redirection.'
  })
  @ApiResponse({ 
    status: 302, 
    description: 'Redirects to Google OAuth consent screen',
    headers: {
      Location: {
        description: 'Google OAuth URL',
        schema: {
          type: 'string',
          example: 'https://accounts.google.com/oauth/authorize?client_id=...'
        }
      }
    }
  })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates Google OAuth flow
    // Passport automatically handles the redirect to Google
  }

  @Get('google/redircect')
  @ApiOperation({ 
    summary: 'Handle Google OAuth callback',
    description: 'Processes the callback from Google OAuth and redirects to frontend with authentication result. This is an internal endpoint called by Google.'
  })
  @ApiResponse({ 
    status: 302, 
    description: 'Redirects to frontend with authentication result',
    headers: {
      Location: {
        description: 'Frontend URL with auth result',
        schema: {
          type: 'string',
          example: 'https://your-frontend.com/auth/success'
        }
      },
      'Set-Cookie': {
        description: 'HTTP-only cookies containing tokens',
        schema: {
          type: 'array',
          items: {
            type: 'string',
            example: 'accessToken=eyJhbG...; HttpOnly; Secure; SameSite=Lax'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 302,
    description: 'Authentication failed - redirects to error page',
    headers: {
      Location: {
        description: 'Frontend error URL',
        schema: {
          type: 'string',
          example: 'https://your-frontend.com/auth/error?message=authentication_failed'
        }
      }
    }
  })
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    console.log('Google OAuth callback triggered');
    console.log('User from request:', req.user);
    console.log('Frontend URL:', process.env.FRONTEND_URL);
    
    try {
      const user = req.user;
      
      if (!user) {
        console.error('No user found in request');
        const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=authentication_failed`;
        console.log('Redirecting to error URL:', errorUrl);
        return res.redirect(errorUrl);
      }
      
      console.log('Generating tokens for user:', user.email);
      
      // Generate tokens for the authenticated user
      const tokens = await this.authService.generateTokens(
        {
          sub: user.id,
          email: user.email,
          role: user.role as $Enums.UserRole,
        },
        user.id
      );

      console.log('Tokens generated successfully');

      // Set HTTP-only cookies for security
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      // Redirect to frontend success page
      const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success`;
      console.log('Redirecting to success URL:', successUrl);
      return res.redirect(successUrl);
      
    } catch (error) {
      console.error('Google auth error:', error);
      const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?message=server_error`;
      console.log('Redirecting to error URL due to exception:', errorUrl);
      return res.redirect(errorUrl);
    }
  }

  @Get('google/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check Google OAuth authentication status',
    description: 'Returns current authentication status for the logged-in user'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Authentication status retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'User is authenticated',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            role: 'CUSTOMER',
            avatarUrl: 'https://lh3.googleusercontent.com/...'
          },
          accessToken: '',
          refreshToken: ''
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'User is not authenticated',
    schema: {
      example: {
        success: false,
        message: 'User is not authenticated',
        error: 'Not authenticated'
      }
    }
  })
  async getAuthStatus(@Req() req: AuthenticatedRequest): Promise<AuthResponse> {
    if (req.user) {
      return {
        success: true,
        message: 'User is authenticated',
        data: {
          user: {
            id: req.user.id,
            email: req.user.email,
            fullName: req.user.fullName,
            role: req.user.role,
            avatarUrl: req.user.avatarUrl
          },
          accessToken: '', // Don't expose tokens in status check
          refreshToken: ''
        }
      };
    }

    return {
      success: false,
      message: 'User is not authenticated',
      error: 'Not authenticated'
    };
  }

  @Get('google/failure')
  @ApiOperation({
    summary: 'Google OAuth failure endpoint',
    description: 'Handles Google authentication failures and returns error response'
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Google authentication failed',
    schema: {
      example: {
        success: false,
        message: 'Google authentication failed',
        error: 'Authentication failed'
      }
    }
  })
  async googleFailure(): Promise<AuthResponse> {
    return {
      success: false,
      message: 'Google authentication failed',
      error: 'Authentication failed'
    };
  }

  // =====================================================
  // EMAIL VERIFICATION AND PASSWORD RESET ENDPOINTS  
  // =====================================================

  @Post('verify-email')
  @Throttle(5, 60000)
  @ApiOperation({ summary: 'Verify user email' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email verified successfully and user logged in',
    schema: {
      example: {
        success: true,
        message: 'Email verified successfully. You are now logged in.',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            role: 'CUSTOMER',
            emailVerified: true
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired token',
    schema: {
      example: {
        success: false,
        message: 'Invalid or expired verification token',
        statusCode: 400
      }
    }
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto.token);
  }

  @Get('verify-email')
  @ApiOperation({ 
    summary: 'Verify email via GET request (for email links)',
    description: 'Alternative email verification endpoint for direct email links'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Email verified successfully and user logged in',
    schema: {
      example: {
        success: true,
        message: 'Email verified successfully. You are now logged in.',
        data: {
          user: {
            id: '507f1f77bcf86cd799439011',
            email: 'john.doe@example.com',
            fullName: 'John Doe',
            role: 'CUSTOMER',
            emailVerified: true
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  async verifyEmailGet(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @Throttle(3, 60000) // 3 requests per minute
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Verification email sent if email exists and not verified',
    schema: {
      example: {
        success: true,
        message: 'Verification email has been sent.'
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email already verified',
    schema: {
      example: {
        success: false,
        message: 'Email is already verified',
        statusCode: 400
      }
    }
  })
  async resendVerificationEmail(@Body() resendVerificationDto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(resendVerificationDto.email);
  }

  @Post('forgot-password')
  @Throttle(3, 60000) // 3 requests per minute
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset email sent',
    schema: {
      example: {
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      }
    }
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Throttle(5, 60000)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successful',
    schema: {
      example: {
        success: true,
        message: 'Password reset successful. Please login with your new password.'
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid or expired reset token',
    schema: {
      example: {
        success: false,
        message: 'Invalid or expired reset token',
        statusCode: 400
      }
    }
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  // =====================================================
  // TOKEN MANAGEMENT ENDPOINTS
  // =====================================================

  @Post('refresh-token')
  @Throttle(10, 60000)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token refreshed successfully',
    schema: {
      example: {
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid refresh token',
    schema: {
      example: {
        success: false,
        message: 'Invalid refresh token',
        statusCode: 401
      }
    }
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user from current device' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out successfully',
    schema: {
      example: {
        success: true,
        message: 'Logged out successfully'
      }
    }
  })
  async logout(@Request() req, @Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(req.user.id, refreshTokenDto.refreshToken);
  }

  @Delete('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user from all devices' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logged out from all devices successfully',
    schema: {
      example: {
        success: true,
        message: 'Logged out from all devices successfully'
      }
    }
  })
  async logoutFromAllDevices(@Request() req) {
    return this.authService.logoutFromAllDevices(req.user.id);
  }

  @Delete('cleanup-tokens')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(1, 300000) // 1 request per 5 minutes
  @ApiOperation({ 
    summary: 'Cleanup expired tokens (Admin only)',
    description: 'This endpoint is typically used by admin or scheduled jobs to clean up expired refresh tokens'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Expired tokens cleaned up successfully',
    schema: {
      example: {
        success: true,
        message: 'Cleaned up 15 expired refresh tokens',
        count: 15
      }
    }
  })
  async cleanupExpiredTokens() {
    const count = await this.authService.cleanupExpiredTokens();
    return {
      success: true,
      message: `Cleaned up ${count} expired refresh tokens`,
      count,
    };
  }
}