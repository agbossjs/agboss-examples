import {
  Action,
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  ExecutionContext,
  Injectable,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqliteMeshRequestRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  start,
  type ActionHandler,
  type BudgetHandler,
  type InputOf,
  type OutputOf,
} from "agboss";
import {
  A2ACallerResolution,
  A2AExpose,
  A2ARoute,
  type A2ACallerRequest,
  type A2ACallerResolver,
} from "agboss/a2a";
import { Decimal, Text } from "agboss/dto";
import {
  ModelCost,
  ModelProvider,
  RetryPolicy,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { hours, minutes, seconds, usd, type Usd } from "agboss/units";
import { AppEnvironment } from "../src/environments/app.environment.js";

export class BillingInquiryDto {
  @Text({ prompt: "Invoice ID to inspect (e.g. INV-5001)" })
  invoiceId!: string;

  @Text({ prompt: "Customer question about the invoice" })
  question!: string;
}

export class BillingResolutionDto {
  @Text({ prompt: "Invoice ID inspected" })
  invoiceId!: string;

  @Text({ prompt: "Billing resolution summary" })
  resolution!: string;

  @Decimal({ prompt: "Credited amount in USD", min: 0 })
  creditedUsd!: number;

  @Text({ prompt: "Authenticated tenant ID resolved by the A2A host" })
  resolvedTenantId!: string;
}

export interface BillingApiKeyGrant {
  readonly clientId: string;
  readonly tenantId: string;
  readonly canAnswerPauses: boolean;
}

@Injectable()
export class BillingApiKeyDirectory {
  grantOf(apiKey: string): Promise<BillingApiKeyGrant | undefined> {
    if (apiKey === "key-acme") {
      return Promise.resolve({
        clientId: "triage-gateway-acme",
        tenantId: "acme",
        canAnswerPauses: true,
      });
    }
    if (apiKey === "key-readonly") {
      return Promise.resolve({
        clientId: "triage-gateway-readonly",
        tenantId: "acme",
        canAnswerPauses: false,
      });
    }
    return Promise.resolve(undefined);
  }
}

@WorkflowStart({
  name: "billing-workflow-start",
  description: "Inspects an invoice and resolves billing inquiries over A2A",
  input: BillingInquiryDto,
})
export class BillingWorkflowStart {}

@WorkflowFinish({
  name: "billing-workflow-finish",
  description: "Returns the billing resolution",
  output: BillingResolutionDto,
})
export class BillingWorkflowFinish {}

@Injectable({ deps: [BillingApiKeyDirectory] })
export class BillingA2aCallerResolver
  implements A2ACallerResolver<typeof BillingWorkflowStart>
{
  constructor(private readonly billingApiKeyDirectory: BillingApiKeyDirectory) {}

  async resolveCaller(
    request: A2ACallerRequest,
  ): Promise<A2ACallerResolution<typeof BillingWorkflowStart>> {
    const authHeader: string = request.http.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return A2ACallerResolution.unauthenticated({
        reason: "Missing Bearer API key",
        challenge: 'Bearer realm="billing-a2a"',
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const grant = await this.billingApiKeyDirectory.grantOf(token);
    if (grant === undefined) {
      return A2ACallerResolution.unauthenticated({
        reason: "Unknown API key",
        challenge: 'Bearer realm="billing-a2a"',
      });
    }
    if (request.route === A2ARoute.Resume && !grant.canAnswerPauses) {
      return A2ACallerResolution.forbidden({
        reason: "This API key is not permitted to answer pauses",
      });
    }
    return A2ACallerResolution.resolved({
      tenant: { tenantId: grant.tenantId },
      ownerId: grant.clientId,
      peer: "triage-gateway-application",
    });
  }
}

@Action({
  name: "resolve-billing-inquiry-action",
  description: "Resolves an invoice inquiry for the authenticated tenant",
  input: { inquiry: BillingInquiryDto },
  output: BillingResolutionDto,
  deps: [ExecutionContext],
})
export class ResolveBillingInquiryAction
  implements ActionHandler<ResolveBillingInquiryAction>
{
  constructor(private readonly executionContext: ExecutionContext) {}

  execute(
    input: InputOf<ResolveBillingInquiryAction>,
  ): Promise<OutputOf<ResolveBillingInquiryAction>> {
    const { invoiceId } = input.inquiry.value;
    const tenantId = this.executionContext.tenant.tenantId;
    return Promise.resolve({
      invoiceId,
      resolution: `Invoice ${invoiceId} verified for tenant ${tenantId}; $45.00 SLA credit applied.`,
      creditedUsd: 45,
      resolvedTenantId: tenantId,
    });
  }
}

@Workflow({
  name: "billing-workflow",
  version: "1.0.0",
  flow: [
    start(BillingWorkflowStart)
      .returns(BillingInquiryDto)
      .toAction(ResolveBillingInquiryAction)
      .returns(BillingResolutionDto)
      .toFinish(BillingWorkflowFinish),
  ],
  providers: [BillingApiKeyDirectory, BillingA2aCallerResolver],
})
export class BillingWorkflow {}

@A2AExpose({
  name: "billing-a2a-expose",
  version: "1.0.0",
  exports: [BillingWorkflowStart],
})
export class BillingA2AExpose {}

@Budget({
  name: "billing-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class BillingAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(30);
  }
}

@Budget({
  name: "billing-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class BillingTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Budget({
  name: "billing-execution-budget",
  scope: BudgetScope.Execution,
})
export class BillingExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.5);
  }
}

@ModelProvider({
  name: "billing-offline-model-provider",
  description: "Offline model provider for BillingApplication",
  serves: [/^offline\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class BillingOfflineModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    void request;
    return Promise.resolve({
      text: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }
}

@Application({
  name: "billing-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [BillingWorkflow],
  budgets: [BillingAppDailyBudget, BillingTenantDailyBudget, BillingExecutionBudget],
  exposes: [BillingA2AExpose],
  maxMeshHops: 3,
  mesh: {
    signingKey: "meshSigningKey",
    peers: [
      {
        application: "triage-gateway-application",
        verifyKey: "triageVerifyKey",
      },
    ],
  },
  providers: [
    BillingOfflineModelProvider,
    BillingApiKeyDirectory,
    BillingA2aCallerResolver,
    SqliteCheckpointSaver,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteRateLimitRepository,
    SqliteExecutionHistoryRepository,
    SqliteMeshRequestRepository,
  ],
  executionRecordRetention: hours(24 * 30),
  pauseRecordRetention: hours(24),
  shutdownTimeout: seconds(15),
})
export class BillingApplication {}
