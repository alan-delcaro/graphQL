#!/bin/bash

# Test script para demonstrar Dynatrace structured logging no backend GraphQL
# Uso: bash test-logging.sh

set -e

API_URL="${1:-http://localhost:4000/graphql}"
VERBOSE="${2:-false}"

echo "═══════════════════════════════════════════════════════════════════"
echo "  Dynatrace Structured Logging — Apollo GraphQL Backend Test"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "API URL: $API_URL"
echo "Mode: $([ "$VERBOSE" = "true" ] && echo "VERBOSE" || echo "STANDARD")"
echo ""

# Generate trace context (W3C format)
TRACE_ID=$(openssl rand -hex 16)
SPAN_ID=$(openssl rand -hex 8)
TRACEPARENT="00-${TRACE_ID}-${SPAN_ID}-01"

echo "📊 Trace Context:"
echo "   traceparent: $TRACEPARENT"
echo ""

# Test 1: Simple Query (GetViewer)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: GetViewer Query"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "traceparent: $TRACEPARENT" \
  -H "apollographql-client-name: @saude-connect/home" \
  -H "apollographql-client-version: 3.0.0" \
  -d '{"query":"query GetViewer { viewer { id name email } }"}' | jq . 2>/dev/null

echo ""
echo ""

# Test 2: Query with Variables
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: ExamDetail Query (with variables)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-${TRACE_ID}-$(openssl rand -hex 8)-01" \
  -H "apollographql-client-name: @saude-connect/exames" \
  -H "apollographql-client-version: 3.0.0" \
  -d '{
    "operationName": "ExamDetail",
    "query": "query ExamDetail($reportId: ID!) { examDetail(reportId: $reportId) { id title date } }",
    "variables": {"reportId": "exam-001"}
  }' | jq . 2>/dev/null

echo ""
echo ""

# Test 3: Query that triggers GraphQL Error
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Invalid ExamDetail (triggers GraphQL error)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-${TRACE_ID}-$(openssl rand -hex 8)-01" \
  -H "apollographql-client-name: @saude-connect/exames" \
  -H "apollographql-client-version: 3.0.0" \
  -d '{
    "operationName": "ExamDetail",
    "query": "query ExamDetail($reportId: ID!) { examDetail(reportId: $reportId) { id title date } }",
    "variables": {"reportId": "invalid-id-xyz"}
  }' | jq . 2>/dev/null

echo ""
echo ""

# Test 4: Anonymous Query
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Anonymous Query (no operationName)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-${TRACE_ID}-$(openssl rand -hex 8)-01" \
  -H "apollographql-client-name: @saude-connect/shell" \
  -d '{"query":"{ viewer { id name } }"}' | jq . 2>/dev/null

echo ""
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "✓ Tests completed!"
echo ""
echo "Check backend stdout for structured JSON logs:"
echo "  - didResolveOperation (request received)"
echo "  - willSendResponse (response sent)"
echo "  - didEncounterErrors (if any errors occurred)"
echo ""
echo "Each log includes:"
echo "  - timestamp, operationName, operationType"
echo "  - traceContext (traceId, spanId from W3C traceparent header)"
echo "  - clientInfo (apollographql-client-name, -version)"
echo "  - performance metrics (durationMs)"
echo "═══════════════════════════════════════════════════════════════════"
