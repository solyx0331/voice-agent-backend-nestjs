# Sales Assistant Test Configuration Guide

This document provides step-by-step instructions for configuring the "Sales Assistant" agent according to the test guide.

## Agent Configuration

### 1. Basic Information

- **Agent Name**: `Sales Assistant`
- **Description**: `Handles inbound inquiries for sales at Evolved Sound and QW Direct.`
- **Status**: `Active`

### 2. Voice Configuration

- **Voice Type**: `Generic`
- **Generic Voice**: Select `ElevenLabs - Noah` (en-AU) from the dropdown
  - If "Noah" is not available, look for any Australian voice (en-AU) from ElevenLabs
  - The system will automatically filter and show Australian voices

### 3. Base Receptionist Logic

**📍 Location**: In the Agent Configuration Dialog, scroll to the "Base Receptionist Logic" section. The routing logic is at the bottom of this section, labeled "Routing & Response Logic".

#### Greeting Message
```
Hello! Thank you for calling. This is the virtual assistant for Evolved Sound and QW Direct. To help you better, please say the name of the company you're trying to reach. You can say 'Evolved Sound' or 'QW Direct'.
```

#### Routing & Response Logic Rules

**📍 To add rules**: Click "Add Rule" button in the "Routing & Response Logic" section (at the bottom of Base Receptionist Logic).

Add the following routing rules (each rule has 3 fields: Condition, Action, Response):

**Rule 1: Evolved Sound Routing**
- **Condition**: `caller says "Evolved Sound"`
- **Action**: `Route to Evolved Sound logic tree`
- **Response**: `Thank you for choosing Evolved Sound. What type of service are you enquiring about? (e.g., voice over, audio production)`

**Rule 2: QW Direct Routing**
- **Condition**: `caller says "QW Direct"`
- **Action**: `Route to QW Direct logic tree`
- **Response**: `Thank you for choosing QW Direct. What service are you looking for? (e.g., direct marketing, digital campaign)`

**Rule 3: Unclear Response**
- **Condition**: `caller response is not understood`
- **Action**: `Ask for clarification`
- **Response**: `I didn't catch that. Could you repeat the name of the company you are calling?`

**Rule 4: Fallback After Two Attempts**
- **Condition**: `caller's response is not understood twice`
- **Action**: `Offer human representative`
- **Response**: `I'm sorry, I'm having trouble understanding you. Would you like to speak to a human representative instead?`

#### Primary Intent Prompts

Add the following prompts:

1. `Identify which company the caller wants: Evolved Sound or QW Direct`
2. `Collect service type information based on selected company`
3. `Gather budget information (for Evolved Sound)`
4. `Determine if caller is individual or business (for Evolved Sound)`
5. `Collect company size information (for QW Direct)`
6. `Gather timeline information (for QW Direct)`

#### Information Gathering Questions

**📍 Location**: In "Base Receptionist Logic" section → "Information Gathering Questions"

Add company-specific questions that will be asked after routing. These are the questions from the test guide:

**For Evolved Sound (after routing):**
1. `What type of service are you enquiring about? (e.g., voice over, audio production)`
2. `What is your approximate budget range?`
3. `Are you an individual or a business?`

**For QW Direct (after routing):**
1. `What service are you looking for? (e.g., direct marketing, digital campaign)`
2. `How large is your company?`
3. `What timeframe are you looking at for this service?`

**Note**: You can add all these questions - the agent will ask the appropriate ones based on which company the caller selected.

### 4. FAQs

Add the following FAQs:

**FAQ 1:**
- **Question**: `What services do you offer?`
- **Answer**: `For Evolved Sound, we offer voice over and audio production services. For QW Direct, we offer direct marketing and digital campaign services.`

**FAQ 2:**
- **Question**: `Where are you located?`
- **Answer**: `We have offices in multiple locations. Please let me know which company you're interested in, and I can provide specific location details.`

**FAQ 3:**
- **Question**: `How can I get a quote?`
- **Answer**: `I'll collect your information and our team will reach out to you with a quote. Please provide your contact details.`

### 5. Intents

Add the following intents:

**Intent 1: Voiceover Service**
- **Name**: `voiceover_service`
- **Prompt**: `User is looking for voiceover service`
- **Response**: `For voiceover services, we offer professional voice talent for commercials, narrations, and more. What's your project timeline?`

