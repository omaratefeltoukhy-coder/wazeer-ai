// Barrel file for backward compatibility — re-exports all email AI functions.
export {
  CAMPAIGN_TYPES,
  CAMPAIGN_LABEL,
  SequenceSchema,
  SingleEmailSchema,
  SAFETY_RAILS,
  type CampaignType,
  generateEmailCampaign,
  regenerateEmailMessage,
} from "./email-campaign.server";

export {
  listEmailCampaigns,
  getEmailCampaign,
  updateEmailCampaign,
  deleteEmailCampaign,
  sendEmailCampaign,
  getCampaignAnalytics,
  seedDemoContacts,
} from "./email-campaign-crud.server";

export {
  updateEmailMessage,
  duplicateEmailMessage,
  archiveEmailMessage,
  scheduleEmail,
  sendTestEmail,
} from "./email-message.server";

export {
  generateUnsubscribeLink,
  validateUnsubscribeToken,
  confirmUnsubscribe,
} from "./email-unsubscribe.server";

// Backward-compatible aliases for old names
export { listEmailCampaigns as listCampaigns, getEmailCampaign as getCampaign } from "./email-campaign-crud.server";
