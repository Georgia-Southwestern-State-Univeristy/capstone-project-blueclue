# Backend Testing Setup

This guide explains how to run the webhook validation tests for the BlueClue backend.

## Prerequisites

The webhook validation middleware tests are located in `tests/webhookValidation.test.js` and test the HMAC signature verification for Mailgun webhooks.

## Installation

Install the test framework and dependencies:

```bash
npm install --save-dev vitest @vitest/ui
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (for development)
```bash
npm run test:watch
```

### Run tests with UI
```bash
npm run test:ui
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Coverage

The webhook validation tests cover:

✅ **Valid signature accepted**: Requests with valid HMAC signatures pass through  
✅ **Invalid signature rejected**: Requests with wrong signatures return 403 Forbidden  
✅ **Missing signature rejected**: Requests without signature fields return 403 Forbidden  
✅ **Expired timestamp rejected**: Requests older than 5 minutes are rejected  
✅ **Environment configuration**: Tests for missing/empty signing key configuration  

## Test Files

- `tests/webhookValidation.test.js` - Mailgun webhook signature validation tests (15+ test cases)

## Environment Variables for Testing

The tests use the `MAILGUN_WEBHOOK_SIGNING_KEY` environment variable. This is automatically mocked in tests, so you don't need to configure anything special.

## Adding New Tests

To add more webhook tests:

1. Create a new test file in the `tests/` directory
2. Import the middleware/controller you want to test
3. Use the same pattern as `webhookValidation.test.js`
4. Run `npm test` to verify

## Continuous Integration

These tests can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm test
  
- name: Upload coverage
  run: npm run test:coverage
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Mailgun Webhook Security](https://documentation.mailgun.com/en/latest/user_manual.html#securing-webhooks)
