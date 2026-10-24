import {
  Agent,
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  ExecutionContext,
  HopsLimitExceededError,
  MeshLoopDetectedError,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqliteMeshRequestRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
  Tool,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  start,
  toFinish,
  type BudgetHandler,
  type ToolHandler,
} from "agboss";
import { A2AAgent, A2AClient } from "agboss/a2a";
import { Decimal, Text } from "agboss/dto";
import { McpServer, McpServerClient, McpTool } from "agboss/mcp";
import {
  ModelCost,
  ModelProvider,
  RetryPolicy,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { hours, kilobytes, minutes, seconds, usd, type Usd } from "agboss/units";
import {
  BillingInquiryDto,
  BillingResolutionDto,
} from "../billing-service/billing.application.js";
import {
  SkuDetailsDto,
  SkuLookupInputDto,
} from "../catalog-mcp/catalog.application.js";
import { AppEnvironment } from "../src/environments/app.environment.js";

export class TriageRequestDto {
  @Text({ prompt: "Invoice ID to check with billing (e.g. INV-5001)" })
  invoiceId!: string;

  @Text({ prompt: "Product SKU to check in the catalog (e.g. SKU-GPU-900)" })
  sku!: string;

  @Text({ prompt: "Customer inquiry text" })
  question!: string;
}

export class TriageResponseDto {
  @Text({ prompt: "Invoice ID checked" })
  invoiceId!: string;

  @Text({ prompt: "SKU checked" })
  sku!: string;

  @Text({ prompt: "Combined resolution from billing A2A and catalog MCP" })
  summary!: string;

  @Decimal({ prompt: "Credited amount in USD from billing", min: 0 })
  creditedUsd!: number;
}

let activeBillingBaseUrl = "http://127.0.0.1:8081/a2a";
let activeBillingApiKey = "key-acme";
let customA2aHeaders: Record<string, string> = {};

export function configureTriageMeshTarget(options: {
  readonly billingUrl?: string;
  readonly apiKey?: string;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}): void {
  if (options.billingUrl !== undefined) {
    activeBillingBaseUrl = options.billingUrl;
  }
  if (options.apiKey !== undefined) {
    activeBillingApiKey = options.apiKey;
  }
  customA2aHeaders = { ...(options.extraHeaders ?? {}) };
}

const catalogTools = {
  "lookup-sku-tool": { input: SkuLookupInputDto, output: SkuDetailsDto },
};

@McpServer({
  name: "catalog-mcp-server",
  transport: "http",
  url: "http://127.0.0.1:8082/mcp",
  target: { application: "catalog-application", expose: "catalog-mcp" },
  tools: catalogTools,
})
export class CatalogMcpServer extends McpServerClient<typeof catalogTools> {}

@McpTool({
  server: CatalogMcpServer,
  name: "search-catalog-tool",
  description: "Looks up SKU details on the remote Catalog MCP server",
  input: SkuLookupInputDto,
  output: SkuDetailsDto,
  timeout: seconds(15),
  maxResultSize: kilobytes(32),
  deps: [CatalogMcpServer, ExecutionContext],
})
export class SearchCatalogTool implements ToolHandler<SkuLookupInputDto, SkuDetailsDto> {
  constructor(
    private readonly catalogMcpServer: CatalogMcpServer,
    private readonly executionContext: ExecutionContext,
  ) {}

  run({ sku }: SkuLookupInputDto): Promise<SkuDetailsDto> {
    return this.catalogMcpServer.call(
      "lookup-sku-tool",
      { sku },
      this.executionContext.signal,
    );
  }
}

@A2AAgent({
  name: "billing-a2a-agent",
  url: "http://127.0.0.1:8081/a2a",
  target: {
    application: "billing-application",
    start: "billing-workflow-start",
  },
  input: BillingInquiryDto,
  output: BillingResolutionDto,
  price: usd(0.002),
  deps: [ExecutionContext],
})
export class BillingA2AAgent extends A2AClient<BillingInquiryDto, BillingResolutionDto> {
  constructor(private readonly executionContext: ExecutionContext) {
    super();
  }

  protected override getHeaders(): Promise<Record<string, string>> {
    void this.executionContext.tenant.tenantId;
    return Promise.resolve({
      authorization: `Bearer ${activeBillingApiKey}`,
      ...customA2aHeaders,
    });
  }
}

@Tool({
  name: "ask-billing-tool",
  description: "Delegates invoice resolution to BillingApplication over A2A",
  input: BillingInquiryDto,
  output: BillingResolutionDto,
  timeout: seconds(30),
  deps: [BillingA2AAgent, ExecutionContext],
})
export class AskBillingTool implements ToolHandler<BillingInquiryDto, BillingResolutionDto> {
  constructor(
    private readonly billingA2AAgent: BillingA2AAgent,
    private readonly executionContext: ExecutionContext,
  ) {}

  run(inquiry: BillingInquiryDto): Promise<BillingResolutionDto> {
    const client =
      activeBillingBaseUrl === "http://127.0.0.1:8081/a2a"
        ? this.billingA2AAgent
        : new A2AClient<BillingInquiryDto, BillingResolutionDto>({
            url: activeBillingBaseUrl,
            contract: {
              target: {
                application: "billing-application",
                start: "billing-workflow-start",
              },
              input: BillingInquiryDto,
              output: BillingResolutionDto,
            },
            headers: {
              authorization: `Bearer ${activeBillingApiKey}`,
              ...customA2aHeaders,
            },
          });
    return client.execute(inquiry, { signal: this.executionContext.signal });
  }
}

@Agent({
  name: "triage-agent",
  description: "Coordinates catalog MCP lookups and billing A2A inquiries",
  prompt:
    "Look up the SKU with search-catalog-tool and resolve the invoice with ask-billing-tool, then return the combined triage response.",
  model: "offline/triage-chat",
  input: { request: TriageRequestDto },
  output: TriageResponseDto,
  tools: [SearchCatalogTool, AskBillingTool],
  maxToolCalls: 4,
})
export class TriageAgent {}

@WorkflowStart({
  name: "triage-workflow-start",
  description: "Entry point for enterprise triage requests across A2A and MCP",
  input: TriageRequestDto,
})
export class TriageWorkflowStart {}

@WorkflowFinish({
  name: "triage-workflow-finish",
  description: "Completed triage response",
  output: TriageResponseDto,
})
export class TriageWorkflowFinish {}

@WorkflowFinish({
  name: "mesh-loop-fallback-workflow-finish",
  description: "Fallback finish when a cyclic A2A/MCP mesh call or hop limit is detected",
  output: TriageRequestDto,
})
export class MeshLoopFallbackWorkflowFinish {}

@Workflow({
  name: "triage-workflow",
  version: "1.0.0",
  flow: [
    start(TriageWorkflowStart)
      .returns(TriageRequestDto)
      .toAgent(TriageAgent)
      .onError(MeshLoopDetectedError, toFinish(MeshLoopFallbackWorkflowFinish))
      .onError(HopsLimitExceededError, toFinish(MeshLoopFallbackWorkflowFinish))
      .returns(TriageResponseDto)
      .toFinish(TriageWorkflowFinish),
  ],
  maxSteps: 6,
  mcp: [CatalogMcpServer],
  providers: [BillingA2AAgent],
})
export class TriageWorkflow {}

@ModelProvider({
  name: "triage-offline-model-provider",
  description: "Deterministic offline model provider driving TriageAgent tool calls",
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
export class TriageOfflineModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ??
      "answer-triage-response-dto";
    const toolMessages = request.messages.filter((m) => m.role === "tool");

    if (toolMessages.length === 0) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_catalog_1",
            name: "search-catalog-tool",
            arguments: { sku: "SKU-GPU-900" },
          },
        ],
        usage: { inputTokens: 30, outputTokens: 12 },
        cost: usd(0.0001),
      });
    }

    if (toolMessages.length === 1) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_billing_1",
            name: "ask-billing-tool",
            arguments: {
              invoiceId: "INV-5001",
              question: "Verify SLA credit for delayed GPU rack delivery",
            },
          },
        ],
        usage: { inputTokens: 40, outputTokens: 15 },
        cost: usd(0.0001),
      });
    }

    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: "call_triage_answer",
          name: answerTool,
          arguments: {
            invoiceId: "INV-5001",
            sku: "SKU-GPU-900",
            summary:
              "SKU-GPU-900 verified in catalog (14 units) and invoice INV-5001 credited $45.00 by billing-application.",
            creditedUsd: 45,
          },
        },
      ],
      usage: { inputTokens: 50, outputTokens: 20 },
      cost: usd(0.0001),
    });
  }
}

@Budget({
  name: "triage-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class TriageAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(50);
  }
}

@Budget({
  name: "triage-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class TriageTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(10);
  }
}

@Budget({
  name: "triage-execution-budget",
  scope: BudgetScope.Execution,
})
export class TriageExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}

@Application({
  name: "triage-gateway-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [TriageWorkflow],
  budgets: [TriageAppDailyBudget, TriageTenantDailyBudget, TriageExecutionBudget],
  mesh: {
    signingKey: "meshSigningKey",
    peers: [
      { application: "billing-application", verifyKey: "billingVerifyKey" },
    ],
  },
  providers: [
    TriageOfflineModelProvider,
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
export class TriageGatewayApplication {}
