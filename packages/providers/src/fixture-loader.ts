/**
 * Fixture loader for provider responses
 * Loads mock responses from JSON files for offline testing
 */

import { EngineAnswer } from '@ai-visibility/shared';
import { ProviderFixture } from './types';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../../fixtures');

export async function loadFixture(
  provider: string,
  prompt: string
): Promise<ProviderFixture | null> {
  try {
    const fixturePath = path.join(FIXTURES_DIR, provider, 'responses.json');
    
    if (!fs.existsSync(fixturePath)) {
      return null;
    }

    const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    
    // Find matching fixture by prompt similarity
    const matchingFixture = findMatchingFixture(fixtures, prompt);
    
    if (matchingFixture) {
      return {
        prompt: matchingFixture.prompt,
        response: matchingFixture.response,
        metadata: matchingFixture.metadata || {},
        error: matchingFixture.error,
      };
    }

    return null;
  } catch (error) {
    console.warn(`Failed to load fixture for ${provider}:`, error);
    return null;
  }
}

function findMatchingFixture(fixtures: any[], prompt: string): any {
  // Simple keyword matching for now
  const promptWords = prompt.toLowerCase().split(/\s+/);
  
  for (const fixture of fixtures) {
    const fixtureWords = fixture.prompt.toLowerCase().split(/\s+/);
    const commonWords = promptWords.filter(word => fixtureWords.includes(word));
    
    // If more than 50% of words match, consider it a match
    if (commonWords.length / promptWords.length > 0.5) {
      return fixture;
    }
  }

  return null;
}

export function saveFixture(
  provider: string,
  fixture: ProviderFixture
): void {
  try {
    const providerDir = path.join(FIXTURES_DIR, provider);
    const fixturePath = path.join(providerDir, 'responses.json');
    
    // Ensure directory exists
    if (!fs.existsSync(providerDir)) {
      fs.mkdirSync(providerDir, { recursive: true });
    }

    let fixtures: any[] = [];
    if (fs.existsSync(fixturePath)) {
      fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    }

    // Add or update fixture
    const existingIndex = fixtures.findIndex(f => f.prompt === fixture.prompt);
    if (existingIndex >= 0) {
      fixtures[existingIndex] = fixture;
    } else {
      fixtures.push(fixture);
    }

    fs.writeFileSync(fixturePath, JSON.stringify(fixtures, null, 2));
  } catch (error) {
    console.error(`Failed to save fixture for ${provider}:`, error);
  }
}

export function clearFixtures(provider?: string): void {
  try {
    if (provider) {
      const providerDir = path.join(FIXTURES_DIR, provider);
      if (fs.existsSync(providerDir)) {
        fs.rmSync(providerDir, { recursive: true });
      }
    } else {
      if (fs.existsSync(FIXTURES_DIR)) {
        fs.rmSync(FIXTURES_DIR, { recursive: true });
      }
    }
  } catch (error) {
    console.error(`Failed to clear fixtures:`, error);
  }
}
