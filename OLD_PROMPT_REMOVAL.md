# Old Prompt Format Removal

## Issue

Old prompt text containing timing instructions may still appear if:
1. An agent has old text stored in the `systemPrompt` field
2. The backend hasn't been restarted after code changes
3. An agent was created/updated before the fixes

## Solution

### Automatic Sanitization

The `buildGeneralPrompt` method now includes a `removeOldFormat()` function that automatically strips old format text from:
- Custom `systemPrompt` fields
- Any legacy timing instruction patterns

### Old Format Patterns Removed

The sanitizer removes:
- "Australian Mobile Number Recognition"
- "Strengthen recognition for Australian mobile format"
- "Capture format: 0400 670 219"
- "Readback format: 'Zero four zero zero... [pause]...'"
- "Split and pace number delivery"
- "Use natural pauses (0.5-1 second)"
- "Read digits individually with brief pauses"
- "Format postcodes: Read digits individually"

### Action Required

**If you see old format text in prompts:**

1. **Restart the backend** to ensure new code is loaded
2. **Update existing agents** - The sanitizer will automatically clean old `systemPrompt` text when agents are updated
3. **Check agent configuration** - If an agent has old text in `systemPrompt`, it will be cleaned on next update

### Verification

To verify the fix:
1. Check the generated prompt in Retell dashboard
2. Look for the new format: "Zero four one two, three four five, six seven eight" (with commas, no pauses)
3. Ensure no "[pause]", "(pause)", or ellipses appear in phone number instructions

## Current Correct Format

✅ **Mobile**: "Zero four one two, three four five, six seven eight."
✅ **Landline**: "Zero three, nine one two three, four five six seven."
✅ **No timing markers**: No [pause], (pause), or ellipses
✅ **Commas for grouping**: Natural pauses via commas
