use std::collections::HashMap;

use tokscale_core::pricing::{PricingContext, PricingService};
use tokscale_core::{TokenBreakdown, UnifiedMessage};

use super::types::UsageDataCost;

const PROBE_TOKENS: i64 = 1_000;

#[derive(Clone, Copy)]
struct UnitPrices {
    input: f64,
    output: f64,
    reasoning: f64,
    cache_input: f64,
    cache_output: f64,
    cache_output_1h: f64,
}

type PriceKey = (
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    bool,
);

pub struct PriceDetector<'a> {
    pricing: Option<&'a PricingService>,
    prices: HashMap<PriceKey, UnitPrices>,
}

impl<'a> PriceDetector<'a> {
    pub fn new(pricing: Option<&'a PricingService>) -> Self {
        Self {
            pricing,
            prices: HashMap::new(),
        }
    }

    pub fn get_costs(&mut self, message: &UnifiedMessage) -> UsageDataCost {
        let tokens = &message.tokens;
        let total_tokens = tokens.total();
        if message.cost <= 0.0 || total_tokens <= 0 {
            return UsageDataCost::default();
        }

        let token_counts = [
            tokens.input as f64,
            tokens.output as f64,
            tokens.reasoning as f64,
            tokens.cache_read as f64,
            tokens.cache_write as f64,
        ];

        let weights = match self.get_unit_prices(message) {
            Some(prices) => [
                token_counts[0] * prices.input,
                token_counts[1] * prices.output,
                token_counts[2] * prices.reasoning,
                token_counts[3] * prices.cache_input,
                (tokens.cache_write - tokens.cache_write_1h) as f64 * prices.cache_output
                    + tokens.cache_write_1h as f64 * prices.cache_output_1h,
            ],
            None => [0.0; 5],
        };

        let weight_total: f64 = weights.iter().sum();
        let shares = if weight_total > 0.0 {
            weights.map(|weight| weight / weight_total)
        } else {
            token_counts.map(|count| count / total_tokens as f64)
        };

        UsageDataCost {
            input: message.cost * shares[0],
            output: message.cost * shares[1],
            reasoning: message.cost * shares[2],
            cache_input: message.cost * shares[3],
            cache_output: message.cost * shares[4],
        }
    }

    fn get_unit_prices(&mut self, message: &UnifiedMessage) -> Option<UnitPrices> {
        let pricing = self.pricing?;
        let context = message.pricing_context();
        let key: PriceKey = (
            context.raw_model.to_string(),
            context.model.to_string(),
            context.billing_provider.map(str::to_string),
            context.upstream_hint.map(str::to_string),
            context.service_tier.map(str::to_string),
            context.multi_call_aggregate,
        );

        if let Some(prices) = self.prices.get(&key) {
            return Some(*prices);
        }

        let prices = UnitPrices {
            input: probe(pricing, &context, |tokens| tokens.input = PROBE_TOKENS),
            output: probe(pricing, &context, |tokens| tokens.output = PROBE_TOKENS),
            reasoning: probe(pricing, &context, |tokens| tokens.reasoning = PROBE_TOKENS),
            cache_input: probe(pricing, &context, |tokens| tokens.cache_read = PROBE_TOKENS),
            cache_output: probe(pricing, &context, |tokens| {
                tokens.cache_write = PROBE_TOKENS
            }),
            cache_output_1h: probe(pricing, &context, |tokens| {
                tokens.cache_write = PROBE_TOKENS;
                tokens.cache_write_1h = PROBE_TOKENS;
            }),
        };
        self.prices.insert(key, prices);
        Some(prices)
    }
}

fn probe(
    pricing: &PricingService,
    context: &PricingContext<'_>,
    fill: impl FnOnce(&mut TokenBreakdown),
) -> f64 {
    let mut tokens = TokenBreakdown::default();
    fill(&mut tokens);
    pricing.estimate_context(context, &tokens).cost / PROBE_TOKENS as f64
}
