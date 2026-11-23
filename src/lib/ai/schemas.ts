import { z } from "zod";
import { AI_FEATURES, AI_LIMITS } from "@/lib/ai/config";

export const BriefingRequestSchema = z.object({
  accountId: z.string().uuid(),
});

export const FactWithCitationsSchema = z.object({
  text: z.string().trim().min(1).max(600),
  citations: z.array(z.string().trim().min(1).max(120)).max(6).default([]),
});

export const SuggestedActionSchema = z.object({
  action: z.string().trim().min(1).max(400),
  rationale: z.string().trim().min(1).max(400),
});

export const BriefingModelOutputSchema = z.object({
  overviewSummary: z.string().trim().max(800).default(""),
  overviewFacts: z.array(FactWithCitationsSchema).max(6).default([]),
  recentActivity: z.array(FactWithCitationsSchema).max(8).default([]),
  openDeals: z.array(FactWithCitationsSchema).max(8).default([]),
  outstandingCommitments: z.array(FactWithCitationsSchema).max(10).default([]),
  suggestedNextActions: z.array(SuggestedActionSchema).max(6).default([]),
  missingInformation: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
});

export const FollowUpToneSchema = z.enum(["professional", "warm", "concise", "urgent"]);
export const FollowUpLanguageSchema = z.enum(["en", "ta"]);

export const FollowUpRequestSchema = z.object({
  entityType: z.enum(["account", "lead"]),
  entityId: z.string().uuid(),
  activityIds: z.array(z.string().uuid()).max(8).optional().default([]),
  purpose: z.string().trim().min(3, "Describe the follow-up purpose.").max(AI_LIMITS.maxPurposeChars),
  tone: FollowUpToneSchema,
  language: FollowUpLanguageSchema,
});

export const FollowUpModelOutputSchema = z.object({
  subject: z.string().trim().max(200).nullable().default(null),
  draft: z.string().trim().min(1).max(4000),
  citations: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  missingDetails: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
});

export const NotesToTasksRequestSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(10, "Paste at least 10 characters of meeting notes or conversation text.")
    .max(AI_LIMITS.maxNotesChars, `Notes must be ${AI_LIMITS.maxNotesChars.toLocaleString("en-IN")} characters or fewer.`),
  relatedType: z.enum(["account", "lead"]).optional(),
  relatedId: z.string().uuid().optional(),
});

export const ProposedTaskModelSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).default(""),
  assigneeId: z.string().trim().max(80).nullable().default(null),
  dueDate: z.string().trim().max(32).nullable().default(null),
  supportingExcerpt: z.string().trim().max(400).default(""),
  unresolvedQuestions: z.array(z.string().trim().min(1).max(240)).max(5).default([]),
});

export const NotesToTasksModelOutputSchema = z.object({
  tasks: z.array(ProposedTaskModelSchema).max(20).default([]),
});

export const ConfirmTasksRequestSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  relatedType: z.enum(["account", "lead"]).nullable().optional(),
  relatedId: z.string().uuid().nullable().optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional().default(""),
        assigneeId: z.string().uuid().nullable().optional(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD dates.")
          .nullable()
          .optional(),
      }),
    )
    .min(1, "Select at least one task to create.")
    .max(25),
});

export const FeedbackRequestSchema = z.object({
  feature: z.enum(AI_FEATURES),
  requestId: z.string().trim().min(4).max(100),
  helpful: z.boolean(),
  comment: z.string().trim().max(AI_LIMITS.maxFeedbackChars).optional(),
});

export type SourceRecordRef = {
  key: string;
  recordType:
    | "account"
    | "lead"
    | "contact"
    | "deal"
    | "activity"
    | "filing"
    | "engagement"
    | "invoice"
    | "document"
    | "document_request";
  recordId: string;
  label: string;
  href: string;
};
