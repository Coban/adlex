// Domain Errors
export * from './errors'

// Domain Entities
export * from './entities'

// Value Objects
export * from './valueObjects'

// Domain Services
export * from './services'

// Aggregates
export * from './aggregates'

// Domain Events
export * from './events'

// Specifications
export * from './specifications'

// Re-export commonly used types
export type {
  UserRole,
  DictionaryCategory,
  CheckStatus,
  SubscriptionTier,
  OrganizationLimits,
  OrganizationUsage
} from './entities'

export type {
  ViolationCandidate,
  SimilarityMatch,
  UsageLimitResult,
  OrganizationAction,
  CheckSummary
} from './services'

export type {
  DomainEvent,
  AllDomainEvents,
  DomainEventHandler,
  DomainEventPublisher,
  DomainEventStore
} from './events'