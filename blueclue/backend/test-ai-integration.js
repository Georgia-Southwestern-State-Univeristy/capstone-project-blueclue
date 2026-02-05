// test-ai-integration.js
// Integration test script for AI classification service

import http from 'http';
import https from 'https';

const API_BASE_URL = 'http://localhost:3000';
const AI_SERVICE_URL = 'http://localhost:5000';

// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, colors.cyan);
    console.log('='.repeat(60));
}

function logTest(testName) {
    log(`\n→ ${testName}`, colors.blue);
}

function logSuccess(message) {
    log(`  ✓ ${message}`, colors.green);
}

function logError(message) {
    log(`  ✗ ${message}`, colors.red);
}

function logWarning(message) {
    log(`  ⚠ ${message}`, colors.yellow);
}

// Fetch wrapper using http module
function fetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const lib = urlObj.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        const req = lib.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });
        
        req.on('error', reject);
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Test data
const testTickets = [
    {
        name: 'Technical Issue (High Priority)',
        data: {
            subject: 'System crashes with error code 500',
            description: 'Critical production issue - server keeps crashing and showing error messages. Need urgent help!',
            customer_id: 1
        },
        expectedCategory: 'technical',
        expectedPriority: 'high'
    },
    {
        name: 'Billing Question (Medium Priority)',
        data: {
            subject: 'Question about my invoice',
            description: 'I was charged twice this month and need a refund for the duplicate payment.',
            customer_id: 1
        },
        expectedCategory: 'billing',
        expectedPriority: 'medium'
    },
    {
        name: 'Account Access (Medium Priority)',
        data: {
            subject: 'Cannot login to my account',
            description: 'I forgot my password and the reset link is not working. Need help accessing my account.',
            customer_id: 1
        },
        expectedCategory: 'account',
        expectedPriority: 'medium'
    },
    {
        name: 'Feature Request (Low Priority)',
        data: {
            subject: 'Suggestion for new feature',
            description: 'Would like to request a dark mode option for the application. It would be nice to have.',
            customer_id: 1
        },
        expectedCategory: 'feature_request',
        expectedPriority: 'low'
    }
];

// Test helper functions
async function checkServiceHealth(url, serviceName) {
    try {
        const response = await fetch(`${url}/health`);
        if (response.ok) {
            logSuccess(`${serviceName} is running`);
            return true;
        }
        logError(`${serviceName} returned status ${response.status}`);
        return false;
    } catch (error) {
        logError(`${serviceName} is not accessible: ${error.message}`);
        return false;
    }
}

async function createTicket(ticketData) {
    const response = await fetch(`${API_BASE_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData)
    });
    
    const data = await response.json();
    return { response, data };
}

async function testTicketCreation(testCase) {
    logTest(`Testing: ${testCase.name}`);
    
    try {
        const { response, data } = await createTicket(testCase.data);
        
        // Check response status
        if (response.status !== 201) {
            logError(`Expected status 201, got ${response.status}`);
            console.log('Response:', JSON.stringify(data, null, 2));
            return false;
        }
        logSuccess('Ticket created successfully (201)');
        
        // Check response structure
        if (!data.data || !data.ai_classification) {
            logError('Missing required fields in response');
            return false;
        }
        logSuccess('Response has correct structure');
        
        // Check ticket data
        const ticket = data.data;
        logSuccess(`Ticket ID: ${ticket.id}, Number: ${ticket.ticket_number}`);
        
        // Check AI classification
        const aiClass = data.ai_classification;
        
        if (aiClass.used) {
            logSuccess(`AI Classification used (confidence: ${aiClass.confidence})`);
            logSuccess(`Category: ${aiClass.category}, Priority: ${aiClass.priority}`);
            
            // Verify expected values
            if (aiClass.category === testCase.expectedCategory) {
                logSuccess(`✓ Category matches expected: ${testCase.expectedCategory}`);
            } else {
                logWarning(`Category mismatch: expected ${testCase.expectedCategory}, got ${aiClass.category}`);
            }
            
            if (aiClass.priority === testCase.expectedPriority) {
                logSuccess(`✓ Priority matches expected: ${testCase.expectedPriority}`);
            } else {
                logWarning(`Priority mismatch: expected ${testCase.expectedPriority}, got ${aiClass.priority}`);
            }
            
            if (!aiClass.fallback_used) {
                logSuccess('AI service responded (no fallback)');
            } else {
                logWarning('AI used fallback classification');
            }
        } else {
            logWarning('AI classification not used (fallback mode)');
            if (aiClass.warning) {
                logWarning(`Warning: ${aiClass.warning}`);
            }
        }
        
        return true;
        
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        return false;
    }
}

async function testFallback() {
    logTest('Testing: Fallback when AI service is down');
    
    // Check if AI service is actually down
    const aiRunning = await checkServiceHealth(AI_SERVICE_URL, 'AI Service');
    if (aiRunning) {
        logWarning('AI service is running - cannot test fallback. Stop the AI service first.');
        return false;
    }
    
    const testData = {
        subject: 'Test ticket with AI service down',
        description: 'This should use fallback values',
        customer_id: 1
    };
    
    try {
        const { response, data } = await createTicket(testData);
        
        if (response.status !== 201) {
            logError(`Expected status 201, got ${response.status}`);
            return false;
        }
        logSuccess('Ticket created successfully despite AI service being down');
        
        const aiClass = data.ai_classification;
        
        if (!aiClass.used && aiClass.fallback_used) {
            logSuccess('Fallback mode activated correctly');
            logSuccess(`Category: ${aiClass.category}, Priority: ${aiClass.priority}`);
            return true;
        } else {
            logError('Fallback mode not activated as expected');
            return false;
        }
        
    } catch (error) {
        logError(`Fallback test failed: ${error.message}`);
        return false;
    }
}

// Main test runner
async function runTests() {
    logSection('AI CLASSIFICATION INTEGRATION TEST');
    
    log('\nStarting integration tests...\n', colors.yellow);
    
    // Step 1: Check services
    logSection('Step 1: Service Health Checks');
    
    const backendHealthy = await checkServiceHealth(`${API_BASE_URL}/api`, 'Backend API');
    const aiHealthy = await checkServiceHealth(AI_SERVICE_URL, 'AI Service');
    
    if (!backendHealthy) {
        log('\n❌ Backend is not running. Start it with: npm run dev', colors.red);
        process.exit(1);
    }
    
    // Step 2: Test with AI service running
    if (aiHealthy) {
        logSection('Step 2: Testing with AI Service Running');
        
        let passed = 0;
        let failed = 0;
        
        for (const testCase of testTickets) {
            const result = await testTicketCreation(testCase);
            if (result) {
                passed++;
            } else {
                failed++;
            }
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
        }
        
        logSection('Test Results');
        log(`Total Tests: ${testTickets.length}`, colors.cyan);
        log(`Passed: ${passed}`, colors.green);
        if (failed > 0) {
            log(`Failed: ${failed}`, colors.red);
        }
    } else {
        logWarning('\nAI Service is not running - testing fallback mode instead');
        
        logSection('Step 2: Testing Fallback Mode');
        await testFallback();
    }
    
    // Final summary
    logSection('Test Complete');
    log('\n✓ Integration tests finished!\n', colors.green);
    log('Next steps:', colors.cyan);
    log('  1. Check the tickets table in pgAdmin to verify data');
    log('  2. Check the ai_classifications table for classification records');
    log('  3. Test fallback by stopping AI service and running again\n');
}

// Run tests
runTests().catch(error => {
    logError(`\nFatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
});
