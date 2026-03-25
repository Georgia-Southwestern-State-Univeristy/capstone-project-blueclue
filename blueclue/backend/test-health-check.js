// Test health check endpoint
// Using Node.js built-in fetch (available in Node 18+)

async function testHealthCheck() {
    console.log('Testing health check endpoint...\n');
    
    try {
        const startTime = Date.now();
        const response = await fetch('http://localhost:3000/api/health');
        const latency = Date.now() - startTime;
        
        const data = await response.json();
        
        console.log('Response Status:', response.status);
        console.log('Response Time:', latency, 'ms');
        console.log('\nHealth Check Response:');
        console.log(JSON.stringify(data, null, 2));
        
        // Verify acceptance criteria
        console.log('\n✓ Acceptance Criteria Verification:');
        console.log('1. Returns structured response:', data.status && data.checks ? '✓ PASS' : '✗ FAIL');
        console.log('2. Database check:', data.checks?.database ? '✓ PASS' : '✗ FAIL');
        console.log('3. AI service check:', data.checks?.ai_service ? '✓ PASS' : '✗ FAIL');
        console.log('4. Email check:', data.checks?.email ? '✓ PASS' : '✗ FAIL');
        console.log('5. Cache check:', data.checks?.cache ? '✓ PASS' : '✗ FAIL');
        console.log('6. Each has status + latency:', 
            Object.values(data.checks || {}).every(c => c.status && c.latency_ms !== undefined) ? '✓ PASS' : '✗ FAIL');
        console.log('7. Response time < 2s:', latency < 2000 ? `✓ PASS (${latency}ms)` : `✗ FAIL (${latency}ms)`);
        console.log('8. Overall health status:', data.status ? `✓ PASS (${data.status})` : '✗ FAIL');
        
    } catch (error) {
        console.error('Error testing health check:', error.message);
        process.exit(1);
    }
}

testHealthCheck();
