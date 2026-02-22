// test-priority-service.js
// Manual test script for priority service
import { calculateFinalPriority, getConfidenceLevel, prioritiesDifferSignificantly } from '../blueclue/backend/src/services/priorityService.js';

console.log('='.repeat(60));
console.log('AI Priority Service Test Suite');
console.log('='.repeat(60));

// Test 1: No user selection - AI direct
console.log('\n📝 Test 1: No User Selection');
const test1 = calculateFinalPriority({
    userPriority: null,
    aiPriority: 'high',
    aiConfidence: 0.85
});
console.log('Input: user=null, ai=high, confidence=0.85');
console.log('Result:', test1);
console.log('✓ Expected: high (AI direct)');
console.log('✓ Actual:', test1.finalPriority);
console.log('✓ Pass:', test1.finalPriority === 'high' && test1.metadata.method === 'ai_direct');

// Test 2: High confidence override warning
console.log('\n📝 Test 2: High Confidence Override Warning');
const test2 = calculateFinalPriority({
    userPriority: 'low',
    aiPriority: 'critical',
    aiConfidence: 0.92
});
console.log('Input: user=low, ai=critical, confidence=0.92');
console.log('Result:', test2);
console.log('✓ Expected: Warning required');
console.log('✓ Actual requires confirmation:', test2.requiresConfirmation);
console.log('✓ Pass:', test2.requiresConfirmation === true);

// Test 3: Weighted average
console.log('\n📝 Test 3: Weighted Average Calculation');
const test3 = calculateFinalPriority({
    userPriority: 'medium',
    aiPriority: 'high',
    aiConfidence: 0.7
});
console.log('Input: user=medium, ai=high, confidence=0.7');
console.log('Result:', test3);
console.log('Calculation details:', test3.metadata);
console.log('✓ Expected: Weighted average method');
console.log('✓ Actual method:', test3.metadata.method);
console.log('✓ Pass:', test3.metadata.method === 'weighted_average');

// Test 4: Low confidence - trust user
console.log('\n📝 Test 4: Low Confidence - Trust User');
const test4 = calculateFinalPriority({
    userPriority: 'high',
    aiPriority: 'low',
    aiConfidence: 0.3
});
console.log('Input: user=high, ai=low, confidence=0.3');
console.log('Result:', test4);
console.log('✓ Expected: high (user priority)');
console.log('✓ Actual:', test4.finalPriority);
console.log('✓ Pass:', test4.finalPriority === 'high' && test4.metadata.method === 'user_priority_low_confidence');

// Test 5: AI disabled
console.log('\n📝 Test 5: AI System Disabled');
const test5 = calculateFinalPriority({
    userPriority: 'medium',
    aiPriority: 'critical',
    aiConfidence: 0.95,
    config: { enableAIPriority: false }
});
console.log('Input: user=medium, ai=critical, confidence=0.95, AI disabled');
console.log('Result:', test5);
console.log('✓ Expected: medium (user only)');
console.log('✓ Actual:', test5.finalPriority);
console.log('✓ Pass:', test5.finalPriority === 'medium' && test5.metadata.method === 'user_only');

// Test 6: Confidence level categorization
console.log('\n📝 Test 6: Confidence Level Categorization');
console.log('0.85 →', getConfidenceLevel(0.85), '(expected: high)');
console.log('0.65 →', getConfidenceLevel(0.65), '(expected: medium)');
console.log('0.35 →', getConfidenceLevel(0.35), '(expected: low)');

// Test 7: Significant difference detection
console.log('\n📝 Test 7: Significant Difference Detection');
console.log('critical vs low:', prioritiesDifferSignificantly('critical', 'low'), '(expected: true)');
console.log('high vs medium:', prioritiesDifferSignificantly('high', 'medium'), '(expected: false)');
console.log('high vs low:', prioritiesDifferSignificantly('high', 'low'), '(expected: true)');

console.log('\n' + '='.repeat(60));
console.log('All tests completed!');
console.log('='.repeat(60));
