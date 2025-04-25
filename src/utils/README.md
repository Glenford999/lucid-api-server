# Utility Modules

## Logger Module

The logger module provides standardized logging functionality for the API server. It offers consistent log formatting, configurable log levels, and structured logging output.

### Usage

```javascript
// In JavaScript files
const logger = require('./utils/logger');

// In TypeScript files
import logger from './utils/logger';

// Log at different levels
logger.debug('Detailed debug information', { someData: 123 });
logger.info('Regular information about application flow');
logger.warn('Warning about potential issues');
logger.error('Error occurred', new Error('Something went wrong'));
```

### Configuration

The logger can be configured using environment variables:

- `LOG_LEVEL`: Sets the minimum log level to display (`debug`, `info`, `warn`, `error`). Default: `info`
- `STRUCTURED_LOGGING`: When set to `true`, outputs logs in JSON format for parsing by log aggregation tools. Default: `false`

### Log Levels

1. **DEBUG**: Detailed information, typically useful only when diagnosing problems
2. **INFO**: Confirmation that things are working as expected
3. **WARN**: Indication that something unexpected happened, or may happen in the near future
4. **ERROR**: Runtime errors or unexpected conditions that might still allow the application to continue running

### Features

- Automatic timestamp generation
- Configurable log levels
- JSON formatting for structured logging
- Proper object serialization
- Universal compatibility (works in both JavaScript and TypeScript files)

### Implementation Details

- The logger uses `console.log`, `console.warn`, and `console.error` under the hood
- Log messages include ISO-formatted timestamps
- Object arguments are automatically serialized to JSON
- When structured logging is enabled, each log entry is a single JSON object

### Example Output

Standard logging:
```
[2023-09-15T14:23:45.678Z] [INFO] Server started on port 8080
[2023-09-15T14:23:46.123Z] [DEBUG] Connection details {"host":"localhost","port":8080}
[2023-09-15T14:24:01.345Z] [ERROR] Database connection failed Connection refused
```

Structured logging:
```
{"timestamp":"2023-09-15T14:23:45.678Z","level":"INFO","message":"Server started on port 8080"}
{"timestamp":"2023-09-15T14:23:46.123Z","level":"DEBUG","message":"Connection details","metadata":[{"host":"localhost","port":8080}]}
{"timestamp":"2023-09-15T14:24:01.345Z","level":"ERROR","message":"Database connection failed","metadata":["Connection refused"]}
``` 