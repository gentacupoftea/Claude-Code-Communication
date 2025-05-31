# Environment Variable Management System

Complete implementation of a web-based environment variable management system for the Conea application.

## Overview

This system provides a comprehensive UI and API for managing environment variables dynamically through a web interface, with features including:

- **Categorized Variables**: Organize variables by category (api, auth, features, system, integrations, database, security)
- **Type-Safe Values**: Support for string, number, boolean, JSON, and secret value types
- **Encryption**: Secure storage of sensitive values using Fernet encryption
- **Change History**: Complete audit trail of all variable modifications
- **Import/Export**: Support for JSON, YAML, and ENV file formats
- **Real-time Updates**: Live configuration changes without server restart
- **Multi-tenant Support**: Organization-based variable isolation

## Architecture

### Backend Components

#### Database Models (`src/environment/models.py`)
- `EnvironmentVariable`: Core variable storage with type validation
- `EnvironmentVariableHistory`: Change tracking and audit logs
- `EnvironmentVariableTemplate`: Reusable variable configurations

#### API Layer (`src/environment/routes.py`)
- RESTful endpoints for CRUD operations
- Authentication and authorization integration
- Bulk operations and validation endpoints
- Import/export functionality

#### Service Layer (`src/environment/service.py`)
- Business logic encapsulation
- Value encryption/decryption
- Data validation and type conversion
- Import/export format handling

#### Schemas (`src/environment/schemas.py`)
- Pydantic models for API validation
- Type-safe request/response handling
- Comprehensive validation rules

### Frontend Components

#### Main Page (`frontend/src/pages/settings/EnvironmentSettingsPage.tsx`)
- Tabbed interface for different categories
- Modal management for editing and viewing
- State management and API integration

#### Data Table (`frontend/src/components/environment/EnvironmentVariableTable.tsx`)
- Sortable and searchable variable listing
- Action menus and bulk operations
- Value masking for sensitive data

#### Editor Modal (`frontend/src/components/environment/EnvironmentVariableEditor.tsx`)
- Type-specific input controls
- Advanced validation options
- Real-time preview and testing

#### History Viewer (`frontend/src/components/environment/EnvironmentVariableHistory.tsx`)
- Change timeline with diff visualization
- User attribution and timestamps
- Rollback functionality

#### Import/Export (`frontend/src/components/environment/EnvironmentVariableImportExport.tsx`)
- Multi-format file upload/download
- Preview and selective import
- Validation and error reporting

## Installation

### Backend Dependencies

```bash
# Install main dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary

# Install environment management dependencies
pip install -r requirements-environment.txt
```

### Frontend Dependencies

```bash
cd frontend
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
```

### Database Setup

```bash
# Run database migrations
python -c "from src.environment.database import init_db; init_db()"

# Or run the SQL migration directly
sqlite3 shopify_mcp.db < migrations/create_environment_variables_tables.sql
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Security Configuration
SECRET_KEY=your-secret-key-here
ENCRYPTION_KEY=your-fernet-encryption-key-here

# Database Configuration
DATABASE_URL=sqlite:///./shopify_mcp.db

# Enable Environment Management
ENVIRONMENT_VARIABLE_ENCRYPTION_ENABLED=true
```

### Generate Encryption Key

```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

## Usage

### Starting the Server

```bash
# Start the FastAPI server
cd /Users/mourigenta/shopify-mcp-server
python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### Starting the Frontend

```bash
# Start the React development server
cd frontend
npm start
```

### Accessing the Interface

1. Open your browser to `http://localhost:3000`
2. Navigate to Settings → Environment Variables
3. Start managing your environment variables!

## API Endpoints

### Variables Management
- `GET /api/v1/environment/variables` - List all variables
- `POST /api/v1/environment/variables` - Create new variable
- `GET /api/v1/environment/variables/{id}` - Get specific variable
- `PUT /api/v1/environment/variables/{id}` - Update variable
- `DELETE /api/v1/environment/variables/{id}` - Delete variable

### Categories and Templates
- `GET /api/v1/environment/categories` - List available categories
- `GET /api/v1/environment/templates` - List variable templates
- `POST /api/v1/environment/templates/{template_id}/apply` - Apply template

### Import/Export
- `POST /api/v1/environment/import/preview` - Preview import data
- `POST /api/v1/environment/import` - Import variables
- `POST /api/v1/environment/export` - Export variables

### History and Validation
- `GET /api/v1/environment/variables/{id}/history` - Get change history
- `POST /api/v1/environment/validate` - Validate variable data

## Variable Types

### String
- Basic text values
- Optional regex validation
- Enumeration support with options list

### Number
- Integer and floating-point support
- Automatic type conversion
- Range validation available

### Boolean
- True/false values
- Flexible input parsing (true/false, 1/0, yes/no, on/off)

### JSON
- Complex object and array values
- Automatic JSON validation
- Pretty-printed display

### Secret
- Encrypted storage using Fernet
- Masked display in UI
- Secure handling throughout system

## Categories

### API
- External service configurations
- API keys and endpoints
- Rate limiting settings

### Auth
- Authentication configurations
- JWT settings
- OAuth parameters

### Features
- Feature flag toggles
- Experimental feature settings
- A/B test configurations

### System
- Core application settings
- Performance tuning parameters
- Debug configurations

### Integrations
- Third-party service settings
- Webhook configurations
- Integration parameters

### Database
- Connection strings
- Pool settings
- Migration parameters

### Security
- Encryption keys
- Security policies
- Access control settings

## Security Features

### Encryption
- All secret values encrypted at rest using Fernet
- Automatic encryption/decryption in service layer
- Key rotation support

### Access Control
- JWT-based authentication
- Organization-level isolation
- Role-based permissions

### Audit Logging
- Complete change history
- User attribution
- Timestamp tracking
- Diff visualization

## Testing

### Backend Tests
```bash
# Run environment management tests
python test_environment_setup.py

# Run full test suite
pytest tests/environment/
```

### Frontend Tests
```bash
cd frontend
npm test -- --testPathPattern=environment
```

## Troubleshooting

### Common Issues

#### Missing Dependencies
```bash
pip install cryptography pyyaml python-dotenv
```

#### Database Connection Issues
```bash
# Check database file permissions
ls -la shopify_mcp.db

# Reinitialize database
python -c "from src.environment.database import init_db; init_db()"
```

#### Encryption Key Issues
```bash
# Generate new encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Debugging

Enable debug logging:
```bash
export DEBUG=true
export LOG_LEVEL=debug
```

Check API endpoints:
```bash
curl http://localhost:8000/api/v1/environment/categories
```

## Future Enhancements

### Planned Features
- Variable validation rules engine
- Deployment pipeline integration
- Real-time change notifications
- Variable dependency tracking
- Backup and restore functionality
- Multi-environment promotion
- API versioning support

### Integration Points
- CI/CD pipeline hooks
- Configuration management systems
- Monitoring and alerting
- Service discovery integration

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Use TypeScript for frontend components
5. Follow security best practices for sensitive data

## License

This implementation is part of the Shopify MCP Server project and follows the same licensing terms.