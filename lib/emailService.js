const nodemailer = require('nodemailer');

// Email configuration from environment variables
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransporter(emailConfig);
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `http://localhost:3000/forgot-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject: 'Password Reset Request - Product Catalog',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
            <h2 style="color: #2c3e50; margin-bottom: 20px;">Password Reset Request</h2>
            <p style="color: #6c757d; font-size: 16px; line-height: 1.5;">
              You requested to reset your password for the Product Catalog system.
            </p>
            <div style="background: #e9ecef; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #495057; font-weight: bold; margin-bottom: 10px;">Reset Link:</p>
              <a href="${resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Your Password
              </a>
            </div>
            <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
              This link will expire in 1 hour for security reasons.
            </p>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p style="color: #856404; margin: 0; font-size: 13px;">
                <strong>Security Note:</strong> If you didn't request this password reset, please ignore this email.
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            <p style="color: #6c757d; font-size: 12px; text-align: center;">
              © 2024 Product Catalog. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId
    };
    
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  sendPasswordResetEmail,
  createTransporter
};
