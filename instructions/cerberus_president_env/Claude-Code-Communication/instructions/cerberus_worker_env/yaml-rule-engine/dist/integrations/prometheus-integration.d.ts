import { YAMLRuleEngine } from '../core/rule-engine';
export declare class PrometheusIntegration {
    private registry;
    private metrics;
    constructor();
    integrateWithEngine(engine: YAMLRuleEngine): void;
    private updateSystemMetrics;
    recordLLMResponse(provider: string, operation: string, duration: number): void;
    getMetrics(): Promise<string>;
    getMetricsJSON(): Promise<any>;
    getAlertRules(): string;
    getGrafanaQueries(): Record<string, string>;
    validateIntegration(): Promise<boolean>;
}
export declare function setupPrometheusEndpoint(app: any, prometheus: PrometheusIntegration): void;
//# sourceMappingURL=prometheus-integration.d.ts.map