-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'REVIEWER', 'USER');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LAW', 'PRESIDENTIAL_DECREE', 'MINISTERIAL_ORDINANCE', 'LOCAL_ORDINANCE', 'LOCAL_RULE', 'ADMINISTRATIVE_RULE', 'OFFICIAL_INTERPRETATION', 'COURT_CASE', 'ADMINISTRATIVE_APPEAL', 'INTERNAL_MEMO', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PROCESSING', 'ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "JurisdictionType" AS ENUM ('NATIONAL', 'METROPOLITAN', 'BASIC');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('REDEVELOPMENT', 'RECONSTRUCTION', 'STREET_HOUSING', 'SMALL_RECONSTRUCTION', 'SMALL_REDEVELOPMENT', 'SELF_HOUSING', 'MOATOWN', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcedureStage" AS ENUM ('DISTRICT_DESIGNATION', 'PROMOTION_COMMITTEE', 'ASSOCIATION_ESTABLISHMENT', 'PROJECT_IMPLEMENTATION_PLAN', 'MANAGEMENT_DISPOSITION_PLAN', 'CONTRACTOR_SELECTION', 'RELOCATION_DEMOLITION', 'CONSTRUCTION_COMPLETION', 'LIQUIDATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ParsingStatus" AS ENUM ('PENDING', 'SUCCESS', 'NO_TEXT_EXTRACTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChunkType" AS ENUM ('DOCUMENT_TITLE', 'CHAPTER', 'SECTION', 'ARTICLE', 'PARAGRAPH', 'ITEM', 'SUB_ITEM', 'APPENDIX', 'TABLE', 'INTERPRETATION', 'CASE_SUMMARY', 'GENERAL_TEXT');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'PARSING', 'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AnswerConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'NEEDS_CORRECTION', 'APPROVED');

-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "FeedbackReason" AS ENUM ('HELPFUL', 'INCORRECT', 'MISSING_CITATION', 'OUTDATED_SOURCE', 'WRONG_REGION', 'UNSUPPORTED_CONCLUSION', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "jurisdictionType" "JurisdictionType" NOT NULL,
    "jurisdictionName" TEXT NOT NULL,
    "businessTypes" "BusinessType"[],
    "issuingAuthority" TEXT,
    "sourceUrl" TEXT,
    "description" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "legalDocumentId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "promulgationDate" TIMESTAMP(3),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "rawText" TEXT,
    "parsingStatus" "ParsingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalChunk" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "chunkType" "ChunkType" NOT NULL,
    "articleNumber" TEXT,
    "articleTitle" TEXT,
    "paragraphNumber" TEXT,
    "itemNumber" TEXT,
    "subItemNumber" TEXT,
    "hierarchyPath" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "normalizedContent" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "embedding" vector(1536),
    "tokenCount" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "totalChunks" INTEGER NOT NULL DEFAULT 0,
    "processedChunks" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "region" TEXT,
    "businessType" "BusinessType",
    "procedureStage" "ProcedureStage",
    "referenceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "structuredAnswer" JSONB,
    "confidence" "AnswerConfidence",
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerCitation" (
    "id" TEXT NOT NULL,
    "chatMessageId" TEXT NOT NULL,
    "legalChunkId" TEXT NOT NULL,
    "citationOrder" INTEGER NOT NULL,
    "quotedText" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION,
    "citationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnswerFeedback" (
    "id" TEXT NOT NULL,
    "chatMessageId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" "FeedbackRating" NOT NULL,
    "reason" "FeedbackReason" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "legalDocumentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "LegalDocument_documentType_idx" ON "LegalDocument"("documentType");

-- CreateIndex
CREATE INDEX "LegalDocument_jurisdictionType_jurisdictionName_idx" ON "LegalDocument"("jurisdictionType", "jurisdictionName");

-- CreateIndex
CREATE INDEX "LegalDocument_status_idx" ON "LegalDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_contentHash_key" ON "DocumentVersion"("contentHash");

-- CreateIndex
CREATE INDEX "DocumentVersion_legalDocumentId_idx" ON "DocumentVersion"("legalDocumentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_isCurrent_idx" ON "DocumentVersion"("isCurrent");

-- CreateIndex
CREATE INDEX "LegalChunk_documentVersionId_idx" ON "LegalChunk"("documentVersionId");

-- CreateIndex
CREATE INDEX "LegalChunk_articleNumber_idx" ON "LegalChunk"("articleNumber");

-- CreateIndex
CREATE INDEX "LegalChunk_chunkType_idx" ON "LegalChunk"("chunkType");

-- CreateIndex
CREATE INDEX "IngestionJob_documentVersionId_idx" ON "IngestionJob"("documentVersionId");

-- CreateIndex
CREATE INDEX "IngestionJob_status_idx" ON "IngestionJob"("status");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_chatSessionId_idx" ON "ChatMessage"("chatSessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_reviewStatus_idx" ON "ChatMessage"("reviewStatus");

-- CreateIndex
CREATE INDEX "AnswerCitation_chatMessageId_idx" ON "AnswerCitation"("chatMessageId");

-- CreateIndex
CREATE INDEX "AnswerCitation_legalChunkId_idx" ON "AnswerCitation"("legalChunkId");

-- CreateIndex
CREATE INDEX "AnswerFeedback_chatMessageId_idx" ON "AnswerFeedback"("chatMessageId");

-- CreateIndex
CREATE INDEX "AuditLog_legalDocumentId_idx" ON "AuditLog"("legalDocumentId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalChunk" ADD CONSTRAINT "LegalChunk_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerCitation" ADD CONSTRAINT "AnswerCitation_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerCitation" ADD CONSTRAINT "AnswerCitation_legalChunkId_fkey" FOREIGN KEY ("legalChunkId") REFERENCES "LegalChunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerFeedback" ADD CONSTRAINT "AnswerFeedback_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerFeedback" ADD CONSTRAINT "AnswerFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
