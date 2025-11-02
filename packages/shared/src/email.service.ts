import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService {
  private resend: Resend;
  private defaultFrom: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required');
    }
    
    this.resend = new Resend(apiKey);
    this.defaultFrom = this.configService.get<string>('EMAIL_FROM', 'AI Visibility Platform <noreply@ai-visibility.com>');
  }

  /**
   * Send email using Resend
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.resend.emails.send({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        attachments: options.attachments,
      });

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, workspaceName: string): Promise<void> {
    const template = this.getWelcomeTemplate();
    
    await this.sendEmail({
      to: email,
      subject: template.subject.replace('{{WORKSPACE}}', workspaceName),
      html: template.html.replace('{{WORKSPACE}}', workspaceName),
      text: template.text.replace('{{WORKSPACE}}', workspaceName),
    });
  }

  /**
   * Send budget alert email
   */
  async sendBudgetAlertEmail(
    email: string,
    workspaceName: string,
    currentCost: number,
    budgetLimit: number,
    threshold: number
  ): Promise<void> {
    const template = this.getBudgetAlertTemplate();
    
    const replacements = {
      '{{WORKSPACE}}': workspaceName,
      '{{CURRENT_COST}}': currentCost.toFixed(2),
      '{{BUDGET_LIMIT}}': budgetLimit.toFixed(2),
      '{{THRESHOLD}}': threshold.toString(),
      '{{REMAINING}}': (budgetLimit - currentCost).toFixed(2),
    };

    let html = template.html;
    let text = template.text;
    let subject = template.subject;

    Object.entries(replacements).forEach(([key, value]) => {
      html = html.replace(key, value);
      text = text.replace(key, value);
      subject = subject.replace(key, value);
    });

    await this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send report email with PDF attachment
   */
  async sendReportEmail(
    email: string,
    workspaceName: string,
    reportType: string,
    pdfBuffer: Buffer
  ): Promise<void> {
    const template = this.getReportTemplate();
    
    await this.sendEmail({
      to: email,
      subject: template.subject
        .replace('{{WORKSPACE}}', workspaceName)
        .replace('{{REPORT_TYPE}}', reportType),
      html: template.html
        .replace('{{WORKSPACE}}', workspaceName)
        .replace('{{REPORT_TYPE}}', reportType),
      text: template.text
        .replace('{{WORKSPACE}}', workspaceName)
        .replace('{{REPORT_TYPE}}', reportType),
      attachments: [
        {
          filename: `${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Send hallucination alert email
   */
  async sendHallucinationAlertEmail(
    email: string,
    workspaceName: string,
    hallucinationCount: number,
    criticalCount: number
  ): Promise<void> {
    const template = this.getHallucinationAlertTemplate();
    
    await this.sendEmail({
      to: email,
      subject: template.subject
        .replace('{{WORKSPACE}}', workspaceName)
        .replace('{{COUNT}}', hallucinationCount.toString()),
      html: template.html
        .replace('{{WORKSPACE}}', workspaceName)
        .replace('{{COUNT}}', hallucinationCount.toString())
        .replace('{{CRITICAL}}', criticalCount.toString()),
      text: template.text
        .replace('{{WORKSPACE}}', workspaceName)
        .replace('{{COUNT}}', hallucinationCount.toString())
        .replace('{{CRITICAL}}', criticalCount.toString()),
    });
  }

  /**
   * Get email templates
   */
  private getWelcomeTemplate(): EmailTemplate {
    return {
      name: 'welcome',
      subject: 'Welcome to {{WORKSPACE}} - AI Visibility Platform',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3B82F6;">Welcome to {{WORKSPACE}}!</h1>
          <p>Your AI Visibility Platform workspace is ready to help you optimize your brand's presence across AI search engines.</p>
          
          <h2>What's Next?</h2>
          <ul>
            <li>Set up your first AI engine scan</li>
            <li>Configure your brand keywords</li>
            <li>Enable GEO Copilot for automated optimization</li>
          </ul>
          
          <p>Need help getting started? Check out our <a href="https://docs.ai-visibility.com">documentation</a>.</p>
          
          <p>Best regards,<br>The AI Visibility Team</p>
        </div>
      `,
      text: `
        Welcome to {{WORKSPACE}}!
        
        Your AI Visibility Platform workspace is ready to help you optimize your brand's presence across AI search engines.
        
        What's Next?
        - Set up your first AI engine scan
        - Configure your brand keywords
        - Enable GEO Copilot for automated optimization
        
        Need help getting started? Check out our documentation: https://docs.ai-visibility.com
        
        Best regards,
        The AI Visibility Team
      `,
    };
  }

  private getBudgetAlertTemplate(): EmailTemplate {
    return {
      name: 'budget-alert',
      subject: 'Budget Alert: {{WORKSPACE}} has reached {{THRESHOLD}}% of monthly budget',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #EF4444;">Budget Alert</h1>
          <p>Your workspace <strong>{{WORKSPACE}}</strong> has reached {{THRESHOLD}}% of its monthly budget.</p>
          
          <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #DC2626; margin-top: 0;">Current Usage</h3>
            <p><strong>Current Cost:</strong> ${{CURRENT_COST}}</p>
            <p><strong>Budget Limit:</strong> ${{BUDGET_LIMIT}}</p>
            <p><strong>Remaining:</strong> ${{REMAINING}}</p>
          </div>
          
          <p>To avoid service interruption, consider:</p>
          <ul>
            <li>Increasing your monthly budget</li>
            <li>Reducing scan frequency</li>
            <li>Optimizing your prompts for efficiency</li>
          </ul>
          
          <p><a href="https://app.ai-visibility.com/billing" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Update Budget Settings</a></p>
        </div>
      `,
      text: `
        Budget Alert
        
        Your workspace {{WORKSPACE}} has reached {{THRESHOLD}}% of its monthly budget.
        
        Current Usage:
        - Current Cost: ${{CURRENT_COST}}
        - Budget Limit: ${{BUDGET_LIMIT}}
        - Remaining: ${{REMAINING}}
        
        To avoid service interruption, consider:
        - Increasing your monthly budget
        - Reducing scan frequency
        - Optimizing your prompts for efficiency
        
        Update Budget Settings: https://app.ai-visibility.com/billing
      `,
    };
  }

  private getReportTemplate(): EmailTemplate {
    return {
      name: 'report',
      subject: '{{REPORT_TYPE}} Report for {{WORKSPACE}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3B82F6;">{{REPORT_TYPE}} Report</h1>
          <p>Your {{REPORT_TYPE}} report for <strong>{{WORKSPACE}}</strong> is ready!</p>
          
          <p>The report is attached to this email as a PDF file.</p>
          
          <h2>Key Highlights</h2>
          <ul>
            <li>Visibility score trends</li>
            <li>Top-performing keywords</li>
            <li>Citation opportunities</li>
            <li>Recommended actions</li>
          </ul>
          
          <p>Questions about your report? Reply to this email or contact our support team.</p>
        </div>
      `,
      text: `
        {{REPORT_TYPE}} Report
        
        Your {{REPORT_TYPE}} report for {{WORKSPACE}} is ready!
        
        The report is attached to this email as a PDF file.
        
        Key Highlights:
        - Visibility score trends
        - Top-performing keywords
        - Citation opportunities
        - Recommended actions
        
        Questions about your report? Reply to this email or contact our support team.
      `,
    };
  }

  private getHallucinationAlertTemplate(): EmailTemplate {
    return {
      name: 'hallucination-alert',
      subject: 'Hallucination Alert: {{COUNT}} issues detected for {{WORKSPACE}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #F59E0B;">Hallucination Alert</h1>
          <p>We've detected {{COUNT}} potential hallucination(s) for <strong>{{WORKSPACE}}</strong>.</p>
          
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="color: #D97706; margin-top: 0;">Alert Summary</h3>
            <p><strong>Total Issues:</strong> {{COUNT}}</p>
            <p><strong>Critical Issues:</strong> {{CRITICAL}}</p>
          </div>
          
          <p>These issues may be affecting your brand's accuracy in AI responses. We recommend:</p>
          <ul>
            <li>Reviewing the flagged statements</li>
            <li>Updating your workspace profile with correct information</li>
            <li>Submitting corrections to AI platforms</li>
          </ul>
          
          <p><a href="https://app.ai-visibility.com/alerts" style="background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Alerts</a></p>
        </div>
      `,
      text: `
        Hallucination Alert
        
        We've detected {{COUNT}} potential hallucination(s) for {{WORKSPACE}}.
        
        Alert Summary:
        - Total Issues: {{COUNT}}
        - Critical Issues: {{CRITICAL}}
        
        These issues may be affecting your brand's accuracy in AI responses. We recommend:
        - Reviewing the flagged statements
        - Updating your workspace profile with correct information
        - Submitting corrections to AI platforms
        
        Review Alerts: https://app.ai-visibility.com/alerts
      `,
    };
  }
}

