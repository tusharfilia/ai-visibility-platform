/**
 * Contract tests for AI search engine providers
 */

import { EngineKey, Sentiment } from '@ai-visibility/shared';
import { PerplexityProvider } from './perplexity-provider';
import { AioProvider } from './aio-provider';
import { BraveProvider } from './brave-provider';
import { ProviderFactory } from './provider-registry';

describe('Provider Contract Tests', () => {
  const testPrompt = 'What are the best project management tools for small teams?';
  
  describe('PerplexityProvider', () => {
    let provider: PerplexityProvider;

    beforeEach(() => {
      provider = new PerplexityProvider({
        simulateLatency: false,
        simulateErrors: false,
      });
    });

    it('should implement the Provider interface', async () => {
      expect(provider.key).toBe(EngineKey.PERPLEXITY);
      expect(provider.name).toBe('Perplexity AI');
      expect(provider.version).toBe('1.0.0');
    });

    it('should return a valid EngineAnswer', async () => {
      const result = await provider.ask(testPrompt);
      
      expect(result).toMatchObject({
        engine: EngineKey.PERPLEXITY,
        promptId: expect.any(String),
        answerText: expect.any(String),
        mentions: expect.any(Array),
        citations: expect.any(Array),
        meta: expect.any(Object),
        timestamp: expect.any(String),
      });

      expect(result.answerText.length).toBeGreaterThan(0);
      expect(result.mentions.length).toBeGreaterThan(0);
      expect(result.citations.length).toBeGreaterThan(0);
    });

    it('should return valid mentions with sentiment', async () => {
      const result = await provider.ask(testPrompt);
      
      result.mentions.forEach(mention => {
        expect(mention).toMatchObject({
          brand: expect.any(String),
          snippet: expect.any(String),
          sentiment: expect.any(String),
        });
        expect(Object.values(Sentiment)).toContain(mention.sentiment);
      });
    });

    it('should return valid citations with confidence', async () => {
      const result = await provider.ask(testPrompt);
      
      result.citations.forEach(citation => {
        expect(citation).toMatchObject({
          url: expect.any(String),
          domain: expect.any(String),
        });
        if (citation.confidence) {
          expect(citation.confidence).toBeGreaterThan(0);
          expect(citation.confidence).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should perform health check', async () => {
      const health = await provider.healthCheck();
      
      expect(health).toMatchObject({
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        lastCheck: expect.any(Date),
      });
    });

    it('should estimate costs', async () => {
      const estimate = await provider.getCostEstimate(testPrompt);
      
      expect(estimate).toMatchObject({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        costCents: expect.any(Number),
        currency: 'USD',
      });
    });
  });

  describe('AioProvider', () => {
    let provider: AioProvider;

    beforeEach(() => {
      provider = new AioProvider({
        simulateLatency: false,
        simulateErrors: false,
      });
    });

    it('should implement the Provider interface', async () => {
      expect(provider.key).toBe(EngineKey.AIO);
      expect(provider.name).toBe('Google AI Overview');
      expect(provider.version).toBe('1.0.0');
    });

    it('should return a valid EngineAnswer', async () => {
      const result = await provider.ask(testPrompt);
      
      expect(result).toMatchObject({
        engine: EngineKey.AIO,
        promptId: expect.any(String),
        answerText: expect.any(String),
        mentions: expect.any(Array),
        citations: expect.any(Array),
        meta: expect.any(Object),
        timestamp: expect.any(String),
      });
    });

    it('should perform health check', async () => {
      const health = await provider.healthCheck();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
    });
  });

  describe('BraveProvider', () => {
    let provider: BraveProvider;

    beforeEach(() => {
      provider = new BraveProvider({
        simulateLatency: false,
        simulateErrors: false,
      });
    });

    it('should implement the Provider interface', async () => {
      expect(provider.key).toBe(EngineKey.BRAVE);
      expect(provider.name).toBe('Brave Search');
      expect(provider.version).toBe('1.0.0');
    });

    it('should return a valid EngineAnswer', async () => {
      const result = await provider.ask(testPrompt);
      
      expect(result).toMatchObject({
        engine: EngineKey.BRAVE,
        promptId: expect.any(String),
        answerText: expect.any(String),
        mentions: expect.any(Array),
        citations: expect.any(Array),
        meta: expect.any(Object),
        timestamp: expect.any(String),
      });
    });

    it('should perform health check', async () => {
      const health = await provider.healthCheck();
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
    });
  });

  describe('ProviderFactory', () => {
    let factory: ProviderFactory;

    beforeEach(() => {
      factory = new ProviderFactory();
    });

    it('should create providers for supported engines', () => {
      const supportedEngines = factory.getSupportedEngines();
      expect(supportedEngines).toContain(EngineKey.PERPLEXITY);
      expect(supportedEngines).toContain(EngineKey.AIO);
      expect(supportedEngines).toContain(EngineKey.BRAVE);
    });

    it('should create PerplexityProvider', () => {
      const provider = factory.create(EngineKey.PERPLEXITY);
      expect(provider).toBeInstanceOf(PerplexityProvider);
    });

    it('should create AioProvider', () => {
      const provider = factory.create(EngineKey.AIO);
      expect(provider).toBeInstanceOf(AioProvider);
    });

    it('should create BraveProvider', () => {
      const provider = factory.create(EngineKey.BRAVE);
      expect(provider).toBeInstanceOf(BraveProvider);
    });

    it('should throw error for unsupported engine', () => {
      expect(() => {
        factory.create('UNSUPPORTED' as EngineKey);
      }).toThrow('Unsupported engine');
    });
  });
});
