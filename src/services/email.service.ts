import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Send email notification with call summary
   * @param toEmail Recipient email address
   * @param subject Email subject
   * @param body Email body (HTML or plain text)
   */
  async sendEmail(toEmail: string, subject: string, body: string): Promise<void> {
    if (!toEmail) {
      this.logger.warn("No email address provided, skipping email notification");
      return;
    }

    try {
      // For now, we'll use a simple HTTP-based email service
      // In production, you might want to use SendGrid, AWS SES, or similar
      const emailApiUrl = this.configService.get<string>("EMAIL_API_URL");
      const emailApiKey = this.configService.get<string>("EMAIL_API_KEY");

      if (emailApiUrl && emailApiKey) {
        // Use external email service
        const response = await fetch(emailApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${emailApiKey}`,
          },
          body: JSON.stringify({
            to: toEmail,
            subject: subject,
            html: body,
            text: body.replace(/<[^>]*>/g, ""), // Strip HTML for plain text version
          }),
        });

        if (!response.ok) {
          throw new Error(`Email API returned ${response.status}: ${await response.text()}`);
        }

        this.logger.log(`Email sent successfully to ${toEmail}`);
      } else {
        // Fallback: Log email content (for development/testing)
        this.logger.log("=".repeat(80));
        this.logger.log(`EMAIL NOTIFICATION (Email service not configured)`);
        this.logger.log(`To: ${toEmail}`);
        this.logger.log(`Subject: ${subject}`);
        this.logger.log(`Body:`);
        this.logger.log(body);
        this.logger.log("=".repeat(80));
      }
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${toEmail}: ${error.message}`, error.stack);
      // Don't throw - email failure shouldn't break the call flow
    }
  }

  /**
   * Generate email body from template string
   * @param template Template string with {{FieldName}} placeholders
   * @param data Data object with field values
   * @returns Formatted email body
   */
  generateCallSummaryEmailFromTemplate(template: string, data: Record<string, any>): string {
    // Replace all template variables
    let body = template.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
      const trimmedField = fieldName.trim();
      // Try exact match first
      if (data[trimmedField] !== undefined && data[trimmedField] !== null && data[trimmedField] !== "") {
        return String(data[trimmedField]);
      }
      // Try camelCase version
      const camelCase = trimmedField.charAt(0).toLowerCase() + trimmedField.slice(1);
      if (data[camelCase] !== undefined && data[camelCase] !== null && data[camelCase] !== "") {
        return String(data[camelCase]);
      }
      // Return empty string if not found
      return "";
    });

    // Wrap in HTML email template
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; white-space: pre-wrap; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>New Call Inquiry</h2>
    </div>
    <div class="content">${body}</div>
    <div class="footer">
      <p>This is an automated notification from your Voice Agent Platform.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate email body from call summary data using custom template (legacy method)
   * @param callData Call data including analysis and extracted data
   * @param emailTemplate Optional custom email template configuration
   * @returns Formatted email body
   */
  generateCallSummaryEmail(
    callData: Record<string, any> & {
      companyName?: string;
      callerName?: string;
      phoneNumber?: string;
      email?: string;
      serviceType?: string;
      budget?: string;
      businessType?: string;
      companySize?: string;
      timeline?: string;
      callSummary?: string;
    },
    emailTemplate?: {
      subjectFormat?: string;
      fields?: Array<{
        label: string;
        fieldName: string;
        includeInEmail: boolean;
      }>;
    }
  ): string {
    // Extract common fields with defaults
    const companyName = callData.companyName || callData.company || "Not provided";
    const callerName = callData.callerName || callData.name || "Not provided";
    const phoneNumber = callData.phoneNumber || callData.phone || "Not provided";
    const email = callData.email || "Not provided";
    const serviceType = callData.serviceType || callData.service || "Not provided";
    const budget = callData.budget || "Not provided";
    const businessType = callData.businessType || callData.business || "Not provided";
    const companySize = callData.companySize || "Not provided";
    const timeline = callData.timeline || callData.timeframe || "Not provided";
    const callSummary = callData.callSummary || "No summary available";

    // Use custom template fields if provided, otherwise use default
    const templateFields = emailTemplate?.fields || [
      { label: "Call Summary", fieldName: "callSummary", includeInEmail: true },
    ];

    // Map field names to call data values (support dynamic fields from extractedData)
    const getFieldValue = (fieldName: string): string => {
      // First check if fieldName exists directly in callData
      if (callData[fieldName] !== undefined && callData[fieldName] !== null && callData[fieldName] !== "") {
        return String(callData[fieldName]);
      }
      
      // Check common field mappings
      const fieldMap: Record<string, string> = {
        companyName: companyName,
        callerName: callerName,
        phoneNumber: phoneNumber,
        email: email,
        serviceType: serviceType,
        budget: budget,
        businessType: businessType,
        companySize: companySize,
        timeline: timeline,
        callSummary: callSummary,
      };
      
      if (fieldMap[fieldName] !== undefined) {
        return fieldMap[fieldName];
      }
      
      return "Not provided";
    };

    // Generate subject from template or use default
    const subjectTemplate = emailTemplate?.subjectFormat || "New Inquiry - {{CompanyName}} - {{CallerName}}";
    const emailSubject = subjectTemplate
      .replace(/\{\{CompanyName\}\}/g, companyName)
      .replace(/\{\{CallerName\}\}/g, callerName)
      .replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
        const value = getFieldValue(fieldName.charAt(0).toLowerCase() + fieldName.slice(1));
        return value !== "Not provided" ? value : "";
      });

    // Build email body with custom fields
    const fieldsHtml = templateFields
      .filter((field) => field.includeInEmail)
      .map((field) => {
        const value = getFieldValue(field.fieldName);
        // Only show fields that have values (except callSummary which should always show)
        if (value === "Not provided" && field.fieldName !== "callSummary") {
          return "";
        }
        // For call summary, use special formatting
        if (field.fieldName === "callSummary") {
          return `
      <div class="summary">
        <div class="label">${field.label}:</div>
        <div class="value" style="margin-top: 10px; white-space: pre-wrap;">${value}</div>
      </div>`;
        }
        return `
      <div class="field">
        <div class="label">${field.label}:</div>
        <div class="value">${value}</div>
      </div>`;
      })
      .filter((html) => html.trim() !== "") // Remove empty fields
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #374151; }
    .value { color: #6b7280; margin-top: 5px; }
    .summary { background-color: white; padding: 15px; border-left: 4px solid #4F46E5; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${emailSubject}</h2>
    </div>
    <div class="content">
      ${fieldsHtml}
    </div>
    <div class="footer">
      <p>This is an automated notification from your Voice Agent Platform.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

