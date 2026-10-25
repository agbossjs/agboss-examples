import {
  Agent,
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
  Tool,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  start,
  type BudgetHandler,
  type ToolHandler,
} from "agboss";
import { Decimal, Integer, Text } from "agboss/dto";
import { McpExpose } from "agboss/mcp";
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

export class SkuLookupInputDto {
  @Text({ prompt: "Product SKU code (e.g. SKU-GPU-900)" })
  sku!: string;
}

export class SkuDetailsDto {
  @Text({ prompt: "Product SKU code" })
  sku!: string;

  @Text({ prompt: "Product title" })
  title!: string;

  @Decimal({ prompt: "Unit price in USD", min: 0 })
  unitPriceUsd!: number;

  @Integer({ prompt: "Units currently in stock", min: 0 })
  inStockUnits!: number;
}

let catalogExecutionCount = 0;

export function resetCatalogExecutionCount(): void {
  catalogExecutionCount = 0;
}

export function getCatalogExecutionCount(): number {
  return catalogExecutionCount;
}

@Injectable()
export class CatalogInventoryService {
  lookup(sku: string): Promise<SkuDetailsDto> {
    catalogExecutionCount += 1;
    return Promise.resolve({
      sku,
      title: `Enterprise Rack Module (${sku})`,
      unitPriceUsd: 1250,
      inStockUnits: 14,
    });
  }
}

@Tool({
  name: "lookup-sku-tool",
  description: "Looks up SKU pricing and stock levels in the enterprise catalog",
  input: SkuLookupInputDto,
  output: SkuDetailsDto,
  deps: [CatalogInventoryService, ExecutionContext],
})
export class LookupSkuTool implements ToolHandler<SkuLookupInputDto, SkuDetailsDto> {
  constructor(
    private readonly catalogInventoryService: CatalogInventoryService,
    private readonly executionContext: ExecutionContext,
  ) {}

  run({ sku }: SkuLookupInputDto): Promise<SkuDetailsDto> {
    void this.executionContext.step.idempotencyKey;
    return this.catalogInventoryService.lookup(sku);
  }
}

@WorkflowStart({
  name: "catalog-workflow-start",
  description: "Looks up a SKU in the catalog workflow",
  input: SkuLookupInputDto,
})
export class CatalogWorkflowStart {}

@WorkflowFinish({
  name: "catalog-workflow-finish",
  description: "Returns the SKU details",
  output: SkuDetailsDto,
})
export class CatalogWorkflowFinish {}

@Agent({
  name: "lookup-sku-agent",
  description: "Reads SKU details from CatalogInventoryService via lookup-sku-tool",
  prompt: "Call lookup-sku-tool for the requested SKU and return the SKU details.",
  model: "openai/gpt-4o-mini",
  input: { request: SkuLookupInputDto },
  output: SkuDetailsDto,
  tools: [LookupSkuTool],
  maxToolCalls: 2,
})
export class LookupSkuAgent {}

@Workflow({
  name: "catalog-workflow",
  version: "1.0.0",
  flow: [
    start(CatalogWorkflowStart)
      .returns(SkuLookupInputDto)
      .toAgent(LookupSkuAgent)
      .returns(SkuDetailsDto)
      .toFinish(CatalogWorkflowFinish),
  ],
  maxSteps: 4,
  providers: [CatalogInventoryService],
})
export class CatalogWorkflow {}

@McpExpose({
  name: "catalog-mcp",
  version: "1.0.0",
  exports: [LookupSkuTool, CatalogWorkflowStart],
})
export class CatalogMcp {}

@Budget({
  name: "catalog-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class CatalogAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "catalog-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class CatalogTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Budget({
  name: "catalog-execution-budget",
  scope: BudgetScope.Execution,
})
export class CatalogExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.5);
  }
}

@ModelProvider({
  name: "catalog-offline-model-provider",
  description: "Offline model provider for CatalogApplication",
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
export class CatalogOfflineModelProvider implements ModelProviderHandler {
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
  name: "catalog-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [CatalogWorkflow],
  budgets: [CatalogAppDailyBudget, CatalogTenantDailyBudget, CatalogExecutionBudget],
  exposes: [CatalogMcp],
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
    CatalogInventoryService,
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
export class CatalogApplication {}
