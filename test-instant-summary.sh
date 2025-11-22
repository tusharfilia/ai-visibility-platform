#!/bin/bash

# Test script for the instant-summary endpoint
# Usage: ./test-instant-summary.sh [domain] [api_url]

DOMAIN=${1:-"airbnb.com"}
API_URL=${2:-"http://localhost:8080"}

echo "🧪 Testing Instant Summary Endpoint"
echo "======================================"
echo "Domain: $DOMAIN"
echo "API URL: $API_URL"
echo ""

# Test the endpoint
echo "📡 Making request to /v1/demo/instant-summary..."
echo ""

RESPONSE=$(curl -s -X GET "${API_URL}/v1/demo/instant-summary?domain=${DOMAIN}" \
  -H "Content-Type: application/json")

# Check if response is valid JSON
if echo "$RESPONSE" | jq . > /dev/null 2>&1; then
  echo "✅ Valid JSON response received!"
  echo ""
  
  # Extract key fields
  echo "📊 Response Summary:"
  echo "-------------------"
  
  # Check if ok is true
  OK=$(echo "$RESPONSE" | jq -r '.ok // false')
  if [ "$OK" = "true" ]; then
    echo "✅ Status: OK"
  else
    echo "❌ Status: Failed"
    echo "$RESPONSE" | jq .
    exit 1
  fi
  
  # Extract key data
  echo ""
  echo "🏭 Industry Detection:"
  echo "$RESPONSE" | jq -r '.data.industry.primary // "Not found"' | sed 's/^/  - Primary: /'
  echo "$RESPONSE" | jq -r '.data.industry.confidence // 0' | awk '{printf "  - Confidence: %.0f%%\n", $1 * 100}'
  
  echo ""
  echo "📝 Business Summary:"
  SUMMARY=$(echo "$RESPONSE" | jq -r '.data.summary.summary // .data.summary // "Not found"' | head -c 100)
  echo "  - Preview: ${SUMMARY}..."
  
  echo ""
  echo "🎯 Prompts Generated:"
  PROMPT_COUNT=$(echo "$RESPONSE" | jq '.data.prompts | length // 0')
  echo "  - Count: $PROMPT_COUNT"
  if [ "$PROMPT_COUNT" -gt 0 ]; then
    echo "$RESPONSE" | jq -r '.data.prompts[0].text // .data.prompts[0] // "N/A"' | sed 's/^/  - First: /'
  fi
  
  echo ""
  echo "🏢 Competitors Found:"
  COMPETITOR_COUNT=$(echo "$RESPONSE" | jq '.data.competitors | length // 0')
  echo "  - Count: $COMPETITOR_COUNT"
  if [ "$COMPETITOR_COUNT" -gt 0 ]; then
    echo "$RESPONSE" | jq -r '.data.competitors[0].domain // .data.competitors[0] // "N/A"' | sed 's/^/  - First: /'
  fi
  
  echo ""
  echo "📈 GEO Score:"
  GEO_SCORE=$(echo "$RESPONSE" | jq -r '.data.geoScore.total // .data.geoScore // 0')
  echo "  - Total: $GEO_SCORE/100"
  
  echo ""
  echo "⭐ EEAT Score:"
  EEAT_TOTAL=$(echo "$RESPONSE" | jq -r '.data.eeatScore.total // 0')
  echo "  - Total: $EEAT_TOTAL/400"
  
  echo ""
  echo "🔗 Citations:"
  CITATION_COUNT=$(echo "$RESPONSE" | jq '.data.citations | length // 0')
  echo "  - Count: $CITATION_COUNT"
  
  echo ""
  echo "📊 Share of Voice:"
  SOV_COUNT=$(echo "$RESPONSE" | jq '.data.shareOfVoice | length // 0')
  echo "  - Entities: $SOV_COUNT"
  
  echo ""
  echo "💯 Overall Confidence:"
  CONFIDENCE=$(echo "$RESPONSE" | jq -r '.confidence // 0')
  echo "  - Confidence: $(awk "BEGIN {printf \"%.0f%%\", $CONFIDENCE * 100}")"
  
  echo ""
  echo "⚠️ Warnings:"
  WARNING_COUNT=$(echo "$RESPONSE" | jq '.warnings | length // 0')
  echo "  - Count: $WARNING_COUNT"
  if [ "$WARNING_COUNT" -gt 0 ]; then
    echo "$RESPONSE" | jq -r '.warnings[]' | sed 's/^/    - /'
  fi
  
  echo ""
  echo "📄 Status:"
  STATUS=$(echo "$RESPONSE" | jq -r '.data.status // "unknown"')
  echo "  - Status: $STATUS"
  PROGRESS=$(echo "$RESPONSE" | jq -r '.data.progress // 0')
  echo "  - Progress: $PROGRESS%"
  
  echo ""
  echo "✅ Test completed successfully!"
  echo ""
  echo "💡 Tip: To see the full response, run:"
  echo "   curl -s '${API_URL}/v1/demo/instant-summary?domain=${DOMAIN}' | jq ."
  
else
  echo "❌ Invalid JSON response"
  echo ""
  echo "Raw response:"
  echo "$RESPONSE"
  exit 1
fi