**Intent 2: Direct Marketing Consultation**
- **Name**: `direct_marketing_consultation`
- **Prompt**: `User wants to book a direct marketing consultation`
- **Response**: `We'd be happy to schedule a consultation. What's your company size and what type of campaign are you considering?`

**Intent 3: Audio Production Quote**
- **Name**: `audio_production_quote`
- **Prompt**: `User needs a quote for audio production`
- **Response**: `I'll collect your information and our team will provide a customized quote. What's your approximate budget range?`

### 6. Lead Capture Fields (Universal)

**📍 Location**: Scroll down past FAQs section → "Lead Capture Fields (Universal)"

These are standard fields collected from ALL callers (universal questions asked after company selection):

Add the following lead capture fields:

1. **Full Name**
   - **Name**: `fullName`
   - **Question**: `What is your full name?`
   - **Type**: `text`
   - **Required**: `Yes`

2. **Phone Number**
   - **Name**: `phoneNumber`
   - **Question**: `What is your best contact number?`
   - **Type**: `phone`
   - **Required**: `Yes`

3. **Email Address**
   - **Name**: `email`
   - **Question**: `What is your email address?`
   - **Type**: `email`
   - **Required**: `Yes`

4. **Service Type**
   - **Name**: `serviceType`
   - **Question**: `What type of service are you interested in?`
   - **Type**: `text`
   - **Required**: `No`

5. **Budget**
   - **Name**: `budget`
   - **Question**: `What is your approximate budget range?`
   - **Type**: `text`
   - **Required**: `No`

6. **Business Type**
   - **Name**: `businessType`
   - **Question**: `Are you an individual or a business?`
   - **Type**: `text`
   - **Required**: `No`

7. **Company Size**
   - **Name**: `companySize`
   - **Question**: `How large is your company?`
   - **Type**: `text`
   - **Required**: `No`

8. **Timeline**
   - **Name**: `timeline`
   - **Question**: `What timeframe are you looking at for this service?`
   - **Type**: `text`
   - **Required**: `No`

### 7. Notifications

- **Email**: `reception@evolvedsound.com` (or your test email address)
- **CRM Type**: `webhook` (optional, if you have a webhook endpoint)

## Email Summary Format

The system will automatically send an email with the following format:

**Subject**: `New Inquiry - {{CompanyName}} - {{CallerName}}`

**Body**:
```
Company: {{CompanyName}}
Name: {{CallerName}}
Phone: {{PhoneNumber}}
Email: {{Email}}
Service Interested In: {{ServiceType}}
Budget (if provided): {{Budget}}
Business Type (if provided): {{BusinessType}}
Company Size (QW Direct): {{CompanySize}}
Timeline: {{Timeline}}

Call Summary:
{{AgentGeneratedSummary}}
```

## Testing Checklist

After configuring the agent, test the following scenarios:

1. ✅ **Call Routing Accuracy**
   - Call and say "Evolved Sound" - verify routing to Evolved Sound flow
   - Call and say "QW Direct" - verify routing to QW Direct flow
   - Call and say something unclear - verify clarification request

2. ✅ **Data Collection Coverage**
   - Verify all lead capture fields are collected
   - Check that company-specific questions are asked based on routing
   - Confirm required fields are enforced

3. ✅ **Summary Email Accuracy**
   - Complete a test call
   - Verify email is sent to configured address
   - Check that all collected data appears in email
   - Verify call summary is included

4. ✅ **Agent Latency Response**
   - Monitor call latency in the dashboard
   - Verify responses are timely (< 2 seconds average)

5. ✅ **Multi-Scenario Call Logic**
   - Test Evolved Sound flow end-to-end
   - Test QW Direct flow end-to-end
   - Test fallback scenarios (unclear responses)
   - Test escalation to human representative

## Notes

- **📍 Routing Logic Location**: The routing logic is in the "Base Receptionist Logic" section → "Routing & Response Logic" (scroll to the bottom of Base Receptionist Logic to find it). Click "Add Rule" to create routing rules.
- The voice "ElevenLabs - Noah" should be available in the Retell account. If not, select any Australian (en-AU) voice from ElevenLabs.
- Email notifications require email service configuration (see ENV_EXAMPLE.md)
- The system will automatically extract data from the conversation and include it in the email summary
- See `ROUTING_LOGIC_GUIDE.md` in the frontend folder for detailed routing logic instructions

