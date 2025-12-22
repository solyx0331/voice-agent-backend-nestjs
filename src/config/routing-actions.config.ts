/**
 * Shared routing actions configuration
 * This file defines standard routing actions and their descriptions
 * Used across agents for consistency and easier updates
 */

export interface RoutingActionDefinition {
  action: string;
  description: string;
  requiresFields?: string[];
  endCall?: boolean;
  category: "standard" | "custom";
}

export const STANDARD_ROUTING_ACTIONS: Record<string, RoutingActionDefinition> = {
  "callback": {
    action: "callback",
    description: "Collect contact information and terminate the call. Agent will ask for name and phone number, then end the call.",
    requiresFields: ["name", "phone"],
    endCall: true,
    category: "standard",
  },
  "quote": {
    action: "quote",
    description: "Collect quotation details and continue with pricing flow. Agent will gather product/service details and budget information.",
    requiresFields: ["product", "quantity", "budget"],
    endCall: false,
    category: "standard",
  },
  "continue-flow": {
    action: "continue-flow",
    description: "Continue to the next question in the conversation flow. This is the default action when no specific intent matches.",
    endCall: false,
    category: "standard",
  },
  "opt-out": {
    action: "opt-out",
    description: "Handle opt-out request (e.g., stop recording, unsubscribe). Agent will acknowledge and stop the requested action.",
    endCall: false,
    category: "standard",
  },
  "transfer": {
    action: "transfer",
    description: "Transfer the call to a human representative. Agent will collect basic info and connect to a live agent.",
    requiresFields: ["name"],
    endCall: false,
    category: "standard",
  },
  "voicemail": {
    action: "voicemail",
    description: "Route to voicemail. Agent will prompt caller to leave a message.",
    endCall: false,
    category: "standard",
  },
  "end-call": {
    action: "end-call",
    description: "End the call immediately. Agent will provide a closing message and terminate.",
    endCall: true,
    category: "standard",
  },
  "escalate": {
    action: "escalate",
    description: "Escalate to higher priority handling. Agent will collect urgent details and flag for immediate follow-up.",
    requiresFields: ["name", "phone", "reason"],
    endCall: false,
    category: "standard",
  },
};

/**
 * Get routing action description
 */
export function getRoutingActionDescription(action: string): string {
  const definition = STANDARD_ROUTING_ACTIONS[action.toLowerCase()];
  return definition?.description || `Custom routing action: ${action}. Behavior depends on agent configuration.`;
}

/**
 * Get all standard routing actions
 */
export function getAllStandardRoutingActions(): RoutingActionDefinition[] {
  return Object.values(STANDARD_ROUTING_ACTIONS);
}

/**
 * Check if action is a standard routing action
 */
export function isStandardRoutingAction(action: string): boolean {
  return action.toLowerCase() in STANDARD_ROUTING_ACTIONS;
}

